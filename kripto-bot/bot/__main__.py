"""Komut satırı.

  python -m bot run                 # sürekli çalış (varsayılan paper mod)
  python -m bot once                # tek tur: pozisyonları yönet + tara + uygunsa al
  python -m bot scan                # sadece tara, işlem yapma
  python -m bot analyze SOL/USDT    # tek coin için artı/eksi raporu
  python -m bot status              # bakiye ve açık pozisyonlar
  python -m bot backtest SOL/USDT --days 90
"""
from __future__ import annotations

import argparse
import logging
import sys

from .config import load_config


def main(argv=None):
    ap = argparse.ArgumentParser(prog="bot", description="Kripto al-sat botu")
    ap.add_argument("command", choices=["run", "once", "scan", "analyze", "status", "backtest"])
    ap.add_argument("symbol", nargs="?")
    ap.add_argument("--config", help="config.yaml yolu")
    ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--csv", help="backtest için ts,open,high,low,close,volume CSV (ts milisaniye)")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cfg = load_config(args.config)

    if args.command == "backtest":
        from . import backtest
        if not args.symbol:
            sys.exit("backtest için sembol verin: python -m bot backtest SOL/USDT")
        if args.csv:
            import pandas as pd
            from .indicators import ohlcv_to_df
            raw = ohlcv_to_df(pd.read_csv(args.csv).iloc[:, :6].values.tolist())
        else:
            from .exchange import CcxtExchange
            raw = backtest.fetch_history(CcxtExchange(cfg), args.symbol, cfg["timeframe"], args.days)
        print(backtest.run(args.symbol, raw, cfg).report())
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
