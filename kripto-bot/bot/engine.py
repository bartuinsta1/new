"""Ana döngü: tara → analiz et (artı/eksi + haber) → al → pozisyonları izle → kârda/stopta sat."""
from __future__ import annotations

import logging
import time
from typing import Optional

from . import risk
from .analysis import Decision, decide
from .indicators import add_indicators, ohlcv_to_df
from .journal import Journal, coin_name
from .news import NewsAnalyzer
from .notifier import Notifier
from .state import Position, Store

log = logging.getLogger(__name__)


class Bot:
    def __init__(self, cfg: dict, exchange=None, news: NewsAnalyzer | None = None,
                 journal: Journal | None = None, notifier: Notifier | None = None, store: Store | None = None):
        self.cfg = cfg
        if exchange is None:
            from .exchange import build_exchange
            exchange = build_exchange(cfg)
        self.ex = exchange
        self.news = news or NewsAnalyzer(cfg)
        self.journal = journal or Journal(cfg)
        self.notify = notifier or Notifier(cfg)
        self.store = store or Store(cfg["state_dir"])
        self.quote = cfg["exchange"]["quote"]

    # ---------- veri ----------
    def candles(self, symbol: str):
        rows = self.ex.fetch_ohlcv(symbol, self.cfg["timeframe"], self.cfg["lookback_candles"])
        return add_indicators(ohlcv_to_df(rows))

    def market_context(self, tickers: dict) -> dict:
        ctx: dict = {"fear_greed": self.news.fear_greed()}
        btc = f"BTC/{self.quote}"
        if btc in tickers:
            ctx["btc_change_24h"] = tickers[btc].get("percentage")
            try:
                df = self.candles(btc)
                ctx["btc_trend_up"] = bool(df["close"].iloc[-1] > df["ema50"].iloc[-1])
            except Exception as exc:
                log.warning("BTC mumları alınamadı: %s", exc)
        return ctx

    def universe(self, tickers: dict) -> list[str]:
        u = self.cfg["universe"]
        black = self.journal.blacklist() | set(u["exclude"])
        if u["symbols"]:
            syms = list(u["symbols"])
        else:
            rows = []
            for s, t in tickers.items():
                if not s.endswith(f"/{self.quote}") or ":" in s:
                    continue
                if any(p in s for p in u["exclude_patterns"]):
                    continue
                if (t.get("quoteVolume") or 0) < u["min_quote_volume_24h"]:
                    continue
                if (t.get("percentage") or 0) < u["min_price_change_24h"]:
                    continue
                rows.append((t.get("quoteVolume") or 0, s))
            syms = [s for _, s in sorted(rows, reverse=True)[: u["max_symbols"]]]
            syms += [s for s in self.journal.watchlist() if s in tickers and s not in syms]
        btc = f"BTC/{self.quote}"
        return [s for s in dict.fromkeys(syms) if s not in black and (u["symbols"] or s != btc)]

    def analyze(self, symbol: str, tickers: dict, ctx: dict, with_news: bool = True) -> Decision:
        df = self.candles(symbol)
        if len(df) < 210:
            raise ValueError(f"{symbol}: yeterli mum yok ({len(df)})")
        news = self.news.analyze(coin_name(symbol)) if with_news else None
        return decide(symbol, df, self.cfg, ctx, tickers.get(symbol), self.ex.spread_pct(symbol), news)

    # ---------- işlemler ----------
    def buy(self, d: Decision) -> Optional[Position]:
        stake = risk.stake_for(d.score, self.cfg)
        why_not = risk.can_open(d.symbol, stake, self.store, self.ex.free_quote(), self.ex.min_cost(d.symbol), self.cfg)
        if why_not:
            log.info("%s alınmadı: %s", d.symbol, why_not)
            return None
        fill = self.ex.market_buy(d.symbol, stake)
        if fill.amount <= 0:
            log.error("%s alım emri dolmadı: %s", d.symbol, fill)
            return None
        entry = fill.cost / fill.amount  # komisyon dahil gerçek maliyet
        pos = Position(symbol=d.symbol, entry_price=entry, amount=fill.amount, cost=fill.cost,
                       opened_at=fill.ts, entry_score=d.score, stop_price=risk.initial_stop(entry, self.cfg))
        pos.note_file = self.journal.trade_opened(pos, d)
        self.store.add(pos)
        pros = "; ".join(f.name for f in d.pros[:3])
        self.journal.daily(f"🟢 AL [[{coin_name(d.symbol)}]] {fill.cost:.2f} {self.quote} @ {entry:.6g} · skor {d.score:+.0f} · {pros}")
        self.notify.send(f"AL {d.symbol} {fill.cost:.2f} {self.quote} @ {entry:.6g} | skor {d.score:+.0f} | artılar: {pros}",
                         "buy", {"symbol": d.symbol, "price": entry, "cost": fill.cost, "score": d.score})
        return pos

    def sell(self, pos: Position, fraction: float, reason: str, price_hint: float) -> None:
        amount = pos.remaining * min(1.0, fraction)
        # Kalan kısım borsa alt limitinin altına düşecekse hepsini sat
        if (pos.remaining - amount) * price_hint < self.ex.min_cost(pos.symbol) * 1.1:
            amount = pos.remaining
        fill = self.ex.market_sell(pos.symbol, amount)
        pos.remaining = max(0.0, pos.remaining - fill.amount)
        pos.realized += fill.cost
        pos.exit_reasons.append(reason)
        self.journal.trade_partial(pos, fill.price, fill.amount, fill.cost, reason)
        if pos.remaining * fill.price < 0.5:  # yarım dolardan az toz kaldıysa pozisyon kapandı
            pos.closed_at = time.time()
            if pos.pnl() < 0:
                self.store.cooldown[pos.symbol] = time.time() + self.cfg["position"]["cooldown_hours_after_loss"] * 3600
            self.journal.trade_closed(pos, fill.price, reason)
        self.store.save()
        pnl_txt = f"net {pos.pnl():+.2f} {self.quote}" if not pos.is_open else f"satış {fill.cost:.2f} {self.quote}"
        icon = "🔴" if pos.pnl() < 0 and not pos.is_open else "💸"
        self.journal.daily(f"{icon} SAT [[{coin_name(pos.symbol)}]] %{fraction*100:.0f} @ {fill.price:.6g} · {reason} · {pnl_txt}")
        self.notify.send(f"SAT {pos.symbol} @ {fill.price:.6g} | {reason} | {pnl_txt}", "sell",
                         {"symbol": pos.symbol, "price": fill.price, "proceeds": fill.cost, "reason": reason, "closed": not pos.is_open})

    def manage_positions(self, tickers: dict, ctx: dict) -> None:
        pp = self.cfg["exits"]["profit_protect"]
        for pos in self.store.open_positions():
            t = tickers.get(pos.symbol) or self.ex.fetch_ticker(pos.symbol)
            price = t.get("bid") or t["last"]
            score = None
            if pos.gain(price) >= pp["min_gain"]:  # kârdayken analizi tazele
                try:
                    score = self.analyze(pos.symbol, tickers, ctx).score
                except Exception as exc:
                    log.warning("%s yeniden analiz edilemedi: %s", pos.symbol, exc)
            for act in risk.exit_actions(pos, price, time.time(), score, self.cfg):
                if not pos.is_open:
                    break
                self.sell(pos, act.fraction, act.reason, price)
            self.store.save()

    def scan(self, tickers: dict, ctx: dict) -> list[Decision]:
        decisions = []
        for sym in self.universe(tickers):
            if self.store.has_open(sym):
                continue
            try:
                # Önce ucuz teknik ön eleme; haberleri sadece umut vadedenler için çek
                pre = self.analyze(sym, tickers, ctx, with_news=False)
                d = self.analyze(sym, tickers, ctx) if pre.score >= self.cfg["analysis"]["buy_threshold"] * 0.6 and not pre.vetoes else pre
                decisions.append(d)
                if d.score >= self.cfg["analysis"]["buy_threshold"] * 0.6:
                    self.journal.coin_analysis(d)
            except Exception as exc:
                log.warning("%s analiz edilemedi: %s", sym, exc)
        return sorted(decisions, key=lambda d: -d.score)

    def run_once(self) -> list[Decision]:
        tickers = self.ex.fetch_tickers()
        ctx = self.market_context(tickers)
        self.manage_positions(tickers, ctx)
        decisions = self.scan(tickers, ctx)
        self.journal.scan_summary(decisions)
        for d in decisions:
            log.info(d.summary())
            if d.verdict == "AL":
                self.buy(d)
        return decisions

    def run_forever(self):
        interval = self.cfg["loop"]["interval_seconds"]
        self.notify.send(f"Bot başladı ({self.cfg['exchange']['id']}, {self.cfg['timeframe']}, her {interval}s)", "start")
        while True:
            started = time.time()
            try:
                self.run_once()
            except KeyboardInterrupt:
                raise
            except Exception as exc:
                log.exception("Tur hatası: %s", exc)
                self.notify.send(f"Hata: {exc}", "error")
            time.sleep(max(5, interval - (time.time() - started)))

    def status(self, tickers: dict | None = None) -> str:
        tickers = tickers or {}
        lines = [f"Mod: {self.cfg['mode']} · serbest bakiye: {self.ex.free_quote():.2f} {self.quote} · bugünkü gerçekleşen: {self.store.realized_today():+.2f}"]
        for p in self.store.open_positions():
            price = (tickers.get(p.symbol) or self.ex.fetch_ticker(p.symbol))["last"]
            lines.append(f"  {p.symbol}: giriş {p.entry_price:.6g} · şimdi {price:.6g} (%{p.gain(price)*100:+.1f}) · stop {p.stop_price:.6g} · "
                         f"kademe {p.tp_hits} · K/Z {p.pnl(price):+.2f}")
        closed = [p for p in self.store.positions if not p.is_open]
        if closed:
            wins = sum(1 for p in closed if p.pnl() > 0)
            lines.append(f"Kapanan: {len(closed)} işlem · kazanan %{wins/len(closed)*100:.0f} · toplam {sum(p.pnl() for p in closed):+.2f} {self.quote}")
        return "\n".join(lines)
