"""Obsidian "ikinci beyin" entegrasyonu.

Bot vault'a yazar:
  06 İşlemler/   her işlem için bir not (frontmatter + artılar/eksiler + haberler + çıkış)
  05 Coinler/    coin başına not; her analiz bir satır olarak eklenir
  07 Günlük/     günlük not: tarama özeti, alım/satımlar, bakiye
Bot vault'tan okur:
  04 Risk Yönetimi/Kara Liste.md   -> bu coinlere asla girilmez
  01 Strateji/İzleme Listesi.md    -> universe.symbols boşsa taramaya her zaman eklenir
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from .analysis import Decision
from .state import Position

SYMBOL_RE = re.compile(r"^\s*[-*]\s*(?:\[\[)?([A-Z0-9]{2,15})(?:/([A-Z]{3,5}))?(?:\]\])?")


def _ts(t: float | None = None) -> datetime:
    return datetime.fromtimestamp(t, timezone.utc) if t else datetime.now(timezone.utc)


def coin_name(symbol: str) -> str:
    return symbol.split("/")[0]


class Journal:
    def __init__(self, cfg: dict):
        self.cfg = cfg["obsidian"]
        self.quote = cfg["exchange"]["quote"]
        self.root = Path(self.cfg["vault_path"])
        self.mode = cfg["mode"]
        self.take_profit = cfg["exits"]["take_profit"]

    # ---------- okuma ----------
    def _symbols_in(self, rel: str) -> list[str]:
        path = self.root / rel
        if not path.exists():
            return []
        out, in_list = [], False
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("## Liste"):
                in_list = True
                continue
            if in_list and line.startswith("## "):
                break
            m = SYMBOL_RE.match(line) if in_list else None
            if m:
                out.append(f"{m.group(1)}/{m.group(2) or self.quote}")
        return out

    def blacklist(self) -> set[str]:
        return set(self._symbols_in("04 Risk Yönetimi/Kara Liste.md"))

    def watchlist(self) -> list[str]:
        return self._symbols_in("01 Strateji/İzleme Listesi.md")

    # ---------- yazma ----------
    def _write(self, rel: str, text: str):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def _append(self, rel: str, text: str, header: str = ""):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text(header, encoding="utf-8")
        with open(path, "a", encoding="utf-8") as f:
            f.write(text)

    @staticmethod
    def _factor_lines(factors) -> str:
        return "\n".join(f"- **{f.name}** ({f.points:+g}): {f.note}" for f in factors) or "- (yok)"

    def trade_opened(self, pos: Position, d: Decision) -> str:
        if not self.cfg["write_trades"]:
            return ""
        coin = coin_name(pos.symbol)
        rel = f"06 İşlemler/{_ts(pos.opened_at):%Y-%m-%d %H%M} {coin} {pos.id}.md"
        news = "\n".join(f"- [{it['title']}]({it['url']}) · {it['source']} · duygu {it.get('sentiment', 0):+.2f}"
                         for it in d.news_items[:8]) or "- Haber bulunamadı"
        m = d.metrics
        text = f"""---
tür: işlem
coin: "[[{coin}]]"
sembol: {pos.symbol}
durum: açık
mod: {self.mode}
açılış: {_ts(pos.opened_at):%Y-%m-%d %H:%M}
giriş_fiyatı: {pos.entry_price:.8g}
miktar: {pos.amount:.8g}
maliyet: {pos.cost:.2f}
skor: {d.score}
teknik: {d.group_scores.get('technical')}
haber: {d.group_scores.get('news')}
piyasa: {d.group_scores.get('market')}
stop: {pos.stop_price:.8g}
kapanış:
çıkış_fiyatı:
kar_zarar:
kar_zarar_yüzde:
tags: [işlem, {coin.lower()}]
---
# {coin} alımı · skor {d.score:+.1f}

> Karar: **{d.verdict}** · {pos.cost:.2f} {self.quote} ile {pos.entry_price:.8g} fiyattan alındı.
> Bağlantılar: [[{coin}]] · [[{_ts(pos.opened_at):%Y-%m-%d}]] · [[Strateji]] · [[Çıkış Kuralları]]

## Artılar
{self._factor_lines(d.pros)}

## Eksiler
{self._factor_lines(d.cons)}

## Haberler
{news}

## Göstergeler
| RSI | MACD hist | ADX | ATR % | Hacim x | %B | 24 mum |
|---|---|---|---|---|---|---|
| {m.get('rsi', 0):.0f} | {m.get('macd_hist', 0):.3g} | {m.get('adx', 0):.0f} | {m.get('atr_pct', 0)*100:.1f} | {m.get('vol_ratio', 0):.2f} | {m.get('bb_pct_b', 0):.2f} | %{m.get('roc24', 0)*100:.1f} |

## Plan
- Stop: {pos.stop_price:.8g} (%{(pos.stop_price/pos.entry_price-1)*100:.0f})
- Hedefler: {', '.join(f"{t['multiple']}x → %{t['sell_fraction']*100:.0f} sat" for t in self.take_profit)}

## Satışlar
"""
        self._write(rel, text)
        return rel

    def trade_partial(self, pos: Position, price: float, amount: float, proceeds: float, reason: str):
        if pos.note_file:
            self._append(pos.note_file, f"- {_ts():%Y-%m-%d %H:%M} · {amount:.8g} adet @ {price:.8g} → {proceeds:.2f} {self.quote} · {reason}\n")

    def trade_closed(self, pos: Position, exit_price: float, reason: str):
        if not pos.note_file:
            return
        path = self.root / pos.note_file
        if not path.exists():
            return
        pnl = pos.pnl()
        text = path.read_text(encoding="utf-8")
        repl = {
            "durum: açık": "durum: kapalı",
            "\nkapanış:\n": f"\nkapanış: {_ts(pos.closed_at):%Y-%m-%d %H:%M}\n",
            "\nçıkış_fiyatı:\n": f"\nçıkış_fiyatı: {exit_price:.8g}\n",
            "\nkar_zarar:\n": f"\nkar_zarar: {pnl:.2f}\n",
            "\nkar_zarar_yüzde:\n": f"\nkar_zarar_yüzde: {pnl / pos.cost * 100:.1f}\n",
        }
        for a, b in repl.items():
            text = text.replace(a, b, 1)
        text += (f"\n## Sonuç\n- Çıkış nedeni: {reason}\n- Net kâr/zarar: **{pnl:+.2f} {self.quote}** (%{pnl/pos.cost*100:+.1f})\n"
                 f"- Görülen zirve: {pos.highest_price:.8g} (%{(pos.highest_price/pos.entry_price-1)*100:+.0f})\n"
                 "\n## Ders (elle doldur)\n- \n")
        path.write_text(text, encoding="utf-8")

    def coin_analysis(self, d: Decision):
        if not self.cfg["write_coin_notes"]:
            return
        coin = coin_name(d.symbol)
        header = (f"---\ntür: coin\nsembol: {d.symbol}\ntags: [coin]\n---\n# {coin}\n\n"
                  "Notlar: (projeyi, tokenomics'i, kilit açılımlarını buraya yaz)\n\n## Analiz geçmişi\n"
                  "| Zaman | Fiyat | Skor | Karar | Teknik | Haber | Piyasa | Not |\n|---|---|---|---|---|---|---|---|\n")
        top = d.cons[0].note if d.vetoes == [] and d.cons else ("; ".join(d.vetoes) or "")
        self._append(f"05 Coinler/{coin}.md",
                     f"| {_ts():%m-%d %H:%M} | {d.price:.6g} | {d.score:+.0f} | {d.verdict} | {d.group_scores['technical']:+.0f} | "
                     f"{d.group_scores['news']:+.0f} | {d.group_scores['market']:+.0f} | {top[:60].replace('|', '/')} |\n", header)

    def daily(self, line: str):
        if not self.cfg["write_daily"]:
            return
        day = _ts()
        header = (f"---\ntür: günlük\ntarih: {day:%Y-%m-%d}\ntags: [günlük]\n---\n# {day:%Y-%m-%d}\n\n"
                  f"Bağlantılar: [[Pano]] · [[İşlem Günlüğü]]\n\n## Bot kayıtları\n")
        self._append(f"07 Günlük/{day:%Y-%m-%d}.md", f"- {day:%H:%M} {line}\n", header)

    def scan_summary(self, decisions: list[Decision]):
        top = sorted(decisions, key=lambda d: -d.score)[: self.cfg["scan_top_n"]]
        if not top:
            return
        rows = ", ".join(f"[[{coin_name(d.symbol)}]] {d.score:+.0f} ({d.verdict})" for d in top)
        self.daily(f"Tarama: {len(decisions)} coin · en iyiler: {rows}")
