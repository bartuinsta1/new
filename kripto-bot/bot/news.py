"""Haber ve duygu analizi.

Kaynaklar: RSS akışları, CryptoPanic (opsiyonel token), Korku & Açgözlülük endeksi.
Duygu: varsayılan olarak anahtar kelime sözlüğü (TR + EN); `news.llm.enabled` ise Claude ile.
Kırmızı bayrak (hack, delist, dava...) içeren haber alımı veto eder.
"""
from __future__ import annotations

import calendar
import hashlib
import json
import logging
import math
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Callable, Optional

import requests

log = logging.getLogger(__name__)

POSITIVE = {
    # EN
    "surge": 2, "soar": 2, "rally": 2, "breakout": 2, "all-time high": 2, "ath": 1, "record high": 2,
    "partnership": 2, "partners with": 2, "listing": 2, "lists": 1, "listed on": 2, "launch": 1, "launches": 1,
    "upgrade": 1, "mainnet": 2, "approval": 2, "approved": 2, "etf": 1, "adoption": 2, "integrates": 1,
    "bullish": 2, "gains": 1, "jumps": 2, "climbs": 1, "inflows": 2, "accumulate": 1, "buyback": 2,
    "burn": 1, "airdrop": 1, "rebound": 1, "rebounds": 1, "recovers": 1, "surpasses": 1, "breaks above": 2, "institutional": 1, "invest": 1, "raises": 1, "funding": 1, "outperform": 1,
    # TR
    "yükseliş": 2, "rekor": 2, "ortaklık": 2, "listelendi": 2, "onaylandı": 2, "yükseldi": 1, "fırladı": 2,
    "boğa": 2, "yatırım": 1, "entegrasyon": 1, "güncelleme": 1,
}
NEGATIVE = {
    "plunge": -2, "crash": -2, "dump": -2, "slump": -2, "tumble": -2, "falls": -1, "drops": -1, "sinks": -2,
    "bearish": -2, "outflows": -2, "sell-off": -2, "selloff": -2, "liquidation": -1, "liquidations": -1,
    "investigation": -2, "probe": -2, "fine": -1, "fined": -2, "warning": -1, "concern": -1, "delay": -1,
    "delayed": -1, "outage": -2, "downtime": -2, "unlock": -1, "token unlock": -2, "whale sells": -2,
    "slides": -1, "slips": -1, "under pressure": -1, "declines": -1, "breaks below": -2, "falls below": -2,
    "düşüş": -2, "çöktü": -2, "soruşturma": -2, "ceza": -2, "uyarı": -1, "satış baskısı": -2, "ayı": -1,
}
RED_FLAGS = [
    "hack", "hacked", "exploit", "exploited", "drained", "rug pull", "rugpull", "rug-pull", "scam", "fraud",
    "delist", "delisting", "delisted", "sec sues", "sec charges", "lawsuit", "sued", "bankrupt", "bankruptcy",
    "insolvent", "halts withdrawals", "suspends withdrawals", "withdrawals paused", "depeg", "ponzi",
    "arrested", "attack", "vulnerability", "stolen",
    "hacklendi", "dolandırıcılık", "listeden çıkarıl", "iflas", "çekimler durduruldu", "dava açtı", "çalındı",
]

# Kısa tickerlarda yanlış eşleşmeyi önlemek için tam isimler
NAMES = {
    "BTC": ["bitcoin"], "ETH": ["ethereum", "ether"], "SOL": ["solana"], "XRP": ["ripple", "xrp"],
    "BNB": ["binance coin", "bnb chain"], "DOGE": ["dogecoin"], "ADA": ["cardano"], "AVAX": ["avalanche"],
    "DOT": ["polkadot"], "LINK": ["chainlink"], "MATIC": ["polygon"], "POL": ["polygon"], "TON": ["toncoin"],
    "SHIB": ["shiba inu"], "PEPE": ["pepe"], "WIF": ["dogwifhat"], "BONK": ["bonk"], "SUI": ["sui network"],
    "APT": ["aptos"], "ARB": ["arbitrum"], "OP": ["optimism"], "NEAR": ["near protocol"], "INJ": ["injective"],
    "TIA": ["celestia"], "SEI": ["sei network"], "FET": ["fetch.ai", "artificial superintelligence"],
    "RNDR": ["render"], "RENDER": ["render network"], "TRX": ["tron"], "LTC": ["litecoin"], "ATOM": ["cosmos"],
    "FLOKI": ["floki"], "JUP": ["jupiter"], "PYTH": ["pyth"], "ENA": ["ethena"], "WLD": ["worldcoin"],
    "HBAR": ["hedera"], "UNI": ["uniswap"], "AAVE": ["aave"], "TAO": ["bittensor"], "ONDO": ["ondo"],
}

GENERIC_MARKET_WORDS = ["crypto market", "cryptocurrency market", "kripto piyasa"]


# Borsa duyuruları: fiyatı en sert etkileyen haberler (listeleme = pompa, delist = çöküş)
ANNOUNCEMENT_FEEDS = {
    "binance-listeleme": "https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=48&pageNo=1&pageSize=20",
    "binance-delist": "https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=161&pageNo=1&pageSize=20",
    "upbit": "https://api-manager.upbit.com/api/v1/announcements?os=web&page=1&per_page=20&category=trade",
}
NOT_TICKERS = {"BINANCE", "WILL", "LIST", "ADD", "AND", "ON", "THE", "FOR", "USDT", "USDC", "FDUSD", "TRY", "EUR", "BTC",
               "BNB", "KRW", "SPOT", "MARGIN", "FUTURES", "USD", "USDⓈ", "PERPETUAL", "CONTRACT", "TRADING", "PAIRS", "OF",
               "NEW", "SEED", "TAG", "ALPHA", "EARN", "HODLER", "AIRDROPS", "DELIST", "DELISTING", "NOTICE", "UTC", "AM", "PM"}
LISTING_WORDS = ["will list", "will add", "will launch", "listing", "new cryptocurrency", "디지털 자산 추가", "신규 거래지원", "마켓 추가"]
DELIST_WORDS = ["delist", "will remove", "cease trading", "거래지원 종료", "유의 종목", "유의종목"]


def extract_tickers(title: str) -> list[str]:
    """Duyuru başlığından coin sembolleri: önce parantez içi, yoksa büyük harfli kelimeler."""
    found = re.findall(r"\(([A-Z0-9]{2,12})\)", title)
    if not found:
        found = [t for t in re.findall(r"\b[A-Z][A-Z0-9]{1,11}\b", title) if t not in NOT_TICKERS]
    found = [re.sub(r"(USDT|USDC|FDUSD)$", "", t) if len(t) > 6 and re.search(r"(USDT|USDC|FDUSD)$", t) else t for t in found]
    return list(dict.fromkeys(t for t in found if t and t not in NOT_TICKERS))


def _now() -> float:
    return time.time()


def mentions(text: str, base: str) -> bool:
    if f"${base}" in text:
        return True
    # Kısa tickerlar (OP, AI, ONE...) sıradan kelimelerle karışmasın diye sadece büyük harf ve 3+ karakter
    if len(base) >= 3 and re.search(rf"(?<![A-Za-z0-9]){re.escape(base)}(?![A-Za-z0-9])", text):
        return True
    low = text.lower()
    return any(re.search(rf"\b{re.escape(n)}\b", low) for n in NAMES.get(base, []))


def lexicon_score(text: str) -> tuple[float, list[str]]:
    low = text.lower()
    total, hits = 0.0, []
    for lex in (POSITIVE, NEGATIVE):
        for word, w in lex.items():
            if re.search(rf"(?<![a-zçğıöşü]){re.escape(word)}", low):
                total += w
                hits.append(word)
    flags = [w for w in RED_FLAGS if re.search(rf"(?<![a-zçğıöşü]){re.escape(w)}", low)]
    return max(-1.0, min(1.0, total / 4.0)), flags


def _parse_time(value) -> Optional[float]:
    if not value:
        return None
    try:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, time.struct_time):
            return float(calendar.timegm(value))
        try:
            return parsedate_to_datetime(value).timestamp()
        except (TypeError, ValueError):
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


class NewsAnalyzer:
    def __init__(self, cfg: dict, http_get: Callable | None = None, llm_client=None):
        self.cfg = cfg
        self.ncfg = cfg["news"]
        self.secrets = cfg.get("secrets", {})
        self.get = http_get or (lambda url, **kw: requests.get(url, timeout=10, headers={"User-Agent": "kripto-bot/1.0"}, **kw))
        self._feed_cache: tuple[float, list[dict]] | None = None
        self._ann_cache: tuple[float, list[dict]] | None = None
        self._seen: set[str] = set()
        self._watch_since = _now() - 15 * 60  # ilk turda son 15 dakikanın haberlerini de değerlendir
        self._llm_cache: dict[str, dict] = {}
        self._llm = llm_client
        if self._llm is None and self.ncfg["llm"]["enabled"] and self.secrets.get("anthropic_api_key"):
            import anthropic
            self._llm = anthropic.Anthropic(api_key=self.secrets["anthropic_api_key"])

    # ---------- kaynaklar ----------
    def fetch_rss(self) -> list[dict]:
        if self._feed_cache and _now() - self._feed_cache[0] < max(20, self.ncfg.get("poll_seconds", 60) - 5):
            return self._feed_cache[1]
        import feedparser
        items = []
        for url in self.ncfg["rss_feeds"]:
            try:
                resp = self.get(url)
                feed = feedparser.parse(resp.content)
                for e in feed.entries[:60]:
                    items.append({
                        "title": e.get("title", ""),
                        "summary": re.sub(r"<[^>]+>", " ", e.get("summary", ""))[:400],
                        "url": e.get("link", ""),
                        "ts": _parse_time(e.get("published_parsed") or e.get("published")) or _now(),
                        "source": url.split("/")[2],
                    })
            except Exception as exc:  # bir kaynağın düşmesi botu durdurmamalı
                log.warning("RSS okunamadı %s: %s", url, exc)
        self._feed_cache = (_now(), items)
        return items

    def fetch_cryptopanic(self, base: str) -> list[dict]:
        token = self.secrets.get("cryptopanic_token")
        if not (self.ncfg.get("cryptopanic") and token):
            return []
        try:
            resp = self.get(f"https://cryptopanic.com/api/developer/v2/posts/?auth_token={token}&currencies={base}&public=true")
            data = resp.json()
        except Exception as exc:
            log.warning("CryptoPanic okunamadı: %s", exc)
            return []
        out = []
        for p in data.get("results", [])[:30]:
            votes = p.get("votes") or {}
            out.append({
                "title": p.get("title", ""), "summary": p.get("description", "") or "",
                "url": p.get("url", "") or p.get("original_url", ""), "ts": _parse_time(p.get("published_at")) or _now(),
                "source": "cryptopanic", "votes": {k: votes.get(k, 0) for k in ("positive", "negative", "important", "toxic")},
            })
        return out

    def fetch_cryptopanic_latest(self) -> list[dict]:
        """Coin filtresi olmadan en son haberler (anlık takip için)."""
        token = self.secrets.get("cryptopanic_token")
        if not (self.ncfg.get("cryptopanic") and token):
            return []
        try:
            data = self.get(f"https://cryptopanic.com/api/developer/v2/posts/?auth_token={token}&public=true").json()
        except Exception as exc:
            log.warning("CryptoPanic okunamadı: %s", exc)
            return []
        out = []
        for p in data.get("results", [])[:50]:
            codes = [c.get("code", "") for c in (p.get("instruments") or p.get("currencies") or []) if isinstance(c, dict)]
            # Haberin etiketlediği coinleri başlığa $KOD olarak ekle ki mentions() yakalasın
            out.append({"title": p.get("title", ""), "summary": " ".join(f"${c}" for c in codes),
                        "url": p.get("url", "") or p.get("original_url", ""), "ts": _parse_time(p.get("published_at")) or _now(),
                        "source": "cryptopanic-akış"})
        return out

    def fetch_announcements(self) -> list[dict]:
        """Binance listeleme/delist ve Upbit duyuruları. Her öğede 'kind' (listing/delisting) ve 'coins' bulunur."""
        if not self.ncfg.get("announcements", True):
            return []
        if self._ann_cache and _now() - self._ann_cache[0] < max(20, self.ncfg.get("poll_seconds", 60) - 5):
            return self._ann_cache[1]
        out = []
        for name, url in ANNOUNCEMENT_FEEDS.items():
            try:
                data = self.get(url).json()
            except Exception as exc:
                log.warning("Duyuru okunamadı %s: %s", name, exc)
                continue
            if name.startswith("binance"):
                arts = [a for c in (data.get("data") or {}).get("catalogs", []) for a in c.get("articles", [])]
                rows = [(a.get("title", ""), a.get("releaseDate"), f"https://www.binance.com/en/support/announcement/{a.get('code', '')}") for a in arts]
            else:
                notices = (data.get("data") or {}).get("notices") or (data.get("data") or {}).get("list") or []
                rows = [(n.get("title", ""), n.get("listed_at") or n.get("first_listed_at") or n.get("created_at"),
                         f"https://upbit.com/service_center/notice?id={n.get('id', '')}") for n in notices]
            for title, ts, link in rows:
                low = title.lower()
                kind = "delisting" if any(w in low for w in DELIST_WORDS) else "listing" if any(w in low for w in LISTING_WORDS) else ""
                if not kind:
                    continue
                coins = extract_tickers(title)
                out.append({"title": title, "summary": " ".join(f"${c}" for c in coins), "url": link,
                            "ts": _parse_time(ts / 1000 if isinstance(ts, (int, float)) and ts > 1e12 else ts) or _now(),
                            "source": name, "kind": kind, "coins": coins})
        self._ann_cache = (_now(), out)
        return out

    def item_signal(self, item: dict, base: str) -> tuple[float, list[str]]:
        """Sözlük tabanlı duygu + bayrak; borsa duyurularında kesin kural."""
        if item.get("kind") == "delisting" and base in item.get("coins", []):
            return -1.0, ["borsa delist/uyarı duyurusu"]
        if item.get("kind") == "listing" and base in item.get("coins", []):
            weak = any(w in item["title"].lower() for w in ("futures", "perpetual", "alpha", "earn", "margin"))
            return (0.5 if weak else 0.9), []
        s, flags = lexicon_score(f"{item['title']} {item['summary']}")
        return s, flags

    def new_items(self) -> list[dict]:
        """Daha önce görülmemiş, son taramadan beri yayınlanmış haberler (en yenisi önce)."""
        out = []
        for it in self.fetch_announcements() + self.fetch_rss() + self.fetch_cryptopanic_latest():
            key = (it.get("url") or it["title"]).strip().lower()
            if key in self._seen:
                continue
            self._seen.add(key)
            if it["ts"] >= self._watch_since:
                out.append(it)
        self._watch_since = _now() - 120  # saat farkı / geç yayınlanan RSS için 2 dk pay
        return sorted(out, key=lambda x: -x["ts"])

    def score_item(self, item: dict, base: str) -> tuple[float, list[str]]:
        """Tek haber için duygu (-1..+1) ve kırmızı bayraklar. Claude açıksa onunla."""
        if item.get("kind"):  # borsa duyurusu: yoruma gerek yok
            return self.item_signal(item, base)
        if self._llm:
            llm = self._llm_scores(base, [item])
            if llm:
                d = llm["items"][0]
                return d["sentiment"], ([d.get("reason") or "LLM kırmızı bayrak"] if d["red_flag"] else [])
        s, flags = self.item_signal(item, base)
        # Bayrak sadece başlıkta coin geçiyorsa geçerli (başka projenin hack haberi bizi sattırmasın)
        return s, flags if mentions(item["title"], base) or f"${base}" in item["summary"] else []

    def fear_greed(self) -> Optional[int]:
        if not self.ncfg.get("fear_greed"):
            return None
        try:
            return int(self.get("https://api.alternative.me/fng/?limit=1").json()["data"][0]["value"])
        except Exception as exc:
            log.warning("Korku/Açgözlülük endeksi alınamadı: %s", exc)
            return None

    # ---------- analiz ----------
    def items_for(self, base: str) -> list[dict]:
        cutoff = _now() - self.ncfg["lookback_hours"] * 3600
        seen, out = set(), []
        for it in self.fetch_announcements() + self.fetch_rss() + self.fetch_cryptopanic(base):
            text = f"{it['title']} {it['summary']}"
            if it["ts"] < cutoff or not (it["source"] == "cryptopanic" or base in it.get("coins", []) or mentions(text, base)):
                continue
            key = it["title"].strip().lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(it)
        return sorted(out, key=lambda x: -x["ts"])

    def analyze(self, base: str) -> dict:
        items = self.items_for(base) if self.ncfg["enabled"] else []
        if not items:
            return {"count": 0, "score": 0.0, "red_flags": [], "items": []}
        llm = self._llm_scores(base, items) if self._llm else None
        half = self.ncfg["half_life_hours"] * 3600
        wsum = ssum = 0.0
        red_flags = []
        for idx, it in enumerate(items):
            s, flags = self.item_signal(it, base)
            if llm and idx < len(llm["items"]) and not it.get("kind"):
                s = llm["items"][idx]["sentiment"]
                if llm["items"][idx]["red_flag"]:
                    flags = flags or [llm["items"][idx].get("reason") or "LLM kırmızı bayrak"]
                elif flags:
                    flags = []  # LLM bağlamı okuyup bayrağı düşürdüyse ona güven
            v = it.get("votes")
            if v:
                s = max(-1.0, min(1.0, s + 0.1 * (v["positive"] - v["negative"] - 2 * v["toxic"])))
            # Kırmızı bayraklar sadece son 24 saatte ve başlıkta coin geçiyorsa veto eder
            if flags and _now() - it["ts"] < 86400 and (it["source"] == "cryptopanic" or it.get("kind") or mentions(it["title"], base)):
                red_flags.append(f"{it['title'][:90]} ({', '.join(flags[:2])})")
            w = math.exp(-math.log(2) * max(0.0, _now() - it["ts"]) / half)
            w *= self.ncfg.get("source_weights", {}).get(it["source"], 2.0 if it.get("kind") else 1.0)
            it["sentiment"] = round(s, 2)
            wsum += w
            ssum += w * s
        return {"count": len(items), "score": round(ssum / wsum if wsum else 0.0, 3),
                "red_flags": red_flags, "items": items[:10], "llm_summary": (llm or {}).get("summary")}

    def _llm_scores(self, base: str, items: list[dict]) -> Optional[dict]:
        """Claude ile her haber için -1..+1 duygu ve kırmızı bayrak. Hata olursa sözlüğe düşer."""
        items = items[: self.ncfg["llm"]["max_items"]]
        listing = "\n".join(f"{i}. [{it['source']}] {it['title']} — {it['summary'][:200]}" for i, it in enumerate(items))
        key = hashlib.sha1(f"{base}\n{listing}".encode()).hexdigest()
        if key in self._llm_cache:
            return self._llm_cache[key]
        schema = {
            "type": "object", "additionalProperties": False, "required": ["items", "summary"],
            "properties": {
                "summary": {"type": "string"},
                "items": {"type": "array", "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["index", "sentiment", "red_flag", "reason"],
                    "properties": {"index": {"type": "integer"}, "sentiment": {"type": "number"},
                                   "red_flag": {"type": "boolean"}, "reason": {"type": "string"}}}},
            },
        }
        prompt = (
            f"Aşağıdaki haberleri {base} kripto parasının kısa vadeli (1-14 gün) fiyatı açısından değerlendir. "
            "Her haber için sentiment: -1 (çok olumsuz) ile +1 (çok olumlu) arası; haber bu coinle ilgili değilse 0. "
            f"red_flag: haber {base} için hack, exploit, delist, dava, iflas, çekim durdurma gibi doğrudan ve ciddi bir risk "
            "anlatıyorsa true (başka bir projenin hack'i veya geçmişte kalmış olay ise false). reason: kısa Türkçe gerekçe. "
            "summary: tüm haberlerin 1-2 cümlelik Türkçe özeti. Sıralamayı koru, index alanı listedeki numara olsun.\n\n" + listing
        )
        try:
            resp = self._llm.beta.messages.create(
                model=self.ncfg["llm"]["model"], max_tokens=4000,
                betas=["server-side-fallback-2026-07-01"], fallbacks="default",
                output_config={"effort": self.ncfg["llm"].get("effort", "low"), "format": {"type": "json_schema", "schema": schema}},
                messages=[{"role": "user", "content": prompt}],
            )
            if resp.stop_reason in ("refusal", "max_tokens"):
                log.warning("LLM haber analizi tamamlanmadı (%s), sözlüğe dönülüyor", resp.stop_reason)
                return None
            data = json.loads(next(b.text for b in resp.content if b.type == "text"))
            by_idx = {d["index"]: d for d in data["items"]}
            data["items"] = [
                {**by_idx.get(i, {"sentiment": 0.0, "red_flag": False, "reason": ""}),
                 "sentiment": max(-1.0, min(1.0, float(by_idx.get(i, {}).get("sentiment", 0.0))))}
                for i in range(len(items))
            ]
            self._llm_cache[key] = data
            return data
        except Exception as exc:
            log.warning("LLM haber analizi başarısız, sözlüğe dönülüyor: %s", exc)
            return None
