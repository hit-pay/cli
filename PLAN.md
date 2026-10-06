# HitPay CLI — Internal Plan

> Status: **Implemented (pre-publish)** · Last updated: 2026-07-19

## Summary

Official CLI for HitPay payments, webhooks, and QR codes. Auth supports **OAuth (default login)** and **API key per environment profile**. Four hardcoded environments with profile-based config in `~/.hitpay/config.json`.

## Environments

| Environment | API base URL |
|-------------|--------------|
| `local` | `https://api.src.test` |
| `staging` | `https://api.staging.hit-pay.com` |
| `sandbox` | `https://api.sandbox.hit-pay.com` |
| `production` | `https://api.hit-pay.com` |

- URLs are **hardcoded** in `src/lib/hitpay/environments.ts` (not `HITPAY_*` env vars).
- **Default active environment:** `production` when unset.

## Config

Stored at `~/.hitpay/config.json` (mode `0600`):

```json
{
  "environment": "production",
  "currency": "SGD",
  "country": "SG",
  "profiles": {
    "sandbox": {
      "api_key": "sk-...",
      "salt": "...",
      "oauth": { "access_token": "...", "refresh_token": "...", "expires_at": 0, "token_type": "Bearer" }
    }
  }
}
```

- Legacy flat `api_key` / `salt` at root is migrated into `profiles` on read.
- Switch default env: `hitpay env use sandbox` (not `config set environment`).

## Authentication

| Method | Command | Notes |
|--------|---------|-------|
| OAuth | `hitpay login` | Device authorization grant (RFC 8628); tokens saved to active profile |
| API key | `hitpay config set api_key <key>` | Verified against API; takes priority over OAuth |
| Logout | `hitpay logout` / `hitpay logout --all` | Clears OAuth; `--all` also clears API key + salt |

**Auth priority in `createClient()`:**

1. `--api-key` flag (one-off override)
2. Profile `api_key`
3. Profile OAuth (auto-refresh)

**401 suggestions:** OAuth → `hitpay login`; API key → `hitpay config set api_key`.

## CLI UX

```bash
hitpay env                              # show active environment
hitpay env use sandbox                  # switch default environment
hitpay login                            # OAuth for active environment
hitpay config set api_key sk-xxx        # save API key to active profile
hitpay balance --env production         # one-off env override (does not change default)
```

Global flags (one-off, not persisted):

- `--env <environment>`
- `--api-key <key>`
- `--json`

## OAuth implementation

- `src/lib/auth/oauth.ts` — request device code, show user code, open `dashboard/oauth/device`
- `src/lib/auth/token-manager.ts` — device code request + polling (`authorization_pending` / `slow_down`), refresh + expiry buffer
- The OAuth app must be public (no secret) with grant types `urn:ietf:params:oauth:grant-type:device_code` and `refresh_token`
- One fixed client ID for every environment (`HITPAY_CLI_CLIENT_ID` in `environments.ts`), created by the core migration `create_hitpay_cli_oauth_client`

## Pre-publish checklist

- [x] Register first-party OAuth app per environment (core migration)
- [ ] CI workflow (test + typecheck)
- [ ] npm publish `@hitpay/cli`
