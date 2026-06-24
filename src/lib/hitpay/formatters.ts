// Vendored from hitpay-mcp. Presentational only — output style is best-effort, not asserted by tests.

const METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  paynow_online: 'PayNow',
  grabpay_direct: 'GrabPay',
  grabpay: 'GrabPay',
  shopee_pay: 'ShopeePay',
  wechat: 'WeChat Pay',
  wechat_pay: 'WeChat Pay',
  alipay: 'Alipay',
  fpx: 'FPX',
  promptpay: 'PromptPay',
  opn_prompt_pay: 'PromptPay',
  truemoney: 'TrueMoney',
  opn_true_money_qr: 'TrueMoney',
  vietqr: 'VietQR',
  qris: 'QRIS',
  upi: 'UPI',
  upi_qr: 'UPI',
  gcash: 'GCash',
  qrph_netbank: 'QR Ph',
  duitnow: 'DuitNow',
  payto: 'PayTo',
};

export function formatCurrency(amount: number | string, currency: string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return String(amount);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      currencyDisplay: 'code',
    }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(2)}`;
  }
}

export function formatPaymentMethod(method: string): string {
  const lower = method.toLowerCase();
  if (METHOD_LABELS[lower]) return METHOD_LABELS[lower];
  return method
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function redactCard(brand?: string, last4?: string): string {
  const label = brand ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase() : 'Card';
  return last4 ? `${label} •••• ${last4}` : label;
}
