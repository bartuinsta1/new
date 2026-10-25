"""Geçmiş veride strateji testi. Canlı bot ile aynı analiz (`decide`) ve çıkış (`risk`) kodunu kullanır.

Haber ve piyasa bağlamı geçmişe dönük bilinmediği için sadece teknik blok test edilir.
Mum içi sıra bilinmez; temkinli varsayım: önce stop (low), sonra hedefler (high), sonra kapanış.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import pandas as pd

from . import risk
from .analysis import decide
from .indicators import add_indicators, ohlcv_to_df
from .state import Position

TF_MS = {"1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000,
         "4h": 14_400_000, "6h": 21_600_000, "12h": 43_200_000, "1d": 86_400_000}


def fetch_history(ex, symbol: str, timeframe: str, days: int) -> pd.DataFrame:
    """ccxt borsasından sayfalı geçmiş mum çeker."""
    step = TF_MS[timeframe]
    since = int(time.time() * 1000 - days * 86_400_000)
    rows: list = []
    while True:
        batch = ex.ex.fetch_ohlcv(symbol, timeframe=timeframe, since=since, limit=1000)
        if not batch:
            break
        rows += batch
        since = batch[-1][0] + step
        if len(batch) < 2 or since > time.time() * 1000:
            break
    uniq = {r[0]: r for r in rows}
    return ohlcv_to_df([uniq[k] for k in sorted(uniq)])


@dataclass
class Result:
    symbol: str
    trades: list[dict] = field(default_factory=list)
    equity: list[float] = field(default_factory=list)

    @property
    def pnl(self) -> float:
        return sum(t["pnl"] for t in self.trades)

    def report(self) -> str:
        n = len(self.trades)
        if not n:
            return f"{self.symbol}: hiç işlem açılmadı (eşik çok yüksek olabilir)"
        wins = [t for t in self.trades if t["pnl"] > 0]
        losses = [t for t in self.trades if t["pnl"] <= 0]
        gross_win, gross_loss = sum(t["pnl"] for t in wins), -sum(t["pnl"] for t in losses)
        peak = dd = 0.0
        for e in self.equity:
            peak = max(peak, e)
            dd = max(dd, peak - e)
        multi = sum(1 for t in self.trades if t["max_multiple"] >= 2)
        lines = [
            f"{self.symbol}: {n} işlem · kazanan %{len(wins)/n*100:.0f} · net {self.pnl:+.2f} $ · ort. {self.pnl/n:+.2f} $/işlem",
            f"  kâr faktörü {gross_win/gross_loss if gross_loss else float('inf'):.2f} · en büyük düşüş {dd:.2f} $ · "
            f"2x'i gören işlem {multi}/{n} · ort. süre {sum(t['hours'] for t in self.trades)/n:.0f} saat",
        ]
        for t in self.trades[-10:]:
            lines.append(f"  {t['open']:%Y-%m-%d %H:%M} skor {t['score']:+.0f} {t['entry']:.6g} → {t['exit']:.6g} "
                         f"{t['pnl']:+.2f} $ ({t['pct']:+.0f}%) · {t['reason']}")
        return "\n".join(lines)


def btc_context(btc_raw: pd.DataFrame | None):
    """Her mum zamanı için canlı botun kullandığı BTC bağlamı (24s değişim %, EMA50 üstü mü)."""
    if btc_raw is None:
        return lambda ts: {}
    b = add_indicators(btc_raw)
    chg = b["close"].pct_change(24) * 100
    up = b["close"] > b["ema50"]

    def ctx(ts):
        if ts not in b.index:
            return {}
        return {"btc_change_24h": float(chg.loc[ts]), "btc_trend_up": bool(up.loc[ts])}
    return ctx


def precompute(symbol: str, raw: pd.DataFrame, cfg: dict, btc_raw: pd.DataFrame | None = None) -> pd.DataFrame:
    """Göstergeler + her mum için analiz skoru ve veto. Skor çıkış ayarlarından bağımsız olduğu için
    bir kez hesaplanıp farklı çıkış/eşik ayarlarıyla tekrar tekrar kullanılabilir (optimize)."""
    df = add_indicators(raw)
    ctx_at = btc_context(btc_raw)
    scores, vetoes = [float("nan")] * len(df), [True] * len(df)
    for i in range(210, len(df)):
        d = decide(symbol, df, cfg, ctx_at(df.index[i]), i=i)
        scores[i], vetoes[i] = d.score, bool(d.vetoes)
    df["score"], df["veto"] = scores, vetoes
    return df


def bar_exits(pos: Position, bar, now: float, score: float, cfg: dict) -> list[tuple[float, float, str]]:
    """Bir mum içinde (fiyat, satılacak oran, neden) listesi. Temkinli sıra: stop (low) → hedefler (high) → kapanış.
    Uygulanan kısmi satışlar pos.remaining'i değiştirmez; çağıran uygular."""
    if bar["low"] <= pos.stop_price:
        return [(min(bar["open"], pos.stop_price), 1.0, "iz süren stop" if pos.stop_price > pos.entry_price else "zarar kes")]
    out = []
    ladder, hits_before = cfg["exits"]["take_profit"], pos.tp_hits
    # Zirvede sadece kâr alma kademeleri (zaman açılışa sabit, skor yok: süre ve kârı koru kapanışta)
    for k, a in enumerate(risk.exit_actions(pos, bar["high"], pos.opened_at, None, cfg)):
        out.append((pos.entry_price * ladder[hits_before + k]["multiple"], a.fraction, a.reason))
        if a.fraction >= 1:
            return out
    for a in risk.exit_actions(pos, bar["close"], now, score, cfg):
        out.append((bar["close"], a.fraction, a.reason))
    return out


def _trade_record(pos: Position, price: float, reason: str) -> dict:
    pnl = pos.realized - pos.cost
    return {"symbol": pos.symbol, "open": pd.Timestamp(pos.opened_at, unit="s", tz="UTC"), "entry": pos.entry_price,
            "exit": price, "score": pos.entry_score, "pnl": pnl, "pct": pnl / pos.cost * 100, "reason": reason,
            "hours": (pos.closed_at - pos.opened_at) / 3600, "max_multiple": pos.highest_price / pos.entry_price}


def _sell(pos: Position, price: float, fraction: float, fee: float) -> bool:
    """Kısmi/tam satış uygular; pozisyon kapandıysa True."""
    amt = pos.remaining * fraction
    pos.remaining -= amt
    pos.realized += amt * price * (1 - fee)
    return pos.remaining * price < 1.0


def run(symbol: str, raw: pd.DataFrame, cfg: dict, trade_from: pd.Timestamp | None = None,
        btc_raw: pd.DataFrame | None = None, pre: pd.DataFrame | None = None) -> Result:
    """Tek coin testi. trade_from verilirse öncesi sadece gösterge ısınması için kullanılır."""
    df = pre if pre is not None else precompute(symbol, raw, cfg, btc_raw)
    fee = cfg["exchange"]["fee_rate"] + cfg["exchange"]["slippage"]
    th = cfg["analysis"]["buy_threshold"]
    res = Result(symbol)
    pos: Position | None = None
    equity = 0.0
    for i in range(210, len(df)):
        bar, ts = df.iloc[i], df.index[i]
        now = ts.timestamp()
        if pos is not None:
            for price, frac, reason in bar_exits(pos, bar, now, bar["score"], cfg):
                if _sell(pos, price, frac, fee):
                    pos.closed_at = now
                    equity += pos.realized - pos.cost
                    res.trades.append(_trade_record(pos, price, reason))
                    pos = None
                    break
        elif not bar["veto"] and bar["score"] >= th and (trade_from is None or ts >= trade_from):
            stake = risk.stake_for(bar["score"], cfg)
            entry = bar["close"] * (1 + fee)
            pos = Position(symbol, entry, stake / entry, stake, now, bar["score"], stop_price=risk.initial_stop(entry, cfg))
        res.equity.append(equity + (pos.pnl(bar["close"]) if pos else 0.0))
    if pos is not None:
        price = df["close"].iloc[-1]
        _sell(pos, price, 1.0, fee)
        pos.closed_at = df.index[-1].timestamp()
        res.trades.append(_trade_record(pos, price, "test sonu"))
    return res


def run_portfolio(pres: dict[str, pd.DataFrame], cfg: dict, start: pd.Timestamp, end: pd.Timestamp) -> Result:
    """Canlı bot gibi tüm coinler aynı kasada: en fazla N açık pozisyon ve toplam risk limiti.
    Her saat önce çıkışlar, sonra en yüksek skorlu adaylardan alım."""
    p = cfg["position"]
    fee = cfg["exchange"]["fee_rate"] + cfg["exchange"]["slippage"]
    th = cfg["analysis"]["buy_threshold"]
    # Hız için: her coin için zaman -> satır sözlüğü (pandas .loc yerine)
    rows = {}
    for sym, d in pres.items():
        recs = d[["open", "high", "low", "close", "score", "veto"]].to_dict("records")
        rows[sym] = {ts: recs[i] for i, ts in enumerate(d.index) if start <= ts <= end}
    index = sorted(set().union(*[r.keys() for r in rows.values()]))
    res = Result("PORTFÖY")
    open_pos: dict[str, Position] = {}
    last_close: dict[str, float] = {}
    realized = 0.0
    for ts in index:
        now = ts.timestamp()
        for sym in list(open_pos):
            bar = rows[sym].get(ts)
            if bar is None:
                continue
            pos = open_pos[sym]
            for price, frac, reason in bar_exits(pos, bar, now, bar["score"], cfg):
                if _sell(pos, price, frac, fee):
                    pos.closed_at = now
                    realized += pos.realized - pos.cost
                    res.trades.append(_trade_record(pos, price, reason))
                    del open_pos[sym]
                    break
        cands = []
        for sym, r in rows.items():
            bar = r.get(ts)
            if bar is None:
                continue
            last_close[sym] = bar["close"]
            if sym not in open_pos and not bar["veto"] and bar["score"] >= th:
                cands.append((bar["score"], sym, bar["close"]))
        for score, sym, close in sorted(cands, reverse=True):
            stake = risk.stake_for(score, cfg)
            if len(open_pos) >= p["max_open_positions"] or sum(x.cost for x in open_pos.values()) + stake > p["max_total_exposure_usd"]:
                break
            entry = close * (1 + fee)
            open_pos[sym] = Position(sym, entry, stake / entry, stake, now, score, stop_price=risk.initial_stop(entry, cfg))
        res.equity.append(realized + sum(x.pnl(last_close[s]) for s, x in open_pos.items()))
    for sym, pos in open_pos.items():
        price = last_close[sym]
        _sell(pos, price, 1.0, fee)
        pos.closed_at = end.timestamp()
        res.trades.append(_trade_record(pos, price, "test sonu"))
    return res


def load_file(path: str) -> pd.DataFrame:
    """Elle indirilen veriyi okur:
    - Binance API cevabı (JSON dizi: /api/v3/klines), metin olarak yapıştırılmış hali dahil
    - data.binance.vision CSV / ZIP (başlıksız, zaman ms veya µs)
    - Başlıklı CSV: ts,open,high,low,close,volume
    """
    import io
    import json
    import zipfile
    raw = open(path, "rb").read()
    if raw[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            raw = z.read(z.namelist()[0])
    text = raw.decode("utf-8-sig").strip()
    start = text.find("[[")
    if start != -1:
        rows = json.loads(text[start: text.rfind("]]") + 2])
    else:
        rows = []
        for line in text.splitlines():
            parts = line.replace(";", ",").split(",")
            try:
                rows.append([float(x) for x in parts[:6]])
            except ValueError:
                continue  # başlık satırı
    rows = [[float(x) for x in r[:6]] for r in rows]
    for r in rows:
        while r[0] > 1e14:  # µs / ns -> ms
            r[0] /= 1000
    uniq = {r[0]: r for r in rows}
    return ohlcv_to_df([uniq[k] for k in sorted(uniq)])


def warmup_days(timeframe: str, hours: float) -> float:
    """Son `hours` saati test etmek için gereken veri (EMA200 ısınması için +220 mum)."""
    return (hours * 3_600_000 + 220 * TF_MS[timeframe]) / 86_400_000


@dataclass
class Summary:
    results: list[Result]

    @property
    def trades(self) -> list[dict]:
        return [t for r in self.results for t in r.trades]

    @property
    def pnl(self) -> float:
        return sum(t["pnl"] for t in self.trades)

    @property
    def profit_factor(self) -> float:
        win = sum(t["pnl"] for t in self.trades if t["pnl"] > 0)
        loss = -sum(t["pnl"] for t in self.trades if t["pnl"] <= 0)
        return win / loss if loss else (float("inf") if win else 0.0)

    @property
    def invested(self) -> float:
        return sum(abs(t["pnl"] / t["pct"] * 100) for t in self.trades if t["pct"])

    def is_high(self, cfg: dict) -> bool:
        b = cfg["backtest"]
        return (len(self.trades) >= b["min_trades"] and self.pnl > 0 and self.profit_factor >= b["good_profit_factor"]
                and self.invested and self.pnl / self.invested * 100 >= b["good_return_pct"])

    def report(self) -> str:
        n = len(self.trades)
        if not n:
            return "TOPLAM: hiç işlem açılmadı."
        wins = sum(1 for t in self.trades if t["pnl"] > 0)
        ret = self.pnl / self.invested * 100 if self.invested else 0
        return (f"TOPLAM: {len(self.results)} coin · {n} işlem · kazanan %{wins/n*100:.0f} · net {self.pnl:+.2f} $ "
                f"(yatırılana göre %{ret:+.1f}) · kâr faktörü {self.profit_factor:.2f}")
