"""Remove public access from every collection in the castdb database.

The collections were created with read/write/create/update/delete("any"), so
anyone holding the (public) project ID could read or change every user's
notifications, schedules, chats and messages straight from a browser.

The Next.js API routes use a server API key, which bypasses collection
permissions, so they keep working after this. No browser code talks to
Appwrite directly anymore.

Usage (from the project root, with the NEW key in .env.local):
    python scripts/lock_down_permissions.py           # dry run: show what would change
    python scripts/lock_down_permissions.py --apply   # apply
"""

import json
import sys
import urllib.error
import urllib.request

from _env import API_KEY, DATABASE_ID, ENDPOINT, PROJECT_ID


def request(path: str, method: str = "GET", body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{ENDPOINT}{path}",
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        method=method,
        headers={
            "X-Appwrite-Project": PROJECT_ID,
            "X-Appwrite-Key": API_KEY,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        sys.exit(f"Appwrite {method} {path} failed ({e.code}): {detail}")


def main() -> None:
    apply = "--apply" in sys.argv
    collections = request(f"/databases/{DATABASE_ID}/collections?queries[]=" + urllib.request.quote('{"method":"limit","values":[100]}'))["collections"]

    changed = 0
    for col in collections:
        perms = col.get("$permissions", [])
        doc_security = col.get("documentSecurity", False)
        is_open = bool(perms) or doc_security
        status = "OPEN  " if is_open else "locked"
        print(f"[{status}] {col['$id']:<16} permissions={perms} documentSecurity={doc_security}")
        if not is_open:
            continue
        changed += 1
        if apply:
            request(
                f"/databases/{DATABASE_ID}/collections/{col['$id']}",
                "PUT",
                {
                    "name": col["name"],
                    "permissions": [],
                    "documentSecurity": False,
                    "enabled": col.get("enabled", True),
                },
            )
            print(f"         -> locked {col['$id']}")

    if not changed:
        print("\nAll collections are already locked.")
    elif apply:
        print(f"\nLocked {changed} collection(s). Only the server API key can access them now.")
    else:
        print(f"\n{changed} collection(s) would be locked. Re-run with --apply to do it.")


if __name__ == "__main__":
    main()
