import sys
import time
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot.config import load_config  # noqa: E402


def make_ohlcv(n=400, start=1.0, drift=0.002, vol=0.01, seed=1, step_ms=3_600_000):
    rng = np.random.default_rng(seed)
    t0 = int(time.time() * 1000) - n * step_ms
    price, rows = start, []
    for i in range(n):
        o = price
        c = o * (1 + drift + rng.normal(0, vol))
        h, l = max(o, c) * (1 + abs(rng.normal(0, vol / 2))), min(o, c) * (1 - abs(rng.normal(0, vol / 2)))
        rows.append([t0 + i * step_ms, o, h, l, c, 1000 * (1 + abs(rng.normal(0, 0.3)))])
        price = c
    return rows


class FakeMarket:
    """Testler için borsa: sabit mum dizisi + ayarlanabilir fiyat."""

    def __init__(self, series: dict[str, list[list]]):
        self.series = series
        self.prices = {s: rows[-1][4] for s, rows in series.items()}

    def fetch_ohlcv(self, symbol, timeframe, limit):
        return self.series[symbol][-limit:]

    def fetch_tickers(self):
        return {s: self.fetch_ticker(s) for s in self.series}

    def fetch_ticker(self, symbol):
        p = self.prices[symbol]
        return {"symbol": symbol, "last": p, "bid": p, "ask": p, "quoteVolume": 20_000_000, "percentage": 1.0}

    def spread_pct(self, symbol):
        return 0.001

    def min_cost(self, symbol):
        return 5.0


class NoNews:
    def analyze(self, base):
        return {"count": 0, "score": 0.0, "red_flags": [], "items": []}

    def fear_greed(self):
        return 50


@pytest.fixture
def cfg(tmp_path):
    c = load_config(tmp_path / "yok.yaml", overrides={"state_dir": str(tmp_path / "state"),
                                                       "obsidian": {"vault_path": str(tmp_path / "vault")}})
    c["secrets"] = {k: "" for k in c["secrets"]}
    c["mode"] = "paper"
    return c
