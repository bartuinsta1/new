"""Ayar yükleme: varsayılanlar + config.yaml + .env."""
from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any

import yaml

try:
    from dotenv import load_dotenv
except ImportError:  # python-dotenv opsiyonel
    load_dotenv = None

ROOT = Path(__file__).resolve().parent.parent
DEFAULTS_FILE = ROOT / "config.example.yaml"


def deep_merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = copy.deepcopy(value)
    return out


def load_config(path: str | os.PathLike | None = None, overrides: dict | None = None) -> dict[str, Any]:
    if load_dotenv:
        load_dotenv(ROOT / ".env")
    with open(DEFAULTS_FILE, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    path = Path(path) if path else ROOT / "config.yaml"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            cfg = deep_merge(cfg, yaml.safe_load(f) or {})
    if overrides:
        cfg = deep_merge(cfg, overrides)

    # Göreli yollar kripto-bot klasörüne göre çözülür.
    for key in ("state_dir",):
        cfg[key] = str((ROOT / cfg[key]).resolve()) if not os.path.isabs(cfg[key]) else cfg[key]
    vp = cfg["obsidian"]["vault_path"]
    cfg["obsidian"]["vault_path"] = str((ROOT / vp).resolve()) if not os.path.isabs(vp) else vp

    cfg["secrets"] = {
        "api_key": os.getenv("EXCHANGE_API_KEY", ""),
        "api_secret": os.getenv("EXCHANGE_API_SECRET", ""),
        "api_password": os.getenv("EXCHANGE_API_PASSWORD", ""),
        "cryptopanic_token": os.getenv("CRYPTOPANIC_TOKEN", ""),
        "anthropic_api_key": os.getenv("ANTHROPIC_API_KEY", ""),
        "telegram_token": os.getenv("TELEGRAM_BOT_TOKEN", ""),
        "telegram_chat_id": os.getenv("TELEGRAM_CHAT_ID", ""),
        "webhook_url": os.getenv("WEBHOOK_URL", ""),
    }
    if os.getenv("BOT_MODE"):
        cfg["mode"] = os.getenv("BOT_MODE")
    if cfg["mode"] not in ("paper", "live"):
        raise ValueError(f"mode 'paper' veya 'live' olmalı, gelen: {cfg['mode']}")
    return cfg
