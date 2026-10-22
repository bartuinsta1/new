"""Komut satırı.

  python -m bot run                 # sürekli çalış (varsayılan paper mod)
  python -m bot once                # tek tur: pozisyonları yönet + tara + uygunsa al
  python -m bot scan                # sadece tara, işlem yapma
  python -m bot analyze SOL/USDT    # tek coin için artı/eksi raporu
  python -m bot status              # bakiye ve açık pozisyonlar
  python -m bot backtest SOL/USDT --days 90
  python -m bot backtest --top 20 --hours 72   # hacimce ilk 20 coinde son 72 saat
"""
from __future__ import annotations

import argparse
import logging
import sys

from .config import load_config


def main(argv=None):
    ap = argparse.ArgumentParser(prog="bot", description="Kripto al-sat botu")
    ap.add_argument("command", choices=["run", "once", "scan", "analyze", "status", "backtest"])
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--config", help="config.yaml yolu")
    ap.add_argument("--days", type=float, default=90)
    ap.add_argument("--hours", type=float, help="backtest: sadece son N saatte alım aç (öncesi ısınma)")
    ap.add_argument("--top", type=int, help="backtest: 24s hacmi en yüksek N coini test et")
    ap.add_argument("--csv", help="backtest için ts,open,high,low,close,volume CSV (ts milisaniye)")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cfg = load_config(args.config)
    args.symbol = args.symbols[0] if args.symbols else None

    if args.command == "backtest":
        import pandas as pd
        from . import backtest
        from .journal import Journal
        days = backtest.warmup_days(cfg["timeframe"], args.hours) if args.hours else args.days
        if args.csv:
            from .indicators import ohlcv_to_df
            data = {args.symbol or "CSV": ohlcv_to_df(pd.read_csv(args.csv).iloc[:, :6].values.tolist())}
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
        results = []
        for sym, raw in data.items():
            start = raw.index[-1] - pd.Timedelta(hours=args.hours) if args.hours else None
            res = backtest.run(sym, raw, cfg, trade_from=start)
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


if __name__ == "__main__":
    main()
