"""Borsa katmanı.

`CcxtExchange`: ccxt ile 100+ borsaya bağlanır (Binance, Bybit, OKX, KuCoin, Gate, MEXC...).
`PaperExchange`: gerçek piyasa verisini kullanır, emirleri sanal bakiyede komisyon + kayma ile simüle eder.
Başka bir borsa/aracı eklemek için `MarketData` + `Broker` metodlarını uygulayan bir sınıf yazmak yeterli.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

log = logging.getLogger(__name__)


@dataclass
class Fill:
    symbol: str
    side: str          # buy | sell
    amount: float      # coin miktarı
    price: float       # ortalama fiyat
    cost: float        # quote (USDT) tutarı
    fee: float         # quote cinsinden komisyon
    order_id: str
    ts: float


class MarketData(Protocol):
    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int) -> list[list]: ...
    def fetch_tickers(self) -> dict[str, dict]: ...
    def fetch_ticker(self, symbol: str) -> dict: ...
    def spread_pct(self, symbol: str) -> float | None: ...
    def min_cost(self, symbol: str) -> float: ...


class Broker(Protocol):
    def free_quote(self) -> float: ...
    def market_buy(self, symbol: str, quote_amount: float) -> Fill: ...
    def market_sell(self, symbol: str, amount: float) -> Fill: ...


class CcxtExchange:
    def __init__(self, cfg: dict):
        import ccxt
        ex_cfg, sec = cfg["exchange"], cfg["secrets"]
        klass = getattr(ccxt, ex_cfg["id"])
        params = {"enableRateLimit": True, "options": {"defaultType": "spot"}}
        if sec.get("api_key"):
            params.update(apiKey=sec["api_key"], secret=sec["api_secret"])
            if sec.get("api_password"):
                params["password"] = sec["api_password"]
        self.ex = klass(params)
        if ex_cfg.get("sandbox"):
            self.ex.set_sandbox_mode(True)
        self.quote = ex_cfg["quote"]
        self._markets = None

    @property
    def markets(self) -> dict:
        if self._markets is None:
            self._markets = self.ex.load_markets()
        return self._markets

    def spot_symbols(self) -> list[str]:
        return [s for s, m in self.markets.items() if m.get("spot") and m.get("active", True) and m.get("quote") == self.quote]

    def fetch_ohlcv(self, symbol, timeframe, limit):
        return self.ex.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)

    def fetch_tickers(self):
        return self.ex.fetch_tickers()

    def fetch_ticker(self, symbol):
        return self.ex.fetch_ticker(symbol)

    def spread_pct(self, symbol):
        try:
            ob = self.ex.fetch_order_book(symbol, limit=5)
            bid, ask = ob["bids"][0][0], ob["asks"][0][0]
            return (ask - bid) / ask
        except Exception as exc:
            log.debug("Emir defteri alınamadı %s: %s", symbol, exc)
            return None

    def min_cost(self, symbol):
        lim = (self.markets.get(symbol) or {}).get("limits", {}).get("cost", {}) or {}
        return float(lim.get("min") or 5.0)

    # ---- gerçek emirler ----
    def free_quote(self):
        return float(self.ex.fetch_balance().get("free", {}).get(self.quote, 0.0))

    def free_base(self, symbol):
        base = symbol.split("/")[0]
        return float(self.ex.fetch_balance().get("free", {}).get(base, 0.0))

    def market_buy(self, symbol, quote_amount):
        if self.ex.has.get("createMarketBuyOrderWithCost"):
            order = self.ex.create_market_buy_order_with_cost(symbol, quote_amount)
        else:
            price = self.fetch_ticker(symbol)["ask"] or self.fetch_ticker(symbol)["last"]
            amount = float(self.ex.amount_to_precision(symbol, quote_amount / price))
            order = self.ex.create_market_buy_order(symbol, amount)
        return self._to_fill(symbol, "buy", self._wait(order, symbol))

    def market_sell(self, symbol, amount):
        amount = min(amount, self.free_base(symbol))
        amount = float(self.ex.amount_to_precision(symbol, amount))
        order = self.ex.create_market_sell_order(symbol, amount)
        return self._to_fill(symbol, "sell", self._wait(order, symbol))

    def _wait(self, order, symbol, tries=10):
        for _ in range(tries):
            if order.get("status") == "closed" and order.get("filled"):
                return order
            time.sleep(1)
            order = self.ex.fetch_order(order["id"], symbol)
        return order

    def _to_fill(self, symbol, side, o) -> Fill:
        filled = float(o.get("filled") or 0)
        cost = float(o.get("cost") or filled * float(o.get("average") or o.get("price") or 0))
        fee = o.get("fee") or {}
        fee_cost = float(fee.get("cost") or 0)
        if fee and fee.get("currency") and fee["currency"] != self.quote and filled:
            fee_cost *= cost / filled  # base cinsinden komisyonu quote'a çevir
            if side == "buy":
                filled -= float(fee.get("cost") or 0)
        return Fill(symbol, side, filled, cost / filled if filled else 0.0, cost, fee_cost, str(o.get("id")), time.time())


class PaperExchange:
    """Gerçek fiyat, sanal cüzdan. Durum state_dir/paper_wallet.json'da saklanır."""

    def __init__(self, cfg: dict, market: MarketData):
        self.market = market
        self.fee = cfg["exchange"]["fee_rate"]
        self.slip = cfg["exchange"]["slippage"]
        self.path = Path(cfg["state_dir"]) / "paper_wallet.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            self.wallet = json.loads(self.path.read_text())
        else:
            self.wallet = {"quote": float(cfg["exchange"]["paper_start_balance"]), "coins": {}, "n": 0}
            self._save()

    def __getattr__(self, name):  # piyasa verisi metodları gerçek borsaya gider
        return getattr(self.market, name)

    def _save(self):
        self.path.write_text(json.dumps(self.wallet, indent=2))

    def free_quote(self):
        return self.wallet["quote"]

    def _price(self, symbol, side):
        t = self.market.fetch_ticker(symbol)
        p = (t.get("ask") if side == "buy" else t.get("bid")) or t["last"]
        return p * (1 + self.slip) if side == "buy" else p * (1 - self.slip)

    def market_buy(self, symbol, quote_amount):
        if quote_amount > self.wallet["quote"] + 1e-9:
            raise ValueError(f"Yetersiz sanal bakiye: {self.wallet['quote']:.2f}")
        price = self._price(symbol, "buy")
        fee = quote_amount * self.fee
        amount = (quote_amount - fee) / price
        self.wallet["quote"] -= quote_amount
        self.wallet["coins"][symbol] = self.wallet["coins"].get(symbol, 0.0) + amount
        self.wallet["n"] += 1
        self._save()
        return Fill(symbol, "buy", amount, price, quote_amount, fee, f"paper-{self.wallet['n']}", time.time())

    def market_sell(self, symbol, amount):
        amount = min(amount, self.wallet["coins"].get(symbol, 0.0))
        price = self._price(symbol, "sell")
        gross = amount * price
        fee = gross * self.fee
        self.wallet["quote"] += gross - fee
        left = self.wallet["coins"].get(symbol, 0.0) - amount
        if left <= 1e-12:
            self.wallet["coins"].pop(symbol, None)
        else:
            self.wallet["coins"][symbol] = left
        self.wallet["n"] += 1
        self._save()
        return Fill(symbol, "sell", amount, price, gross - fee, fee, f"paper-{self.wallet['n']}", time.time())


def build_exchange(cfg: dict):
    real = CcxtExchange(cfg)
    if cfg["mode"] == "live":
        if not cfg["secrets"].get("api_key"):
            raise RuntimeError("live mod için .env içinde EXCHANGE_API_KEY / EXCHANGE_API_SECRET gerekli")
        return real
    return PaperExchange(cfg, real)
