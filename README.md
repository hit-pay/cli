# HitPay CLI

Manage payments, test webhooks, and generate QR codes from the terminal. The official developer CLI for [HitPay](https://www.hit-pay.com) — supporting 50+ payment methods across Southeast Asia, India, and Australia.

## Installation

```bash
npm install -g @hit-pay/cli
```

Or run directly:

```bash
npx @hit-pay/cli --help
```

## Quick Start

```bash
# 1. Authenticate with your API key
hitpay login

# 2. Check your balance
hitpay balance

# 3. Create a payment
hitpay payment create --amount 100 --currency SGD --email buyer@example.com

# 4. Generate a QR code in your terminal
hitpay qr create --amount 10 --currency SGD --method paynow_online

# 5. Listen for webhooks locally
hitpay listen --forward-to http://localhost:3000/webhook
```

## Commands

### Authentication

```bash
hitpay login                              # Interactive API key setup
hitpay login --api-key sk-live-xxx        # Non-interactive
hitpay logout                             # Clear stored credentials
hitpay whoami                             # Show account info + environment
```

### Configuration

```bash
hitpay config set environment production  # Switch sandbox <> production
hitpay config set currency SGD            # Set default currency
hitpay config get environment
hitpay config list
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
hitpay charge list --payment-method paynow_online --amount-from 100
hitpay charge get <charge-id>             # Includes fee breakdown
hitpay charge export --date-from 2026-03-01 --date-to 2026-03-31
```

### Refunds

```bash
hitpay refund --payment-id <charge-id> --amount 50.00    # Partial refund
hitpay refund --payment-id <charge-id>                   # Full refund
hitpay refund --payment-id <charge-id> --yes             # Skip confirmation
```

### Customers

```bash
hitpay customer create --name "John Doe" --email john@example.com
hitpay customer list --search "john"
hitpay customer get <customer-id>
hitpay customer update <customer-id> --email new@example.com
hitpay customer delete <customer-id>
```

### Invoices

```bash
hitpay invoice create --amount 500 --currency SGD --customer-email john@example.com
hitpay invoice list --status pending
hitpay invoice delete <invoice-id>
```

### Subscription Plans

```bash
hitpay plan create --name "Pro Monthly" --amount 49.99 --currency SGD --cycle monthly
hitpay plan list
hitpay plan get <plan-id>
hitpay plan delete <plan-id>
```

### Recurring Billing

```bash
hitpay subscription create --plan-id <id> --customer-email user@example.com
hitpay subscription list --status active
hitpay subscription get <subscription-id>
hitpay subscription cancel <subscription-id>
```

### Payouts

```bash
# Beneficiaries
hitpay beneficiary create --country SG --currency SGD --holder-name "John" \
  --account 1234567890 --bank-swift DBSSSGSG
hitpay beneficiary list
hitpay beneficiary delete <id>

# Transfers
hitpay transfer estimate --beneficiary-id <id> --amount 1000 --currency SGD
hitpay transfer create --beneficiary-id <id> --amount 1000 --currency SGD
hitpay transfer list --status paid
hitpay transfer get <transfer-id>
```

### QR Codes

```bash
hitpay qr create --amount 10 --currency SGD --method paynow_online
```

Renders the QR code directly in your terminal.

### Payment Methods

```bash
hitpay methods --country SG               # PayNow, GrabPay, ShopeePay, cards
hitpay methods --country MY               # FPX, GrabPay, Touch 'n Go, DuitNow
hitpay methods --country PH               # GCash, QRPH, ShopeePay
hitpay methods --live                     # Show methods enabled on your account
```

Supported countries: SG, MY, PH, TH, ID, VN, IN, AU.

### Webhook Testing

```bash
# Forward webhooks to your local dev server
hitpay listen --forward-to http://localhost:3000/webhook
hitpay listen --forward-to http://localhost:3000/webhook --events charge.created

# Simulate webhook events
hitpay trigger payment_request.completed
hitpay trigger charge.created --url http://localhost:3000/webhook
hitpay trigger --list                     # Show all 18 event types
```

The `listen` command creates a tunnel via [localtunnel](https://github.com/localtunnel/localtunnel), registers it as a webhook endpoint with HitPay, and forwards received events to your local server. Press Ctrl+C to clean up.

## Global Options

| Flag | Description |
|------|-------------|
| `--json` | Output results as JSON (for scripting) |
| `--env <environment>` | Override environment (`sandbox` or `production`) |
| `--help` | Show help for any command |
| `--version` | Show CLI version |

## Configuration

Credentials are stored in `~/.hitpay/config.json` with `0600` file permissions.

| Key | Description | Default |
|-----|-------------|---------|
| `api_key` | HitPay API key | — |
| `salt` | Webhook signature salt | — |
| `environment` | `sandbox` or `production` | `sandbox` |
| `currency` | Default currency code | — |
| `country` | Default country code | — |

Environment variables:

```bash
export HITPAY_API_KEY=your-api-key
export HITPAY_ENVIRONMENT=sandbox
```

## HitPay Developer Ecosystem

| Tool | Purpose | Install |
|------|---------|---------|
| **CLI** (this) | Terminal-native developer workflows | `npm i -g @hit-pay/cli` |
| [Claude Code Plugin](https://docs.hitpayapp.com/apis/guide/claude-code-plugin) | AI-powered integration in Claude Code | `claude plugin add hit-pay/claude-code-plugin` |
| [Agent Skills](https://docs.hitpayapp.com/apis/guide/ai-skills) | Code generation for Cursor, Copilot, Windsurf | `npx skills add hit-pay/agent-skills` |
| [MCP Server](https://www.npmjs.com/package/hitpay-mcp) | 39 MCP tools for AI agents | `npx hitpay-mcp` |

## Development

```bash
git clone https://github.com/hit-pay/cli.git
cd cli
npm install
npm run dev -- --help          # Run from source
npm run build                  # Build with tsup
npm test                       # Run tests
```

## Requirements

- Node.js 18+
- A [HitPay account](https://dashboard.hit-pay.com/register) (sandbox available)

## License

MIT
