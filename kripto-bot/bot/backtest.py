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
    since = int(time.time() * 1000) - days * 86_400_000
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


def run(symbol: str, raw: pd.DataFrame, cfg: dict) -> Result:
    df = add_indicators(raw)
    fee = cfg["exchange"]["fee_rate"] + cfg["exchange"]["slippage"]
    res = Result(symbol)
    pos: Position | None = None
    equity = 0.0

    def close_part(price, fraction, reason, ts):
        nonlocal pos, equity
        amt = pos.remaining * fraction
        pos.remaining -= amt
        pos.realized += amt * price * (1 - fee)
        pos.exit_reasons.append(reason)
        if pos.remaining * price < 1.0:
            pos.closed_at = ts.timestamp()
            pnl = pos.realized - pos.cost
            equity += pnl
            res.trades.append({"open": pd.Timestamp(pos.opened_at, unit="s", tz="UTC"), "entry": pos.entry_price, "exit": price,
                               "score": pos.entry_score, "pnl": pnl, "pct": pnl / pos.cost * 100, "reason": reason,
                               "hours": (pos.closed_at - pos.opened_at) / 3600, "max_multiple": pos.highest_price / pos.entry_price})
            pos = None

    for i in range(210, len(df)):
        bar, ts = df.iloc[i], df.index[i]
        now = ts.timestamp()
        if pos is not None:
            if bar["low"] <= pos.stop_price:
                close_part(min(bar["open"], pos.stop_price), 1.0, "iz süren stop" if pos.stop_price > pos.entry_price else "zarar kes", ts)
            else:
                ladder, hits_before = cfg["exits"]["take_profit"], pos.tp_hits
                for k, a in enumerate(risk.exit_actions(pos, bar["high"], now, None, cfg)):
                    if pos is None:
                        break
                    close_part(pos.entry_price * ladder[hits_before + k]["multiple"], a.fraction, a.reason, ts)
                if pos is not None:
                    score = decide(symbol, df, cfg, i=i).score
                    for a in risk.exit_actions(pos, bar["close"], now, score, cfg):
                        if pos is None:
                            break
                        close_part(bar["close"], a.fraction, a.reason, ts)
        else:
            d = decide(symbol, df, cfg, i=i)
            if d.verdict == "AL":
                stake = risk.stake_for(d.score, cfg)
                entry = bar["close"] * (1 + fee)
                pos = Position(symbol, entry, stake / entry, stake, now, d.score, stop_price=risk.initial_stop(entry, cfg))
        res.equity.append(equity + (pos.pnl(bar["close"]) if pos else 0.0))
    if pos is not None:
        close_part(df["close"].iloc[-1], 1.0, "test sonu", df.index[-1])
    return res
