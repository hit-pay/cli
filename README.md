# HitPay CLI

Manage payments, test webhooks, and generate QR codes from the terminal. The official developer CLI for [HitPay](https://www.hit-pay.com) — supporting 50+ payment methods across Southeast Asia, India, and Australia.

## Installation

```bash
npm install -g @hitpay/cli
```

Or run directly:

```bash
npx @hitpay/cli --help
```

## Quick Start

```bash
# 1. Switch to sandbox (default active environment is production)
hitpay env use sandbox

# 2. Sign in via browser (OAuth)
hitpay login

# Or set an API key instead (takes priority over OAuth)
hitpay config set api_key sk-sandbox-xxx

# 3. Check your account
hitpay whoami

# 4. Create a payment
hitpay payment create --amount 100 --currency SGD --email buyer@example.com

# 5. Generate a QR code in your terminal
hitpay qr create --amount 10 --currency SGD --method paynow_online

# 6. Listen for webhooks locally
hitpay listen --forward-to http://localhost:3000/webhook
```

## Authentication & configuration

Settings are stored in `~/.hitpay/config.json` (file mode `0600`). Each environment has its own profile (credentials, OAuth tokens, optional API URL override).

### Environment

```bash
hitpay env                              # Show active environment
hitpay env use sandbox                  # Switch default environment
hitpay env use production               # Switch back to production
```

Supported environments: `local`, `staging`, `sandbox`, `production`.

**Default active environment:** `production` (when unset in config).

### Sign in

```bash
hitpay login                            # OAuth via browser (active environment)
hitpay login --oauth-port 8085          # Custom callback port
```

`hitpay login` uses the **active environment**. Switch first with `hitpay env use <env>` — do not pass `--env` to login.

### API key (alternative to OAuth)

```bash
hitpay config set api_key sk-xxx        # Verify + save to active profile
hitpay config unset api_key             # Remove from active profile
```

When both API key and OAuth exist for a profile, **API key is used first**.

### Other config

```bash
hitpay config set currency SGD
hitpay config set country SG
hitpay config set salt <webhook-salt>
hitpay config get api_key
hitpay config list
hitpay config list --all                # All environment profiles
hitpay logout                           # Clear OAuth tokens
hitpay logout --all                     # Clear OAuth + API key + salt
hitpay whoami                           # Account info + auth method
```

Use `hitpay env use <env>` to switch environments — not `config set environment`.

## Global options

| Flag | Description |
|------|-------------|
| `--env <environment>` | One-off environment override for this command only |
| `--api-key <key>` | One-off API key override (not saved) |
| `--json` | Output results as JSON |
| `--help` | Show help |
| `--version` | Show CLI version |

Examples:

```bash
hitpay balance --env sandbox             # Check sandbox without changing default
hitpay whoami --env production --json
hitpay balance --api-key "$CI_KEY" --env sandbox
```

Credentials are **not** read from `HITPAY_*` environment variables — use config commands or flags above.

## Commands

### Account

```bash
hitpay balance
hitpay account
```

### Payments

```bash
hitpay payment create --amount 100 --currency SGD --email buyer@example.com
hitpay payment create --amount 25 --currency SGD --method paynow_online --qr
hitpay payment get <payment-id>
hitpay payment list --limit 10 --status completed
hitpay payment cancel <payment-id>
```

### Charges (Transaction History)

```bash
hitpay charge list --status succeeded --date-from 2026-03-01 --limit 20
hitpay charge get <charge-id>
hitpay charge export --date-from 2026-03-01 --date-to 2026-03-31
```

### Refunds

```bash
hitpay refund --payment-id <charge-id> --amount 50.00
hitpay refund --payment-id <charge-id> --yes
```

### Customers

```bash
hitpay customer create --name "John Doe" --email john@example.com
hitpay customer list --search "john"
hitpay customer get <customer-id>
```

### Invoices

```bash
hitpay invoice create --amount 500 --currency SGD --customer-email john@example.com
hitpay invoice list --status pending
```

### Subscription Plans

```bash
hitpay plan create --name "Pro Monthly" --amount 49.99 --currency SGD --cycle monthly
hitpay plan list
```

### Recurring Billing

```bash
hitpay subscription create --plan-id <id> --customer-email user@example.com
hitpay subscription list --status active
```

### Payouts

```bash
hitpay beneficiary create --country SG --currency SGD --holder-name "John" \
  --account 1234567890 --bank-swift DBSSSGSG
hitpay transfer create --beneficiary-id <id> --amount 1000 --currency SGD
```

### QR Codes

```bash
hitpay qr create --amount 10 --currency SGD --method paynow_online
```

### Payment Methods

```bash
hitpay methods --country SG
hitpay methods --live
```

### Webhook Testing

```bash
hitpay listen --forward-to http://localhost:3000/webhook
hitpay trigger payment_request.completed
hitpay trigger --list
```

Run `hitpay help` for a grouped overview of all commands.

## Configuration reference

| Key | Scope | Description |
|-----|-------|-------------|
| `environment` | Global | Active environment (`hitpay env use`) |
| `currency` | Global | Default currency code |
| `country` | Global | Default country code |
| `api_key` | Per env | API key (via `config set api_key`) |
| `salt` | Per env | Webhook signature salt |
| `oauth` | Per env | OAuth tokens (via `hitpay login`) |

## HitPay Developer Ecosystem

| Tool | Purpose | Install |
|------|---------|---------|
| **CLI** (this) | Terminal-native developer workflows | `npm i -g @hitpay/cli` |
| [Claude Code Plugin](https://docs.hitpayapp.com/apis/guide/claude-code-plugin) | AI-powered integration in Claude Code | `claude plugin add hit-pay/claude-code-plugin` |
| [Agent Skills](https://docs.hitpayapp.com/apis/guide/ai-skills) | Code generation for Cursor, Copilot, Windsurf | `npx skills add hit-pay/agent-skills` |
| [MCP Server](https://www.npmjs.com/package/hitpay-mcp) | 39 MCP tools for AI agents | `npx hitpay-mcp` |

## Development

```bash
git clone https://github.com/hit-pay/cli.git
cd cli
npm install
npm run dev -- --help
npm run build
npm test
```

## Requirements

- Node.js 18+
- A [HitPay account](https://dashboard.hit-pay.com/register) (sandbox available)

## License

MIT — see [LICENSE](LICENSE).
