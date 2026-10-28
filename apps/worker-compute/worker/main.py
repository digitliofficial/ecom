"""Phase 0: Redis connection only — Celery/RQ/arq later."""

from __future__ import annotations

import os
import time

try:
    import redis
except ImportError:  # pragma: no cover
    redis = None  # type: ignore


def main() -> None:
    url = os.environ.get("REDIS_URL", "redis://localhost:6379")
    if redis is None:
        print("[worker-compute] redis package missing")
        return
    client = redis.Redis.from_url(url, socket_connect_timeout=2)
    try:
        client.ping()
        print("[worker-compute] redis connected; noop loop")
    except Exception as exc:  # noqa: BLE001
        print(f"[worker-compute] redis unavailable (ok for Phase 0): {exc}")

    while True:
        time.sleep(60)


if __name__ == "__main__":
    main()
