// Pluggable payment provider so the rest of the app never talks to a
// specific vendor SDK directly — swap MockPaymentProvider for a real
// Stripe/Adyen/PayPal-backed implementation without touching callers.
// If STRIPE_SECRET_KEY is set we would construct a real Stripe-backed
// provider here; for this prototype (and for anyone running it without
// live payment credentials) we always use the mock, which "succeeds"
// instantly — the same interface a real provider would fulfill
// asynchronously via webhook (a real integration should NOT grant
// currency/access until the webhook confirms payment, not at checkout
// creation time — see README.md "Scaling to production").

export interface CheckoutResult {
  ok: true;
  providerRef: string;
}

export interface PaymentProvider {
  /** One-time purchase of virtual currency ("sparks"). */
  purchaseCurrency(userId: string, packId: string, sparks: number, priceUsd: number): Promise<CheckoutResult>;
  /** One-time real-money purchase that unlocks Full Access (see FULL_ACCESS_PRODUCT in @streamarena/shared). */
  purchaseFullAccess(userId: string, priceUsd: number): Promise<CheckoutResult>;
}

class MockPaymentProvider implements PaymentProvider {
  async purchaseCurrency(userId: string, packId: string): Promise<CheckoutResult> {
    return { ok: true, providerRef: `mock_currency_${packId}_${userId}_${Date.now()}` };
  }

  async purchaseFullAccess(userId: string): Promise<CheckoutResult> {
    return { ok: true, providerRef: `mock_fullaccess_${userId}_${Date.now()}` };
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
