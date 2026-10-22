"""Teknik göstergeler (sadece pandas/numpy, ek kütüphane gerekmez).

Girdi: open, high, low, close, volume sütunlu DataFrame.
`add_indicators` tüm değişkenleri tek seferde hesaplar; analiz ve backtest aynı sütunları kullanır.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    out = 100 - 100 / (1 + gain / loss.replace(0, np.nan))
    # Hiç düşüş yoksa 100, hiç hareket yoksa 50
    return out.where(loss > 0, np.where(gain > 0, 100.0, 50.0))


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    line = ema(close, fast) - ema(close, slow)
    sig = ema(line, signal)
    return line, sig, line - sig


def true_range(df: pd.DataFrame) -> pd.Series:
    prev = df["close"].shift(1)
    return pd.concat([df["high"] - df["low"], (df["high"] - prev).abs(), (df["low"] - prev).abs()], axis=1).max(axis=1)


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    return true_range(df).ewm(alpha=1 / n, adjust=False).mean()


def adx(df: pd.DataFrame, n: int = 14):
    up = df["high"].diff()
    down = -df["low"].diff()
    plus_dm = np.where((up > down) & (up > 0), up, 0.0)
    minus_dm = np.where((down > up) & (down > 0), down, 0.0)
    tr = true_range(df).ewm(alpha=1 / n, adjust=False).mean()
    plus_di = 100 * pd.Series(plus_dm, index=df.index).ewm(alpha=1 / n, adjust=False).mean() / tr
    minus_di = 100 * pd.Series(minus_dm, index=df.index).ewm(alpha=1 / n, adjust=False).mean() / tr
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    return dx.ewm(alpha=1 / n, adjust=False).mean().fillna(0), plus_di.fillna(0), minus_di.fillna(0)


def bollinger(close: pd.Series, n: int = 20, k: float = 2.0):
    mid = close.rolling(n).mean()
    std = close.rolling(n).std(ddof=0)
    upper, lower = mid + k * std, mid - k * std
    pct_b = (close - lower) / (upper - lower).replace(0, np.nan)
    width = (upper - lower) / mid
    return upper, mid, lower, pct_b, width


def obv(df: pd.DataFrame) -> pd.Series:
    direction = np.sign(df["close"].diff()).fillna(0)
    return (direction * df["volume"]).cumsum()


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    c = df["close"]
    df["ema20"], df["ema50"], df["ema200"] = ema(c, 20), ema(c, 50), ema(c, 200)
    df["rsi"] = rsi(c, 14)
    df["macd"], df["macd_signal"], df["macd_hist"] = macd(c)
    df["atr"] = atr(df, 14)
    df["atr_pct"] = df["atr"] / c
    df["adx"], df["plus_di"], df["minus_di"] = adx(df, 14)
    df["bb_upper"], df["bb_mid"], df["bb_lower"], df["bb_pct_b"], df["bb_width"] = bollinger(c)
    # Sıkışma: bant genişliği son 100 mumun en dar %20'lik diliminde mi
    df["bb_squeeze"] = df["bb_width"] <= df["bb_width"].rolling(100, min_periods=30).quantile(0.2)
    df["vol_ratio"] = df["volume"] / df["volume"].rolling(20).mean()
    df["roc24"] = c.pct_change(24)
    df["obv"] = obv(df)
    df["obv_slope"] = df["obv"].diff(10)
    df["high_50"] = df["high"].rolling(50).max()
    df["low_50"] = df["low"].rolling(50).min()
    df["green"] = c > df["open"]
    return df


def ohlcv_to_df(rows: list[list]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["ts", "open", "high", "low", "close", "volume"])
    df["ts"] = pd.to_datetime(df["ts"], unit="ms", utc=True)
    return df.set_index("ts").astype(float)
