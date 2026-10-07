#!/usr/bin/env python3
"""Ensure Netlify function salts exist before a live deploy.

VISIT_SALT and RATHER_SALT must be site environment variables available to
Functions (and Runtime). The old public defaults are rejected. A salt that is
already a real secret is left alone. A missing salt, a builds-only salt, or a
known default is replaced. The value is never printed.

If VISIT_SALT or RATHER_SALT is set in the environment, that value is copied
to Netlify. Otherwise a random secret is generated.
"""

import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

REJECTED_SALTS = frozenset({
    "dynasty-ticker-traffic-v1",
    "dynasty-ticker-rather-v1",
})
FUNCTION_SCOPES = frozenset({"functions", "runtime"})
LIVE_CONTEXTS = frozenset({"all", "production"})
SALT_KEYS = ("VISIT_SALT", "RATHER_SALT")


def salt_action(var):
    """Return 'keep' when functions can already read a non-default salt."""
    if not isinstance(var, dict):
        return "set"
    scopes = var.get("scopes") or []
    if scopes and not (set(scopes) & FUNCTION_SCOPES):
        return "set"
    readable = []
    has_live_context = False
    for entry in var.get("values") or []:
        if not isinstance(entry, dict):
            continue
        context = entry.get("context") or "all"
        if context not in LIVE_CONTEXTS:
            continue
        has_live_context = True
        value = str(entry.get("value") or "").strip()
        if value:
            readable.append(value)
    if any(value in REJECTED_SALTS for value in readable):
        return "set"
    if readable or has_live_context:
        return "keep"
    return "set"


def choose_secret(name):
    provided = os.environ.get(name, "").strip()
    if provided and provided not in REJECTED_SALTS:
        return provided
    return secrets.token_hex(32)


def _request(token, method, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        "https://api.netlify.com" + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "dynasty-ticker-ensure-salts",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8", "replace")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        error.read()
        return error.code, None
    except urllib.error.URLError as error:
        print(f"Netlify API request failed: {error}", file=sys.stderr)
        return 0, None


def _write_salt(token, account_id, site_id, key, secret, exists):
    scoped = {
        "key": key,
        "scopes": ["functions", "runtime"],
        "is_secret": True,
        "values": [{"context": "all", "value": secret}],
    }
    plain = {
        "key": key,
        "is_secret": True,
        "values": [{"context": "all", "value": secret}],
    }
    account = urllib.parse.quote(account_id, safe="")
    site = urllib.parse.quote(site_id, safe="")
    key_path = urllib.parse.quote(key, safe="")
    for payload in (scoped, plain):
        if exists:
            path = f"/api/v1/accounts/{account}/env/{key_path}?site_id={site}"
            status, _body = _request(token, "PUT", path, payload)
        else:
            path = f"/api/v1/accounts/{account}/env?site_id={site}"
            status, _body = _request(token, "POST", path, [payload])
        if status in (200, 201):
            return True
        if status == 409 and not exists:
            exists = True
            continue
        if status != 422:
            print(
                f"Netlify rejected {key} ({status}). "
                "Set it under Site configuration → Environment variables, "
                "Functions and Runtime scope. Do not use the old public defaults.",
                file=sys.stderr,
            )
            return False
    print(
        f"Netlify rejected {key}. Set it under Site configuration → Environment variables.",
        file=sys.stderr,
    )
    return False


def ensure_salts(token, site_id):
    site_path = "/api/v1/sites/" + urllib.parse.quote(site_id, safe="")
    status, site = _request(token, "GET", site_path)
    account_id = site.get("account_id") if isinstance(site, dict) else ""
    if status != 200 or not account_id:
        print(
            "Could not read the Netlify site. Refusing to deploy without VISIT_SALT and RATHER_SALT.",
            file=sys.stderr,
        )
        return 1
    status, env_vars = _request(token, "GET", site_path + "/env")
    if status != 200 or not isinstance(env_vars, list):
        print(
            "Could not read Netlify environment variables. Refusing to deploy.",
            file=sys.stderr,
        )
        return 1
    by_key = {
        item.get("key"): item
        for item in env_vars
        if isinstance(item, dict) and item.get("key")
    }
    for name in SALT_KEYS:
        current = by_key.get(name)
        if salt_action(current) == "keep":
            print(f"{name} is already set for functions.")
            continue
        secret = choose_secret(name)
        if not _write_salt(token, account_id, site_id, name, secret, current is not None):
            return 1
        print(f"{name} set on the Netlify site for functions. Value not printed.")
    return 0


def main():
    token = os.environ.get("NETLIFY_AUTH_TOKEN", "").strip()
    site_id = os.environ.get("NETLIFY_SITE_ID", "").strip()
    if not token or not site_id:
        print("Missing NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID.", file=sys.stderr)
        return 1
    return ensure_salts(token, site_id)


if __name__ == "__main__":
    sys.exit(main())
