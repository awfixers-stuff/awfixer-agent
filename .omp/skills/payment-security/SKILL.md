---
name: payment-security
description: Security guidelines for Stripe and payment integrations
---

# Payment Security

## Purpose

Audit Stripe and payment system integrations.

## Key Areas

1. **Webhook Validation**: Ensure webhook signatures (`Stripe-Signature`) are verified to prevent spoofing.
2. **Idempotency**: Use Idempotency-Key headers for all mutations.
3. **Price Validation**: Always calculate prices on the server, NEVER trust the client.
4. **PCI DSS Scope**: Use Stripe Elements or Checkout. Server must not touch raw credit card data.
5. **State Management**: Verify that fulfillment only happens after a successful `payment_intent.succeeded` event.
