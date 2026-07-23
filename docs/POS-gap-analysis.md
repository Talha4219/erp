# POS Module — Gap Analysis

Comparison of the target POS specification against the POS that exists in the codebase today.
Scope of what exists: `app/(erp)/pos/page.tsx`, `app/api/retail/pos/route.ts`,
`app/api/retail/pos/return/route.ts`, and the `Retail*` / `ReturnRefund` models in
`prisma/schema.prisma`.

---

## 1. Current state (what's actually built)

A single-screen retail checkout, functional end to end for the happy path:

- **Product search** by SKU/name (`/api/retail/products`), results in a dropdown.
- **Basket** with add, +/- quantity, remove; auto-selects a batch via **FEFO**
  (`selectFefoBatch`, earliest expiry first, then earliest received).
- **Customer** lookup by email/phone (optional), links a `RetailCustomer` and shows loyalty points.
- **Totals**: net, VAT (per-line rate), grand total — computed client-side.
- **Payment method**: single choice of `Cash` / `Card` / `Contactless`.
- **Confirm Sale** → creates `RetailSalesOrder` + line items, decrements batch stock,
  awards loyalty points (1 pt per £1), all inside one transaction.
- **Receipt**: an on-screen "Sale Complete" modal (total, VAT, order #, method).
- **Returns**: a dialog that posts to `/api/retail/pos/return`, which creates a
  `ReturnRefund` and increments batch stock back.

So the spec's **Sales Screen → Payment → Invoice → Stock Update** core is present.
Everything around it (shift, cash drawer, split tender, reporting, real receipts) is not.

---

## 2. Feature-by-feature gap table

| Spec area | Status | Notes |
| --- | --- | --- |
| Cashier login | ✅ Exists | Standard app auth; no POS-specific cashier concept. |
| **Open Shift** (opening float, register) | ❌ Missing | No shift model, no opening-cash capture. |
| Select customer | ✅ Exists | Walk-in (null) or linked `RetailCustomer`. |
| Add products (search) | ✅ Exists | Search + dropdown. |
| **Barcode-first scanning** | ✅ Exists | Scan box with Enter-to-add (barcode → secondary barcode → SKU); repeated scans bump qty. Barcodes managed on Inventory Items (unique, Code 128 label printing). |
| Line discount | ⚠️ Partial | Data model + math support `lineDiscountGbp`, but the UI has **no control to enter it** (always 0). |
| **Invoice-level discount** | ⚠️ Partial | `totalDiscountGbp` exists in schema/API but UI always sends 0. |
| Tax (VAT) calculation | ✅ Exists | Per-line VAT rate; see rounding note in §4. |
| **Payment screen** | ⚠️ Basic | Method is a 3-way toggle; no amount-tendered / change-due entry. |
| **Cash payment (tendered + change)** | ❌ Missing | No "customer gives / change" calculation. |
| Card payment (ref #) | ❌ Missing | No card reference/auth field captured. |
| **Split payment** (multiple tenders) | ❌ Missing | `paymentMethod` is a single string; no tender lines. |
| Extra tenders (wallet, gift card, store credit) | ❌ Missing | Only Cash/Card/Contactless. |
| Invoice creation | ⚠️ Partial | Row is created but has **no human invoice number** (e.g. `POS-2026-00045`); only an autoincrement `id`. |
| Inventory update | ✅ Exists | Batch `quantityOnHand` decremented in the sale transaction. |
| **Receipt delivery** (print / email / PDF / WhatsApp) | ❌ Missing | Only an on-screen modal; no print stylesheet, PDF, or email. |
| **Returns** (find invoice → pick items → refund) | ⚠️ Broken | Dialog hardcodes line id, qty, and £0 refund — see §4. |
| Return reasons | ⚠️ Partial | Free-text only; no controlled list. |
| Refund methods | ❌ Missing | Refund tender is not captured. |
| **Cash management** (cash in / out) | ❌ Missing | No drawer movements. |
| **Shift closing** (expected vs counted, variance) | ❌ Missing | No close, count, or variance. |
| **POS reports** (daily sales, tender mix, cashier perf, product sales) | ❌ Missing | `GET /api/retail/pos` lists recent orders only; no aggregated reports UI. |
| Offline mode | ❌ Missing | Fully online; every action hits the API. |

Legend: ✅ built · ⚠️ partial/stubbed · ❌ not present.

---

## 3. Data-model gaps (`prisma/schema.prisma`)

`RetailSalesOrder` today: `id`, `transactionDate`, `customerId?`, `paymentMethod (String)`,
`totalDiscountGbp`, `netTotalGbp`, `vatAmountGbp`, `grandTotalGbp`. To reach the spec you'd add:

- **`PosShift`** — cashier/user, register, openingCash, closingCountedCash, expectedCash,
  variance, openedAt/closedAt, status. Link `RetailSalesOrder.shiftId`.
- **`CashMovement`** — shiftId, type (`IN`/`OUT`), amount, reason, timestamp.
- **`PosPayment` / tender lines** — orderId, method, amount, reference (enables split payment
  and replaces the single `paymentMethod` string).
- **`RetailSalesOrder.orderNumber`** — a unique, human-facing invoice number
  (there's already a `nextDocNumber`/numbering service in `lib/services/numbering.ts` to reuse).
- **`RetailSalesOrder.cashierId`** — who rang the sale (for cashier reports).
- **`ReturnRefund.refundMethod`** and a link to the specific sold line + a sold-vs-returned
  quantity guard.

Migrations here are via `prisma db push` (this project has no SQL migration files).

---

## 4. Correctness / integrity issues in what already exists

These are real bugs in current code, independent of the missing features — worth fixing regardless of scope.

1. **Returns are effectively non-functional.** The UI hardcodes the payload
   (`app/(erp)/pos/page.tsx:348`): `originalLineId: 1`, `quantityReturned: 1`,
   `refundAmountGbp: 0`. So every "return" refunds £0 against line id 1, regardless of which
   order/line the customer is actually returning. The dialog collects only an order id and reason.

2. **Return API does no validation.** `app/api/retail/pos/return/route.ts` does not check that
   the line belongs to the given order, nor that cumulative returns don't exceed the quantity
   sold. The same item can be returned repeatedly, each time incrementing stock.

3. **Totals are trusted from the client.** `POST /api/retail/pos` stores
   `netTotalGbp` / `vatAmountGbp` / `grandTotalGbp` straight from the request body
   (`route.ts:60-62`) without recomputing from product prices. A crafted request can record a
   sale at any total (e.g. £0) while still decrementing stock. Recompute server-side.

4. **Missing authorization.** Both POS routes check only `if (!session)` — any authenticated
   user (including low-privilege roles) can ring sales or process refunds. Add a `pos` module
   check (the `hasModuleAccess` helper in `lib/authz.ts` already exists for this).

5. **Stock check/decrement race.** Availability is validated *before* the transaction
   (`route.ts:41-52`) but decremented *inside* it, with no `Serializable` isolation — concurrent
   sales of the same batch can oversell. Move the check inside the transaction (or use a
   conditional decrement).

6. **VAT rounding.** VAT is summed in floating point with no per-line rounding to the penny,
   so totals can carry sub-penny drift.

---

## 5. Suggested build order (if/when we implement)

Phased so each phase is independently shippable, most foundational first:

1. **Phase 0 — fix existing bugs** (§4): server-side total recompute, POS authorization,
   real return flow + validation. Small, high value, no new UI surface.
2. **Phase 1 — Shift lifecycle + cash drawer**: `PosShift` + `CashMovement` models, Open Shift
   / Close Shift screens, cash in/out. Gates the day's takings and enables variance.
3. **Phase 2 — Payment upgrade**: tender lines (`PosPayment`), amount-tendered/change for cash,
   card reference, split payment, extra tenders. Replace the single `paymentMethod` string.
4. **Phase 3 — Invoice number + receipts**: human order number via the numbering service;
   printable receipt (print CSS) then optional PDF/email.
5. **Phase 4 — POS reports**: daily sales, tender-method mix, cashier performance, product sales.
6. **Phase 5 — polish**: barcode-first UX, line/invoice discount controls, keyboard shortcuts,
   optional offline mode.

---

## 6. One-line summary

The **sell-a-basket-and-decrement-stock** core exists and works; the **operational shell around
it** — shifts, cash management, real payments/receipts, returns that actually refund, and
reporting — does not. Before adding features, the six correctness issues in §4 (especially
client-trusted totals and the broken return flow) should be fixed.
