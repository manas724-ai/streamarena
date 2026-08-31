// Copyright (c) 2026 Aussi-Nexus Group. All Rights Reserved.
// Proprietary and confidential — see LICENSE at the repository root.
//
// Same pluggable-provider pattern as lib/payments.ts: nothing outside this
// file talks to a specific email vendor's SDK. Swap MockEmailProvider for
// a real one (SendGrid, Postmark, Resend, or the Gmail API) by implementing
// this interface — every call site (ticketService.ts) stays unchanged.

export interface EmailSendResult {
  ok: true;
  providerRef: string;
}

export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<EmailSendResult>;
}

class MockEmailProvider implements EmailProvider {
  async send(to: string, subject: string, body: string): Promise<EmailSendResult> {
    // A real implementation calls the provider's send API here. We log
    // instead, so the whole support loop is genuinely exercised end to end
    // without requiring email credentials to run this prototype.
    const providerRef = `mock_email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[email:mock] → ${to} | ${subject}\n${body}\n(providerRef=${providerRef})`);
    return { ok: true, providerRef };
  }
}

export const emailProvider: EmailProvider = new MockEmailProvider();
