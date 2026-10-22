"""Alım öncesi artı/eksi analizi.

Her etken bir `Factor` üretir: pozitif puan = artı, negatif puan = eksi.
Üç blok ayrı ayrı -100..+100 aralığına normalize edilir, ardından ağırlıklarla birleşir:
  teknik (gösterge) + haber (duygu) + piyasa (BTC, korku/açgözlülük, likidite)
"Veto" ise skor ne olursa olsun alımı engelleyen kırmızı bayraktır (hack haberi, BTC çöküşü, aşırı spread...).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd


@dataclass
class Factor:
    group: str      # technical | news | market
    name: str
    points: float   # bu etkenin verdiği puan
    max_points: float  # bu etkenin alabileceği en yüksek mutlak puan
    note: str

    @property
    def is_pro(self) -> bool:
        return self.points > 0


@dataclass
class Decision:
    symbol: str
    price: float
    score: float                       # -100..+100
    verdict: str                       # AL | BEKLE | UZAK DUR
    group_scores: dict[str, float]
    factors: list[Factor] = field(default_factory=list)
    vetoes: list[str] = field(default_factory=list)
    news_items: list[dict] = field(default_factory=list)
    metrics: dict[str, float] = field(default_factory=dict)

    @property
    def pros(self) -> list[Factor]:
        return sorted([f for f in self.factors if f.points > 0], key=lambda f: -f.points)

    @property
    def cons(self) -> list[Factor]:
        return sorted([f for f in self.factors if f.points < 0], key=lambda f: f.points)

    def summary(self) -> str:
        return (f"{self.symbol} skor={self.score:+.1f} karar={self.verdict} "
                f"(teknik {self.group_scores.get('technical', 0):+.0f} / haber {self.group_scores.get('news', 0):+.0f}"
                f" / piyasa {self.group_scores.get('market', 0):+.0f})"
                + (f" VETO: {'; '.join(self.vetoes)}" if self.vetoes else ""))


def _f(group, name, points, max_points, note):
    return Factor(group, name, round(float(points), 2), float(max_points), note)


def technical_factors(df: pd.DataFrame, i: int = -1) -> list[Factor]:
    """İndikatör eklenmiş df'nin i. mumu için teknik etkenler."""
    r = df.iloc[i]
    prev = df.iloc[i - 1] if len(df) > 1 else r
    out: list[Factor] = []
    close = r["close"]

    # 1) Ana trend
    if close > r["ema50"] > r["ema200"]:
        out.append(_f("technical", "Ana trend", 15, 15, "Fiyat > EMA50 > EMA200: yükselen trend"))
    elif close < r["ema50"] < r["ema200"]:
        out.append(_f("technical", "Ana trend", -15, 15, "Fiyat < EMA50 < EMA200: düşen trend"))
    elif close > r["ema200"]:
        out.append(_f("technical", "Ana trend", 5, 15, "Fiyat EMA200 üstünde ama trend net değil"))
    else:
        out.append(_f("technical", "Ana trend", -5, 15, "Fiyat EMA200 altında"))

    # 2) Kısa vade trend
    if r["ema20"] > r["ema50"]:
        out.append(_f("technical", "Kısa trend", 8, 8, "EMA20 > EMA50"))
    else:
        out.append(_f("technical", "Kısa trend", -8, 8, "EMA20 < EMA50"))

    # 3) RSI
    rsi = r["rsi"]
    if rsi > 78:
        out.append(_f("technical", "RSI", -15, 15, f"RSI {rsi:.0f}: aşırı alım, geç kalınmış olabilir"))
    elif rsi > 68:
        out.append(_f("technical", "RSI", -4, 15, f"RSI {rsi:.0f}: ısınmış"))
    elif rsi >= 48:
        out.append(_f("technical", "RSI", 10, 15, f"RSI {rsi:.0f}: sağlıklı momentum"))
    elif rsi < 30:
        pts = 6 if rsi > prev["rsi"] else -4
        out.append(_f("technical", "RSI", pts, 15, f"RSI {rsi:.0f}: aşırı satım" + (" ve dönüyor" if pts > 0 else ", düşüş sürüyor")))
    else:
        out.append(_f("technical", "RSI", 0, 15, f"RSI {rsi:.0f}: nötr"))

    # 4) MACD histogram
    h, ph = r["macd_hist"], prev["macd_hist"]
    if h > 0 and h > ph:
        out.append(_f("technical", "MACD", 10, 10, "MACD histogramı pozitif ve büyüyor"))
    elif h > 0:
        out.append(_f("technical", "MACD", 4, 10, "MACD pozitif ama zayıflıyor"))
    elif h < 0 and h < ph:
        out.append(_f("technical", "MACD", -10, 10, "MACD negatif ve derinleşiyor"))
    else:
        out.append(_f("technical", "MACD", -3, 10, "MACD negatif ama toparlanıyor"))

    # 5) Hacim teyidi
    vr = r["vol_ratio"]
    if not math.isnan(vr):
        if vr > 1.8 and r["green"]:
            out.append(_f("technical", "Hacim", 10, 10, f"Yeşil mumda {vr:.1f}x hacim: alıcı ilgisi"))
        elif vr > 1.8:
            out.append(_f("technical", "Hacim", -8, 10, f"Kırmızı mumda {vr:.1f}x hacim: satış baskısı"))
        elif vr < 0.5:
            out.append(_f("technical", "Hacim", -4, 10, f"Hacim ortalamanın yarısı ({vr:.1f}x): ilgi yok"))
        else:
            out.append(_f("technical", "Hacim", 1, 10, f"Hacim normal ({vr:.1f}x)"))

    # 6) ADX trend gücü
    if r["adx"] > 25:
        if r["plus_di"] > r["minus_di"]:
            out.append(_f("technical", "ADX", 8, 8, f"ADX {r['adx']:.0f}: güçlü yükseliş trendi"))
        else:
            out.append(_f("technical", "ADX", -8, 8, f"ADX {r['adx']:.0f}: güçlü düşüş trendi"))
    else:
        out.append(_f("technical", "ADX", 0, 8, f"ADX {r['adx']:.0f}: trendsiz/yatay"))

    # 7) Bollinger: sıkışma kırılımı / aşırı uzama
    pb = r["bb_pct_b"]
    if not math.isnan(pb):
        if bool(prev["bb_squeeze"]) and pb > 0.8 and r["green"]:
            out.append(_f("technical", "Bollinger", 8, 8, "Sıkışmadan yukarı kırılım"))
        elif pb > 1.05:
            out.append(_f("technical", "Bollinger", -5, 8, "Üst bandın belirgin dışında: aşırı uzamış"))
        elif pb < 0:
            out.append(_f("technical", "Bollinger", -2, 8, "Alt bandın altında"))
        else:
            out.append(_f("technical", "Bollinger", 0, 8, f"%B {pb:.2f}"))

    # 8) Momentum (24 mum)
    roc = r["roc24"]
    if not math.isnan(roc):
        if roc > 0.05:
            out.append(_f("technical", "Momentum", 6, 8, f"Son 24 mumda %{roc*100:.1f}"))
        elif roc < -0.10:
            out.append(_f("technical", "Momentum", -8, 8, f"Son 24 mumda %{roc*100:.1f}: düşüş"))
        else:
            out.append(_f("technical", "Momentum", 0, 8, f"Son 24 mumda %{roc*100:.1f}"))

    # 9) Volatilite: 2-3x hedefi için hareket alanı gerekir, ama aşırısı risk
    ap = r["atr_pct"]
    if ap > 0.12:
        out.append(_f("technical", "Volatilite", -6, 6, f"ATR %{ap*100:.1f}: aşırı oynak"))
    elif ap > 0.02:
        out.append(_f("technical", "Volatilite", 5, 6, f"ATR %{ap*100:.1f}: hedef için yeterli hareket"))
    else:
        out.append(_f("technical", "Volatilite", -2, 6, f"ATR %{ap*100:.1f}: çok durgun, 2-3x zor"))

    # 10) OBV: hacim fiyatı destekliyor mu
    if r["obv_slope"] > 0 and close > prev["close"]:
        out.append(_f("technical", "OBV", 5, 5, "OBV yükseliyor: birikim"))
    elif r["obv_slope"] < 0:
        out.append(_f("technical", "OBV", -5, 5, "OBV düşüyor: dağıtım"))

    # 11) Direnç yakınlığı
    if close >= r["high_50"] * 0.995:
        out.append(_f("technical", "Zirve", 4, 6, "50 mumun zirvesinde/kırılımında"))
    elif r["high_50"] > 0 and (r["high_50"] - close) / close < 0.02:
        out.append(_f("technical", "Zirve", -3, 6, "Dirence %2'den yakın, takılabilir"))
    return out


def normalize(factors: list[Factor]) -> float:
    cap = sum(f.max_points for f in factors)
    return 0.0 if cap == 0 else max(-100.0, min(100.0, 100 * sum(f.points for f in factors) / cap))


def market_factors(ctx: dict, symbol: str, ticker: Optional[dict], spread_pct: Optional[float], cfg: dict) -> tuple[list[Factor], list[str]]:
    """Genel piyasa ve likidite. ctx: {'btc_change_24h', 'btc_trend_up', 'fear_greed'}"""
    out, vetoes = [], []
    a = cfg["analysis"]
    btc = ctx.get("btc_change_24h")
    if btc is not None:
        if btc <= a["btc_dump_veto_pct"]:
            vetoes.append(f"BTC 24s %{btc:.1f}: piyasa çöküşte")
        elif btc < -2:
            out.append(_f("market", "BTC", -8, 10, f"BTC 24s %{btc:.1f}"))
        elif btc > 2:
            out.append(_f("market", "BTC", 6, 10, f"BTC 24s +%{btc:.1f}"))
        else:
            out.append(_f("market", "BTC", 1, 10, f"BTC 24s %{btc:.1f}: sakin"))
    if ctx.get("btc_trend_up") is not None:
        out.append(_f("market", "BTC trendi", 6 if ctx["btc_trend_up"] else -6, 6,
                      "BTC EMA50 üstünde" if ctx["btc_trend_up"] else "BTC EMA50 altında"))
    fg = ctx.get("fear_greed")
    if fg is not None:
        if fg >= 80:
            out.append(_f("market", "Korku/Açgözlülük", -8, 8, f"Endeks {fg}: aşırı açgözlülük, tepe riski"))
        elif fg <= 20:
            out.append(_f("market", "Korku/Açgözlülük", 5, 8, f"Endeks {fg}: aşırı korku, tersine fırsat"))
        elif fg >= 55:
            out.append(_f("market", "Korku/Açgözlülük", 3, 8, f"Endeks {fg}: iyimser"))
        else:
            out.append(_f("market", "Korku/Açgözlülük", -1, 8, f"Endeks {fg}"))
    if ticker:
        qv = ticker.get("quoteVolume") or 0
        if qv >= 50_000_000:
            out.append(_f("market", "Likidite", 5, 5, f"24s hacim {qv/1e6:.0f}M $"))
        elif qv < cfg["universe"]["min_quote_volume_24h"]:
            out.append(_f("market", "Likidite", -5, 5, f"24s hacim düşük: {qv/1e6:.1f}M $"))
        else:
            out.append(_f("market", "Likidite", 2, 5, f"24s hacim {qv/1e6:.0f}M $"))
        chg = ticker.get("percentage")
        if chg is not None and chg > 40:
            out.append(_f("market", "24s pompa", -8, 8, f"24s +%{chg:.0f}: pompanın tepesine binme riski"))
    if spread_pct is not None:
        if spread_pct > a["max_spread_pct"]:
            vetoes.append(f"Spread %{spread_pct*100:.2f}: çok geniş")
        else:
            out.append(_f("market", "Spread", 2, 2, f"Spread %{spread_pct*100:.2f}"))
    return out, vetoes


def news_factors(news: dict) -> tuple[list[Factor], list[str]]:
    """news: news.NewsAnalyzer.analyze çıktısı."""
    out, vetoes = [], []
    if news.get("red_flags"):
        vetoes.extend(f"Haber: {t}" for t in news["red_flags"])
    n = news.get("count", 0)
    s = news.get("score", 0.0)  # -1..+1
    if n == 0:
        out.append(_f("news", "Haber akışı", 0, 20, "Coin hakkında güncel haber yok"))
    else:
        out.append(_f("news", "Haber duygusu", 20 * s, 20, f"{n} haber, ortalama duygu {s:+.2f}"))
        if n >= 5 and s > 0.2:
            out.append(_f("news", "Gündem", 5, 5, f"Gündemde ({n} haber) ve olumlu"))
    return out, vetoes


def decide(symbol: str, df: pd.DataFrame, cfg: dict, market_ctx: dict | None = None, ticker: dict | None = None,
           spread_pct: float | None = None, news: dict | None = None, i: int = -1) -> Decision:
    w = cfg["analysis"]["weights"]
    tech = technical_factors(df, i)
    mkt, mkt_veto = market_factors(market_ctx or {}, symbol, ticker, spread_pct, cfg)
    nws, nws_veto = news_factors(news or {}) if news is not None else ([], [])

    groups = {"technical": normalize(tech), "market": normalize(mkt), "news": normalize(nws)}
    # Bilgisi olmayan bloğun ağırlığı diğerlerine dağıtılır.
    active = {"technical": True, "market": bool(mkt), "news": bool(nws) and (news or {}).get("count", 0) > 0}
    total_w = sum(w[k] for k, on in active.items() if on)
    score = sum(groups[k] * w[k] for k, on in active.items() if on) / total_w

    vetoes = mkt_veto + nws_veto
    r = df.iloc[i]
    if r["rsi"] > cfg["analysis"]["rsi_veto"]:
        vetoes.append(f"RSI {r['rsi']:.0f}: aşırı alım")

    threshold = cfg["analysis"]["buy_threshold"]
    if vetoes:
        verdict = "UZAK DUR"
    elif score >= threshold:
        verdict = "AL"
    elif score <= -threshold / 2:
        verdict = "UZAK DUR"
    else:
        verdict = "BEKLE"

    metrics = {k: float(r[k]) for k in ("close", "rsi", "macd_hist", "adx", "atr_pct", "vol_ratio", "bb_pct_b", "roc24", "ema20", "ema50", "ema200") if k in r}
    return Decision(symbol=symbol, price=float(r["close"]), score=round(score, 1), verdict=verdict,
                    group_scores={k: round(v, 1) for k, v in groups.items()}, factors=tech + mkt + nws,
                    vetoes=vetoes, news_items=(news or {}).get("items", []), metrics=metrics)
