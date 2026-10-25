"""Komut satırı.

  python -m bot run                 # sürekli çalış (varsayılan paper mod)
  python -m bot once                # tek tur: pozisyonları yönet + tara + uygunsa al
  python -m bot scan                # sadece tara, işlem yapma
  python -m bot analyze SOL/USDT    # tek coin için artı/eksi raporu
  python -m bot status              # bakiye ve açık pozisyonlar
  python -m bot backtest SOL/USDT --days 90
  python -m bot backtest --top 20 --hours 72   # hacimce ilk 20 coinde son 72 saat
  python -m bot optimize --top 20 --days 180   # ayar taraması (eğitim/sınav ayrımıyla)
  python -m bot news [SOL PEPE]     # canlı haber akışı (coin etiketi + duygu), vault'a da yazar
  python -m bot notify-test         # Telegram/webhook bildirim testi
"""
from __future__ import annotations

import argparse
import logging
import sys

from .config import load_config


def main(argv=None):
    ap = argparse.ArgumentParser(prog="bot", description="Kripto al-sat botu")
    ap.add_argument("command", choices=["run", "once", "scan", "analyze", "status", "backtest", "optimize", "news", "notify-test"])
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--config", help="config.yaml yolu")
    ap.add_argument("--days", type=float, default=90)
    ap.add_argument("--hours", type=float, help="backtest: sadece son N saatte alım aç (öncesi ısınma)")
    ap.add_argument("--top", type=int, help="backtest: 24s hacmi en yüksek N coini test et")
    ap.add_argument("--csv", "--file", dest="csv", nargs="+",
                    help="backtest için dosya(lar): Binance JSON, Binance CSV/ZIP ya da ts,open,high,low,close,volume CSV")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cfg = load_config(args.config)
    args.symbol = args.symbols[0] if args.symbols else None

    if args.command == "optimize":
        from pathlib import Path
        from .optimize import load_data, optimize
        data = load_data(cfg, args.top or 20, args.days if args.days != 90 else 180, Path(cfg["state_dir"]) / "cache")
        print(optimize(cfg, data))
        return

    if args.command == "backtest":
        import pandas as pd
        from . import backtest
        from .journal import Journal
        days = backtest.warmup_days(cfg["timeframe"], args.hours) if args.hours else args.days
        if args.csv:
            import os
            names = args.symbols if len(args.symbols) == len(args.csv) else [os.path.basename(f).split(".")[0] for f in args.csv]
            data = {n: backtest.load_file(f) for n, f in zip(names, args.csv)}
        else:
            from .engine import Bot
            from .exchange import CcxtExchange
            ex = CcxtExchange(cfg)
            symbols = list(args.symbols)
            if args.top:
                tmp = Bot.__new__(Bot)
                tmp.cfg, tmp.quote, tmp.journal = cfg, cfg["exchange"]["quote"], Journal(cfg)
                symbols += [s for s in tmp.universe(ex.fetch_tickers()) if s not in symbols][: args.top]
            if not symbols:
                sys.exit("sembol verin (backtest SOL/USDT) ya da --top 20 kullanın")
            data = {}
            for sym in symbols:
                try:
                    data[sym] = backtest.fetch_history(ex, sym, cfg["timeframe"], days)
                except Exception as exc:
                    print(f"{sym}: veri alınamadı ({exc})")
        btc_sym = f"BTC/{cfg['exchange']['quote']}"
        btc_raw = data.get(btc_sym)
        if btc_raw is None and not args.csv:
            try:
                btc_raw = backtest.fetch_history(ex, btc_sym, cfg["timeframe"], days)
            except Exception as exc:
                print(f"BTC verisi alınamadı, piyasa bağlamı olmadan test ediliyor ({exc})")
        results = []
        for sym, raw in data.items():
            start = raw.index[-1] - pd.Timedelta(hours=args.hours) if args.hours else None
            res = backtest.run(sym, raw, cfg, trade_from=start, btc_raw=None if sym == btc_sym else btc_raw)
            results.append(res)
            print(res.report())
        summary = backtest.Summary(results)
        print("\n" + summary.report())
        if args.hours and args.hours < 24 * 14:
            print(f"Not: {args.hours:.0f} saat çok kısa bir dönem; sonuç şans olabilir. 90-180 günle de test edin.")
        if summary.is_high(cfg):
            print("\n✅ Kârlılık yüksek. Yapılacaklar listesi:\n")
            print(Journal(cfg).todo())
        else:
            print("\nKârlılık yüksek eşiğini geçmedi; canlıya geçmeyin, ayarları/eşiği gözden geçirin.")
        return

    if args.command == "notify-test":
        from .notifier import Notifier
        sec = cfg["secrets"]
        print("Telegram:", "ayarlı" if sec["telegram_token"] and sec["telegram_chat_id"] else "EKSİK (.env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)")
        print("Webhook :", "ayarlı" if sec["webhook_url"] else "yok (opsiyonel)")
        Notifier(cfg).send("Test mesajı: bildirimler çalışıyor ✅", "test")
        print("Gönderildi. Telefonuna mesaj gelmediyse token/chat id'yi kontrol et.")
        return

    if args.command == "news":
        _news_monitor(cfg, args)
        return

    from .engine import Bot
    bot = Bot(cfg)
    if args.command == "run":
        if cfg["mode"] == "live":
            print("⚠️  LIVE mod: gerçek para ile işlem yapılacak. Ctrl+C ile durdurun.")
        bot.run_forever()
    elif args.command == "once":
        bot.run_once()
        print(bot.status())
    elif args.command == "status":
        print(bot.status())
    elif args.command in ("scan", "analyze"):
        tickers = bot.ex.fetch_tickers()
        ctx = bot.market_context(tickers)
        if args.command == "analyze":
            if not args.symbol:
                sys.exit("analyze için sembol verin: python -m bot analyze SOL/USDT")
            d = bot.analyze(args.symbol, tickers, ctx)
            print(d.summary())
            print("\nARTILAR:")
            for f in d.pros:
                print(f"  + {f.name} ({f.points:+g}): {f.note}")
            print("EKSİLER:")
            for f in d.cons:
                print(f"  - {f.name} ({f.points:+g}): {f.note}")
            for it in d.news_items[:8]:
                print(f"  📰 {it.get('sentiment', 0):+.2f} {it['title']}")
            bot.journal.coin_analysis(d)
        else:
            for d in bot.scan(tickers, ctx)[:20]:
                print(d.summary())


def _news_monitor(cfg, args):
    """Canlı haber akışı: yeni haberleri coin etiketi ve duygu puanıyla yazar, vault'a kaydeder."""
    import time
    from datetime import datetime, timezone
    from .journal import Journal
    from .news import NewsAnalyzer, mentions
    na, journal = NewsAnalyzer(cfg), Journal(cfg)
    na._watch_since = time.time() - 6 * 3600  # açılışta son 6 saatin haberlerini de göster
    watch = [s.split("/")[0] for s in args.symbols] or [s.split("/")[0] for s in journal.watchlist()]
    poll = cfg["news"]["poll_seconds"]
    fg = na.fear_greed()
    print(f"Haber takibi başladı (her {poll} sn) · izlenen: {', '.join(watch) or 'tümü'} · korku/açgözlülük: {fg}")
    print("Kaynaklar:", "borsa duyuruları (Binance, Upbit) +" if cfg["news"].get("announcements", True) else "",
          f"{len(cfg['news']['rss_feeds'])} RSS", "+ CryptoPanic" if cfg["secrets"]["cryptopanic_token"] else "(CryptoPanic token yok)")
    while True:
        for it in reversed(na.new_items()):
            coins = list(it.get("coins") or []) + [b for b in watch if mentions(f"{it['title']} {it['summary']}", b)]
            coins = list(dict.fromkeys(coins))
            parts = []
            for c in coins or [None]:
                if c is None:
                    s_, flags = na.item_signal(it, "")
                    parts.append(f"{s_:+.2f}")
                else:
                    s_, flags = na.score_item(it, c)
                    parts.append(f"{c} {s_:+.2f}{' 🚩' if flags else ''}")
            when = datetime.fromtimestamp(it["ts"], timezone.utc).strftime("%H:%M")
            kind = {"listing": "🟢LİSTELEME ", "delisting": "🔴DELİST "}.get(it.get("kind", ""), "")
            line = f"{when} [{it['source']}] {kind}{it['title'][:110]} · {' | '.join(parts)}"
            print(line, flush=True)
            if coins:
                journal.news_log(f"{kind}[{it['title'][:120]}]({it['url']}) · {' | '.join(parts)} · {it['source']}",
                                 [c for c in coins if c])
        time.sleep(poll)


if __name__ == "__main__":
    main()
