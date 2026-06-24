// Vendored from hitpay-mcp. Response types derived from live sandbox API JSON
// and the CLI's own field-access sites. ponytail: type-only — erased at runtime.

// ---- Pagination wrappers -------------------------------------------------

export interface PagePaginatedResponse<T> {
  data: T[];
  links?: { first?: string | null; last?: string | null; prev?: string | null; next?: string | null };
  meta?: {
    current_page: number;
    from?: number | null;
    last_page: number;
    links?: unknown[];
    path?: string;
    per_page: number;
    to?: number | null;
    total: number;
  };
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

// ---- Shared sub-shapes ---------------------------------------------------

interface ChargePaymentMethod {
  name: string;
  data?: { brand?: string; last4?: string };
}

interface CustomerRef {
  email?: string;
  name?: string;
  phone?: string;
}

// ---- Domain responses ----------------------------------------------------

export interface PaymentRequestResponse {
  id: string;
  amount: number | string;
  currency: string;
  status: string;
  purpose?: string;
  reference_number?: string;
  email?: string;
  name?: string;
  phone?: string;
  payment_methods?: string[];
  url?: string;
  redirect_url?: string;
  webhook?: string;
  channel?: string;
  qr_code_data?: { qr_code?: string; qr_contents?: string };
  expires_after?: string;
  created_at: string;
  updated_at?: string;
}

export interface ChargeResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: ChargePaymentMethod;
  customer?: CustomerRef;
  remark?: string;
  order_reference_number?: string;
  reference_number?: string;
  channel?: string;
  fixed_fee?: number;
  discount_fee?: number;
  discount_fee_rate?: number;
  created_at: string;
}

export interface RefundResponse {
  id: string;
  payment_id: string;
  amount_refunded: number;
  total_amount: number;
  currency: string;
  payment_method?: string;
  status?: string;
  created_at: string;
}

export interface BalanceResponse {
  currency: string;
  wallets: { available: number; pending: number; deposit: number };
}

export interface AccountStatusResponse {
  bank_account_status?: string;
  verification?: {
    overall_status?: string;
    owner_verification?: string;
    business_verification?: string;
  };
  payment_providers?: Record<
    string,
    { setup_status: string; payment_enabled?: boolean; payout_enabled?: boolean }
  >;
}

export interface CustomerResponse {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  created_at: string;
  updated_at?: string;
}

export interface InvoiceResponse {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status?: string;
  customer_email?: string;
  customer_name?: string;
  url?: string;
  due_date?: string;
  created_at: string;
}

export interface BeneficiaryResponse {
  id: string;
  name?: string;
  nickname?: string;
  country?: string;
  currency: string;
  holder_type?: string;
  holder_name?: string;
  bank_swift_code?: string;
  account_number: string;
  transfer_method?: string;
  transfer_type?: string;
  status?: string;
  created_at?: string;
}

export interface TransferResponse {
  id: string;
  payment_amount: number;
  payment_currency: string;
  source_amount: number;
  source_currency: string;
  source_amount_fees?: number;
  fee_currency: string;
  total_fee: number;
  exchange_rate?: number;
  status?: string;
  beneficiary_id?: string;
  beneficiary: {
    holder_name: string;
    bank_swift_code: string;
    account_number: string;
  };
  reference?: string;
  remark?: string;
  created_at: string;
}

export interface TransferEstimateResponse {
  payment_amount: number;
  payment_currency: string;
  source_amount: number;
  source_currency: string;
  source_amount_fees: number;
  fee_currency: string;
  exchange_rate?: number;
  fee_payer?: string;
}

export interface RecurringBillingResponse {
  id: string;
  amount: number;
  currency: string;
  status?: string;
  name?: string;
  description?: string;
  url?: string;
  cycle?: string;
  cycle_repeat?: number;
  times_charged?: number;
  times_to_be_charged?: number;
  start_date?: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  created_at?: string;
}

export interface WebhookEventResponse {
  id: string;
  event?: string;
  type?: string;
  status?: string;
  payload?: Record<string, unknown>;
  created_at?: string;
}
