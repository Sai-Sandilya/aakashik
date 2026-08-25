# Aakashik API — Validation Hardening Plan

E-commerce APIs must **never trust the client** for prices, stock, or discounts. Each phase below has dedicated test IDs (`TC-VAL*`).

| Phase | Risk if missing | Fix | Tests |
|-------|-----------------|-----|-------|
| **1. Server pricing** | Customer pays ₹1 for ₹599 kit | Compute totals from DB catalog; reject price tampering | TC-VAL01–06 |
| **2. Cart integrity** | Oversell / empty lines / qty abuse | Require productId, qty 1–99, merge duplicate lines | TC-VAL07–11 |
| **3. Payment validation** | Invalid UPI/card stored | Whitelist cod/upi/card; validate UPI/card like storefront | TC-VAL12–16 |
| **4. Delivery hardening** | Garbage addresses | Max lengths, trim, phone/email rules (match store) | TC-VAL17–21 |
| **5. Atomic checkout** | Stock deducted but order fails | Single DB transaction for stock + order | TC-VAL22–23 |
| **6. Cancel restores stock** | Inventory drift after cancel | Restock items when admin cancels (not delivered) | TC-VAL24–25 |
| **7. Admin product guards** | Broken catalog / huge uploads | Name/desc limits, photo ≤1.5MB, concern whitelist | TC-VAL30–35 |
| **8. Admin query guards** | Bad filters crash admin | Valid status/filter enums; order id format | TC-VAL40–44 |
| **9. Member discount rules** | Stacked 20%+ discounts | Max 10%; subscribe wins over member per line | TC-VAL50–52 |

Automated specs: `api/tests/validation.test.js`
