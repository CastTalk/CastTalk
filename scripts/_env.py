"""Shared Appwrite settings for the maintenance scripts.

Secrets are read from the environment or from .env.local at the project root —
never hard-coded. (A key committed to this public repo must be treated as leaked.)

Uses the same variable names as the Next.js app:
  APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_SECRET
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_env_file(ROOT / ".env.local")

ENDPOINT = os.environ.get("APPWRITE_ENDPOINT", "https://syd.cloud.appwrite.io/v1")
PROJECT_ID = os.environ.get("APPWRITE_PROJECT_ID", "")
API_KEY = os.environ.get("APPWRITE_SECRET", "")
DATABASE_ID = "castdb"

if not PROJECT_ID or not API_KEY:
    sys.exit("APPWRITE_PROJECT_ID and APPWRITE_SECRET must be set (in .env.local or the environment).")
