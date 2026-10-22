import time

import pytest

from bot import backtest, risk
from bot.analysis import decide
from bot.engine import Bot
from bot.exchange import PaperExchange
from bot.indicators import add_indicators, ohlcv_to_df, rsi
from bot.journal import Journal
from bot.news import NewsAnalyzer, lexicon_score, mentions
from bot.state import Position, Store
from conftest import FakeMarket, NoNews, make_ohlcv


class SilentNotifier:
    def __init__(self):
        self.sent = []

    def send(self, text, event="info", data=None):
        self.sent.append((event, text))


def test_indicators_are_computed():
    df = add_indicators(ohlcv_to_df(make_ohlcv()))
    last = df.iloc[-1]
    for col in ("ema20", "ema50", "ema200", "rsi", "macd_hist", "atr_pct", "adx", "bb_pct_b", "vol_ratio", "roc24", "obv_slope"):
        assert col in df and last[col] == last[col], col  # NaN değil
    assert 0 <= last["rsi"] <= 100


def test_rsi_extremes():
    import pandas as pd
    assert rsi(pd.Series(range(1, 60), dtype=float)).iloc[-1] == 100
    assert rsi(pd.Series(range(60, 1, -1), dtype=float)).iloc[-1] < 1


def test_uptrend_scores_higher_than_downtrend(cfg):
    up = add_indicators(ohlcv_to_df(make_ohlcv(drift=0.004)))
    down = add_indicators(ohlcv_to_df(make_ohlcv(drift=-0.004)))
    d_up, d_down = decide("X/USDT", up, cfg), decide("X/USDT", down, cfg)
    assert d_up.score > d_down.score
    assert d_down.cons and d_up.pros
    assert d_down.verdict != "AL"


def test_btc_dump_and_red_flag_veto(cfg):
    df = add_indicators(ohlcv_to_df(make_ohlcv(drift=0.004)))
    d = decide("X/USDT", df, cfg, market_ctx={"btc_change_24h": -9})
    assert d.verdict == "UZAK DUR" and any("BTC" in v for v in d.vetoes)
    d = decide("X/USDT", df, cfg, news={"count": 1, "score": 0.5, "red_flags": ["X hacked"], "items": []})
    assert d.verdict == "UZAK DUR"


def test_news_lexicon_and_mentions():
    s, flags = lexicon_score("Solana surges after major partnership")
    assert s > 0 and not flags
    s, flags = lexicon_score("Protocol exploited, $20M drained")
    assert flags
    assert mentions("SOL breaks out", "SOL")
    assert mentions("solana network upgrade", "SOL")
    assert not mentions("we are solo", "SOL")
    assert not mentions("OP-ed: markets", "OP") and mentions("$OP rallies", "OP")


def test_news_analyzer_with_fake_rss(cfg):
    rss = f"""<?xml version="1.0"?><rss><channel>
    <item><title>Solana surges to record high on ETF approval</title><link>https://a/1</link>
    <pubDate>{time.strftime('%a, %d %b %Y %H:%M:%S +0000', time.gmtime())}</pubDate></item>
    <item><title>Bitcoin dips</title><link>https://a/2</link></item></channel></rss>"""

    class R:
        content = rss.encode()

    cfg["news"]["rss_feeds"] = ["https://example.com/rss"]
    na = NewsAnalyzer(cfg, http_get=lambda url, **kw: R())
    res = na.analyze("SOL")
    assert res["count"] == 1 and res["score"] > 0 and not res["red_flags"]


def test_llm_scores_used_when_client_given(cfg):
    import json

    class Block:
        type = "text"
        text = json.dumps({"summary": "ok", "items": [{"index": 0, "sentiment": -0.9, "red_flag": True, "reason": "SOL köprüsü hacklendi"}]})

    class Resp:
        stop_reason = "end_turn"
        content = [Block()]

    class Msgs:
        def create(self, **kw):
            assert kw["output_config"]["format"]["type"] == "json_schema"
            return Resp()

    class Client:
        class beta:
            messages = Msgs()

    na = NewsAnalyzer(cfg, llm_client=Client())
    na.items_for = lambda base: [{"title": "SOL bridge news", "summary": "", "url": "", "ts": time.time(), "source": "x"}]
    res = na.analyze("SOL")
    assert res["score"] < 0 and res["red_flags"]


def test_stake_scales_between_10_and_15(cfg):
    assert risk.stake_for(cfg["analysis"]["buy_threshold"], cfg) == 10
    assert risk.stake_for(100, cfg) == 15
    assert 10 < risk.stake_for(70, cfg) < 15


def test_exit_ladder_stop_and_trailing(cfg):
    now = time.time()
    p = Position("X/USDT", 1.0, 10, 10, now, 50, stop_price=risk.initial_stop(1.0, cfg))
    assert risk.exit_actions(p, 1.5, now, None, cfg) == []
    acts = risk.exit_actions(p, 2.05, now, None, cfg)
    assert len(acts) == 1 and acts[0].fraction == 0.5 and "2.0x" in acts[0].reason
    assert p.stop_price >= 2.05 * 0.8 - 1e-9  # iz süren stop zirveden %20 aşağıda
    acts = risk.exit_actions(p, 3.1, now, None, cfg)
    assert acts[-1].fraction == 1.0 and "3.0x" in acts[-1].reason

    q = Position("Y/USDT", 1.0, 10, 10, now, 50, stop_price=risk.initial_stop(1.0, cfg))
    assert "stop" in risk.exit_actions(q, 0.74, now, None, cfg)[0].reason


def test_profit_protect_sells_when_analysis_turns(cfg):
    now = time.time()
    p = Position("X/USDT", 1.0, 10, 10, now, 50, stop_price=0.75)
    assert risk.exit_actions(p, 1.12, now, 20, cfg) == []
    acts = risk.exit_actions(p, 1.12, now, -30, cfg)
    assert acts and "kârı koru" in acts[0].reason


def test_can_open_limits(cfg, tmp_path):
    store = Store(str(tmp_path / "s"))
    assert risk.can_open("A/USDT", 12, store, 100, 5, cfg) is None
    assert "bakiye" in risk.can_open("A/USDT", 12, store, 5, 5, cfg)
    for i in range(5):
        store.add(Position(f"P{i}/USDT", 1, 10, 10, time.time(), 50))
    assert "açık pozisyon" in risk.can_open("A/USDT", 12, store, 100, 5, cfg)


def test_paper_exchange_roundtrip(cfg):
    m = FakeMarket({"X/USDT": make_ohlcv()})
    px = PaperExchange(cfg, m)
    start = px.free_quote()
    f = px.market_buy("X/USDT", 12)
    assert px.free_quote() == pytest.approx(start - 12)
    s = px.market_sell("X/USDT", f.amount)
    assert px.free_quote() < start  # komisyon + kayma kadar kayıp
    assert s.amount == pytest.approx(f.amount)


def test_blacklist_and_watchlist_from_vault(cfg):
    j = Journal(cfg)
    j._write("04 Risk Yönetimi/Kara Liste.md", "# Kara Liste\n## Liste\n- LUNA\n- [[FTT]]\n## Notlar\n- BTC\n")
    j._write("01 Strateji/İzleme Listesi.md", "## Liste\n- SOL\n- PEPE/USDT\n")
    assert j.blacklist() == {"LUNA/USDT", "FTT/USDT"}
    assert j.watchlist() == ["SOL/USDT", "PEPE/USDT"]


def test_engine_end_to_end_buy_then_take_profit(cfg, tmp_path):
    cfg["analysis"]["buy_threshold"] = -100
    cfg["analysis"]["rsi_veto"] = 101  # her durumda AL desin, akışı test ediyoruz
    m = FakeMarket({"X/USDT": make_ohlcv(drift=0.004), "BTC/USDT": make_ohlcv(seed=3)})
    note = SilentNotifier()
    bot = Bot(cfg, exchange=PaperExchange(cfg, m), news=NoNews(), notifier=note)
    bot.run_once()
    opens = bot.store.open_positions()
    assert len(opens) == 1 and opens[0].symbol == "X/USDT"
    pos = opens[0]
    assert 10 <= pos.cost <= 15
    trade_note = tmp_path / "vault" / pos.note_file
    assert trade_note.exists() and "## Artılar" in trade_note.read_text()

    m.prices["X/USDT"] = pos.entry_price * 2.1   # 2x → yarısını sat
    bot.manage_positions(m.fetch_tickers(), {})
    assert pos.tp_hits == 1 and pos.is_open and pos.remaining < pos.amount
    m.prices["X/USDT"] = pos.entry_price * 3.2   # 3x → kalanı sat
    bot.manage_positions(m.fetch_tickers(), {})
    assert not pos.is_open and pos.pnl() > pos.cost
    text = trade_note.read_text()
    assert "durum: kapalı" in text and "## Sonuç" in text
    assert any(e == "sell" for e, _ in note.sent)
    assert "Kapanan: 1" in bot.status(m.fetch_tickers())


def test_engine_stop_loss_sets_cooldown(cfg):
    cfg["analysis"]["buy_threshold"] = -100
    cfg["analysis"]["rsi_veto"] = 101
    m = FakeMarket({"X/USDT": make_ohlcv()})
    bot = Bot(cfg, exchange=PaperExchange(cfg, m), news=NoNews(), notifier=SilentNotifier())
    bot.run_once()
    pos = bot.store.open_positions()[0]
    m.prices["X/USDT"] = pos.entry_price * 0.7
    bot.manage_positions(m.fetch_tickers(), {})
    assert not pos.is_open and pos.pnl() < 0 and bot.store.in_cooldown("X/USDT")


def test_backtest_runs(cfg):
    cfg["analysis"]["buy_threshold"] = 20
    res = backtest.run("X/USDT", ohlcv_to_df(make_ohlcv(n=900, drift=0.003, vol=0.03, seed=7)), cfg)
    assert isinstance(res.report(), str)
    assert len(res.equity) == 900 - 210


class QueueNews(NoNews):
    """Sırayla verilen haberleri 'yeni haber' olarak döndürür, gerçek sözlükle puanlar."""

    def __init__(self, cfg):
        self.real = NewsAnalyzer(cfg, http_get=lambda *a, **k: None)
        self.queue = []

    def new_items(self):
        out, self.queue = self.queue, []
        return out

    def score_item(self, item, base):
        return self.real.score_item(item, base)


def _item(title):
    return {"title": title, "summary": "", "url": f"https://n/{abs(hash(title))}", "ts": time.time(), "source": "test"}


def test_news_watch_sells_on_red_flag_and_buys_on_good_news(cfg):
    cfg["analysis"]["buy_threshold"] = -100
    cfg["analysis"]["rsi_veto"] = 101
    cfg["universe"]["symbols"] = ["XYZ/USDT"]
    m = FakeMarket({"XYZ/USDT": make_ohlcv(), "ABC/USDT": make_ohlcv(seed=4)})
    news = QueueNews(cfg)
    bot = Bot(cfg, exchange=PaperExchange(cfg, m), news=news, notifier=SilentNotifier())
    bot.run_once()
    pos = bot.store.open_positions()[0]
    assert pos.symbol == "XYZ/USDT"

    news.queue = [_item("Another protocol hacked, ABC not affected")]  # bizim coin değil
    assert bot.news_watch() == 0 and pos.is_open

    news.queue = [_item("XYZ bridge exploited, $30M drained")]
    assert bot.news_watch() == 1
    assert not pos.is_open and "acil haber" in pos.exit_reasons[-1]

    bot._last_universe = ["ABC/USDT"]
    news.queue = [_item("ABC surges after Binance listing and major partnership")]
    assert bot.news_watch() == 1
    assert bot.store.has_open("ABC/USDT")


def test_backtest_window_and_todo(cfg):
    import pandas as pd
    from shutil import copytree
    from pathlib import Path
    cfg["analysis"]["buy_threshold"] = 20
    raw = ohlcv_to_df(make_ohlcv(n=900, drift=0.003, vol=0.03, seed=7))
    start = raw.index[-1] - pd.Timedelta(hours=72)
    res = backtest.run("X/USDT", raw, cfg, trade_from=start)
    assert all(t["open"] >= start for t in res.trades)
    s = backtest.Summary([res])
    assert isinstance(s.report(), str) and isinstance(s.is_high(cfg), bool)
    copytree(Path(__file__).resolve().parent.parent / "vault", cfg["obsidian"]["vault_path"])
    assert "BOT_MODE=live" in Journal(cfg).todo()
