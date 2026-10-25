"""Ayar taraması (eğitim / sınav ayrımıyla).

Veri ikiye bölünür: eski yarı EĞİTİM (ayarlar burada seçilir), yeni yarı SINAV (seçilen ayar hiç
görmediği veride kontrol edilir). Sadece eğitimde iyi olan ayar "ezber"dir; sınavda da tutan ayar güvenilirdir.
Simülasyon canlı botun portföy limitlerini (en fazla N pozisyon, toplam risk) uygular.

  python -m bot optimize --top 20 --days 180
"""
from __future__ import annotations

import copy
import itertools
import time
from pathlib import Path

import pandas as pd

from . import backtest
from .indicators import ohlcv_to_df

GRID = {
    "buy_threshold": [40, 50, 60],
    "take_profit": {
        "2x/3x": [{"multiple": 2.0, "sell_fraction": 0.5}, {"multiple": 3.0, "sell_fraction": 1.0}],
        "1.5x/2.5x": [{"multiple": 1.5, "sell_fraction": 0.5}, {"multiple": 2.5, "sell_fraction": 1.0}],
        "1.25x/1.6x": [{"multiple": 1.25, "sell_fraction": 0.5}, {"multiple": 1.6, "sell_fraction": 1.0}],
    },
    "stop_loss_pct": [0.25, 0.15, 0.10],
    "max_hold_hours": [336, 120],
    "trailing": {"geniş": (0.40, 0.20), "sıkı": (0.15, 0.08)},
}


def apply(cfg: dict, combo: dict) -> dict:
    c = copy.deepcopy(cfg)
    c["analysis"]["buy_threshold"] = combo["buy_threshold"]
    c["exits"]["take_profit"] = GRID["take_profit"][combo["take_profit"]]
    c["exits"]["stop_loss_pct"] = combo["stop_loss_pct"]
    c["exits"]["max_hold_hours"] = combo["max_hold_hours"]
    act, trail = GRID["trailing"][combo["trailing"]]
    c["exits"]["trailing"] = {"activate_gain": act, "trail_pct": trail}
    c["exits"]["breakeven_after_gain"] = min(c["exits"]["breakeven_after_gain"], act)
    return c


def combos():
    keys = list(GRID)
    vals = [list(GRID[k]) if isinstance(GRID[k], dict) else GRID[k] for k in keys]
    for v in itertools.product(*vals):
        yield dict(zip(keys, v))


def stats(res: backtest.Result) -> dict:
    t = res.trades
    win = sum(x["pnl"] for x in t if x["pnl"] > 0)
    loss = -sum(x["pnl"] for x in t if x["pnl"] <= 0)
    peak = dd = 0.0
    for e in res.equity:
        peak, dd = max(peak, e), max(dd, peak - e)
    return {"işlem": len(t), "kazanan%": round(100 * sum(1 for x in t if x["pnl"] > 0) / len(t)) if t else 0,
            "net$": round(sum(x["pnl"] for x in t), 2), "kf": round(win / loss, 2) if loss else (99.0 if win else 0.0),
            "düşüş$": round(dd, 2)}


def load_data(cfg: dict, top: int, days: float, cache_dir: Path) -> dict[str, pd.DataFrame]:
    from .engine import Bot
    from .exchange import CcxtExchange
    from .journal import Journal
    cache_dir.mkdir(parents=True, exist_ok=True)
    ex = CcxtExchange(cfg)
    tmp = Bot.__new__(Bot)
    tmp.cfg, tmp.quote, tmp.journal = cfg, cfg["exchange"]["quote"], Journal(cfg)
    symbols = tmp.universe(ex.fetch_tickers())[:top] + [f"BTC/{tmp.quote}"]
    data = {}
    for sym in symbols:
        f = cache_dir / f"{sym.replace('/', '_')}_{cfg['timeframe']}_{int(days)}d.csv"
        if f.exists() and time.time() - f.stat().st_mtime < 6 * 3600:
            data[sym] = backtest.load_file(str(f))
            continue
        try:
            df = backtest.fetch_history(ex, sym, cfg["timeframe"], days)
        except Exception as exc:
            print(f"{sym}: veri alınamadı ({exc})")
            continue
        out = df.reset_index()
        out["ts"] = (out["ts"] - pd.Timestamp(0, tz="UTC")) // pd.Timedelta(milliseconds=1)
        out.to_csv(f, index=False)
        data[sym] = df
    return data


def optimize(cfg: dict, data: dict[str, pd.DataFrame], top_n: int = 5) -> str:
    btc_sym = f"BTC/{cfg['exchange']['quote']}"
    btc = data.get(btc_sym)
    coins = {s: d for s, d in data.items() if s != btc_sym}
    t0 = time.time()
    pres = {s: backtest.precompute(s, d, cfg, btc) for s, d in coins.items() if len(d) > 260}
    # Her coin kendi verisi başladığında teste girer (yeni listelenenler dönemi kısaltmasın)
    start = min(d.index[210] for d in pres.values())
    end = max(d.index[-1] for d in pres.values())
    mid = start + (end - start) / 2
    lines = [f"{len(pres)} coin · eğitim {start:%Y-%m-%d} → {mid:%Y-%m-%d} · sınav {mid:%Y-%m-%d} → {end:%Y-%m-%d} "
             f"(skorlar {time.time()-t0:.0f} sn)"]

    current = {"buy_threshold": cfg["analysis"]["buy_threshold"], "take_profit": "2x/3x",
               "stop_loss_pct": cfg["exits"]["stop_loss_pct"], "max_hold_hours": cfg["exits"]["max_hold_hours"], "trailing": "geniş"}
    rows = []
    for combo in combos():
        c = apply(cfg, combo)
        rows.append((combo, stats(backtest.run_portfolio(pres, c, start, mid))))
    # Eğitimde: en az 15 işlem, net kâra göre sırala
    ranked = sorted([r for r in rows if r[1]["işlem"] >= 15], key=lambda r: -r[1]["net$"])

    def fmt(combo):
        return (f"eşik {combo['buy_threshold']} · hedef {combo['take_profit']} · stop %{combo['stop_loss_pct']*100:.0f} · "
                f"süre {combo['max_hold_hours']}s · iz süren {combo['trailing']}")

    lines.append("\nEN İYİ AYARLAR (eğitimde seçildi, sınavda kontrol edildi):")
    lines.append(f"{'':3}{'ayar':<78} {'EĞİTİM':>34} | {'SINAV':>34}")
    best = []
    for k, (combo, tr) in enumerate([(current, None)] + ranked[:top_n]):
        c = apply(cfg, combo)
        tr = tr or stats(backtest.run_portfolio(pres, c, start, mid))
        te = stats(backtest.run_portfolio(pres, c, mid, end))
        tag = "MEVCUT" if k == 0 else f"#{k}"
        lines.append(f"{tag:<7}{fmt(combo):<74} {tr['işlem']:>3} işl %{tr['kazanan%']:>3} {tr['net$']:>+8.2f}$ kf {tr['kf']:>5} | "
                     f"{te['işlem']:>3} işl %{te['kazanan%']:>3} {te['net$']:>+8.2f}$ kf {te['kf']:>5} düşüş {te['düşüş$']}$")
        if k:
            best.append((combo, tr, te))
    robust = [b for b in best if b[2]["net$"] > 0 and b[2]["kf"] >= 1.2]
    if robust:
        # Sınavın en iyisini değil, eğitim sırasındaki ilk "sınavı geçen"i seç (sınavı ezberlememek için)
        combo, tr, te = robust[0]
        lines.append(f"\nÖNERİ: {fmt(combo)}\n  sınavda {te['işlem']} işlem, net {te['net$']:+.2f} $, kâr faktörü {te['kf']}")
        lines.append("  config.yaml için:\n" + to_yaml(combo))
    else:
        lines.append("\nÖNERİ YOK: eğitimde iyi görünen ayarların hiçbiri sınavda kârlı kalmadı (ezber). Mevcut ayarlarla kalın.")
    return "\n".join(lines)


def to_yaml(combo: dict) -> str:
    act, trail = GRID["trailing"][combo["trailing"]]
    tp = GRID["take_profit"][combo["take_profit"]]
    tp_lines = "\n".join(f"    - {{multiple: {t['multiple']}, sell_fraction: {t['sell_fraction']}}}" for t in tp)
    return (f"analysis:\n  buy_threshold: {combo['buy_threshold']}\nexits:\n  stop_loss_pct: {combo['stop_loss_pct']}\n"
            f"  max_hold_hours: {combo['max_hold_hours']}\n  take_profit:\n{tp_lines}\n"
            f"  trailing: {{activate_gain: {act}, trail_pct: {trail}}}\n  breakeven_after_gain: {min(0.25, act)}")


if __name__ == "__main__":  # pragma: no cover
    from .config import load_config
    cfg = load_config()
    print(optimize(cfg, load_data(cfg, 20, 180, Path(cfg["state_dir"]) / "cache")))
