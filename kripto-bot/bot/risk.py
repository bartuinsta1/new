"""Pozisyon büyüklüğü ve çıkış kuralları (stop, kademeli kâr alma, iz süren stop, kârı koruma)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .state import Position, Store


@dataclass
class ExitAction:
    fraction: float   # elde kalan miktarın ne kadarı satılacak (0..1)
    reason: str


def stake_for(score: float, cfg: dict) -> float:
    """Skor eşikteyken stake_min, +100'de stake_max."""
    p, th = cfg["position"], cfg["analysis"]["buy_threshold"]
    t = max(0.0, min(1.0, (score - th) / max(1e-9, 100 - th)))
    return round(p["stake_min_usd"] + t * (p["stake_max_usd"] - p["stake_min_usd"]), 2)


def can_open(symbol: str, stake: float, store: Store, free_quote: float, min_cost: float, cfg: dict) -> Optional[str]:
    """Açılamıyorsa nedenini döndürür, açılabiliyorsa None."""
    p = cfg["position"]
    opens = store.open_positions()
    if store.has_open(symbol):
        return "zaten açık pozisyon var"
    if store.in_cooldown(symbol):
        return "stop sonrası bekleme süresinde"
    if len(opens) >= p["max_open_positions"]:
        return f"en fazla {p['max_open_positions']} açık pozisyon"
    exposure = sum(x.cost for x in opens)
    if exposure + stake > p["max_total_exposure_usd"]:
        return f"toplam risk limiti ({exposure:.0f}+{stake:.0f} > {p['max_total_exposure_usd']:.0f} $)"
    if store.realized_today() <= -abs(p["daily_loss_limit_usd"]):
        return "günlük zarar limiti doldu"
    if stake > free_quote:
        return f"bakiye yetersiz ({free_quote:.2f} $)"
    if stake < min_cost:
        return f"borsanın en düşük emir tutarı {min_cost:.2f} $"
    return None


def initial_stop(entry: float, cfg: dict) -> float:
    return entry * (1 - cfg["exits"]["stop_loss_pct"])


def update_trailing(pos: Position, price: float, cfg: dict) -> None:
    """Zirveyi ve stop seviyesini günceller (stop sadece yukarı gider)."""
    ex = cfg["exits"]
    pos.highest_price = max(pos.highest_price, price)
    peak_gain = pos.highest_price / pos.entry_price - 1
    stop = pos.stop_price or initial_stop(pos.entry_price, cfg)
    if peak_gain >= ex["breakeven_after_gain"]:
        stop = max(stop, pos.entry_price * 1.003)  # komisyonu karşılayacak kadar üstü
    if peak_gain >= ex["trailing"]["activate_gain"]:
        stop = max(stop, pos.highest_price * (1 - ex["trailing"]["trail_pct"]))
    pos.stop_price = stop


def exit_actions(pos: Position, price: float, now: float, current_score: Optional[float], cfg: dict) -> list[ExitAction]:
    ex = cfg["exits"]
    update_trailing(pos, price, cfg)
    gain = pos.gain(price)

    if price <= pos.stop_price:
        kind = "iz süren stop" if pos.stop_price > pos.entry_price else "zarar kes (stop-loss)"
        return [ExitAction(1.0, f"{kind}: fiyat {price:.6g} <= {pos.stop_price:.6g} (%{gain*100:+.1f})")]

    actions = []
    ladder = ex["take_profit"]
    while pos.tp_hits < len(ladder) and price >= pos.entry_price * ladder[pos.tp_hits]["multiple"]:
        lvl = ladder[pos.tp_hits]
        pos.tp_hits += 1
        actions.append(ExitAction(lvl["sell_fraction"], f"kâr al {lvl['multiple']}x (%{gain*100:+.0f})"))
        if lvl["sell_fraction"] >= 1.0:
            return actions

    pp = ex["profit_protect"]
    if current_score is not None and gain >= pp["min_gain"] and current_score < pp["exit_below_score"]:
        actions.append(ExitAction(1.0, f"kârı koru: %{gain*100:+.1f} kârdayken analiz skoru {current_score:+.0f}'a düştü"))
    elif (now - pos.opened_at) / 3600 >= ex["max_hold_hours"]:
        actions.append(ExitAction(1.0, f"süre doldu ({ex['max_hold_hours']} saat), %{gain*100:+.1f}"))
    return actions
