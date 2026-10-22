"""Açık/kapalı pozisyonların kalıcı kaydı (state/positions.json)."""
from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


@dataclass
class Position:
    symbol: str
    entry_price: float
    amount: float              # başlangıç coin miktarı
    cost: float                # harcanan USDT (komisyon dahil)
    opened_at: float
    entry_score: float
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    remaining: float = -1.0    # elde kalan coin
    highest_price: float = 0.0
    stop_price: float = 0.0
    tp_hits: int = 0           # kaçıncı kâr alma kademesine gelindi
    realized: float = 0.0      # satışlardan gelen net USDT
    closed_at: Optional[float] = None
    exit_reasons: list[str] = field(default_factory=list)
    note_file: str = ""

    def __post_init__(self):
        if self.remaining < 0:
            self.remaining = self.amount
        self.highest_price = self.highest_price or self.entry_price

    @property
    def is_open(self) -> bool:
        return self.closed_at is None

    def gain(self, price: float) -> float:
        return price / self.entry_price - 1

    def pnl(self, price: float | None = None) -> float:
        """Gerçekleşen + (varsa) açık kısmın değeri - maliyet."""
        return self.realized + (self.remaining * price if price and self.is_open else 0.0) - self.cost


class Store:
    def __init__(self, state_dir: str):
        self.path = Path(state_dir) / "positions.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = json.loads(self.path.read_text()) if self.path.exists() else {"positions": [], "cooldown": {}}
        self.positions = [Position(**p) for p in data["positions"]]
        self.cooldown: dict[str, float] = data.get("cooldown", {})

    def save(self):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"positions": [asdict(p) for p in self.positions], "cooldown": self.cooldown}, indent=2))
        tmp.replace(self.path)

    def open_positions(self) -> list[Position]:
        return [p for p in self.positions if p.is_open]

    def has_open(self, symbol: str) -> bool:
        return any(p.symbol == symbol for p in self.open_positions())

    def add(self, p: Position):
        self.positions.append(p)
        self.save()

    def realized_today(self) -> float:
        start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        return sum(p.pnl() for p in self.positions if p.closed_at and p.closed_at >= start)

    def in_cooldown(self, symbol: str) -> bool:
        return self.cooldown.get(symbol, 0) > time.time()
