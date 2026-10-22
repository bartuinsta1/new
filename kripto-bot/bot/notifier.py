"""Bildirimler: Telegram ve genel webhook (Discord, Slack, n8n, Zapier, Make, kendi sunucunuz)."""
from __future__ import annotations

import logging

import requests

log = logging.getLogger(__name__)


class Notifier:
    def __init__(self, cfg: dict, post=None):
        self.n = cfg["notify"]
        self.s = cfg["secrets"]
        self.mode = cfg["mode"]
        self.post = post or (lambda url, **kw: requests.post(url, timeout=10, **kw))

    def send(self, text: str, event: str = "info", data: dict | None = None):
        prefix = "🧪 PAPER" if self.mode == "paper" else "💰 LIVE"
        msg = f"{prefix} · {text}"
        log.info(msg)
        if self.n.get("telegram") and self.s.get("telegram_token") and self.s.get("telegram_chat_id"):
            try:
                self.post(f"https://api.telegram.org/bot{self.s['telegram_token']}/sendMessage",
                          json={"chat_id": self.s["telegram_chat_id"], "text": msg, "disable_web_page_preview": True})
            except Exception as exc:
                log.warning("Telegram gönderilemedi: %s", exc)
        if self.n.get("webhook") and self.s.get("webhook_url"):
            try:
                # "content" Discord, "text" Slack içindir; event/data otomasyon araçları için
                self.post(self.s["webhook_url"], json={"content": msg, "text": msg, "event": event, "mode": self.mode, "data": data or {}})
            except Exception as exc:
                log.warning("Webhook gönderilemedi: %s", exc)
