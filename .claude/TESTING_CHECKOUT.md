# Checkout + Order History Testing Guide

## Quick Reference While Testing

### Phase 1: Create Account
- [ ] Register: test@example.com / password123
- [ ] See logged-in greeting
- [ ] Header shows cart badge "0"

### Phase 2: Add Products to Cart
- [ ] Go to All Products
- [ ] Click product detail
- [ ] Add to cart (qty varies)
- [ ] Header badge increments (0 → 1 → 2...)
- [ ] Add 2-3 products total

### Phase 3: View Cart
- [ ] Click cart icon → /cart page
- [ ] See all items with emoji/image, name, price
- [ ] Quantity selector (1-10)
- [ ] "Remove from cart" links work
- [ ] Right sidebar: subtotal, 13% HST, total
- [ ] Try updating qty → network tab shows PATCH
- [ ] Try removing item → network tab shows DELETE

### Phase 4: Checkout Page - Summary Stage
- [ ] Click "Proceed to Checkout"
- [ ] At /checkout page
- [ ] See order review with all items
- [ ] Totals: subtotal, HST (13%), total
- [ ] "Place Order & Pay" button ready

### Phase 5: Place Order (The Async Magic)
- [ ] Click "Place Order & Pay"
- [ ] Page shows spinner: "Creating your order..."
- [ ] **Watch Network tab:**
  - `POST /api/orders` → orderId returned ✓
  - Multiple `GET /api/payments/:orderId` (5-10 requests)
  - Eventually: `stripeClientSecret` in response
- [ ] Spinner disappears (2-3 seconds)
- [ ] Stripe payment form appears
- [ ] **Cart badge resets to 0** ✓

### Phase 6: Payment - Stripe Form
- [ ] PaymentElement visible
- [ ] Enter test card: `4242 4242 4242 4242`
- [ ] Expiry: any future (e.g., 12/26)
- [ ] CVC: 123
- [ ] Name: anything
- [ ] Click "Pay" button

### Phase 7: Payment Success
- [ ] Processing for 1-2 seconds
- [ ] **Browser redirects to /orders** ✓
- [ ] Order appears in list
- [ ] Status: "PENDING" (yellow badge)
- [ ] Shows correct total and item count

### Phase 8: Order Details
- [ ] Click order card to expand
- [ ] See items with emoji, name, qty, price
- [ ] Collapse/expand works
- [ ] Empty order history works (before first order)

---

## Error Testing (Optional)

**Declined Card Test:**
1. Add product to cart → checkout
2. Enter card: `4000 0000 0000 9995`
3. Click Pay → error shows inline ✓
4. Change to `4242...` and retry → succeeds ✓

---

## Network Tab Checks

Watch "Network" tab in DevTools for:

| Request | Expected |
|---------|----------|
| `POST /api/cart/items` | 200, returns updated cart |
| `PATCH /api/cart/items/:id` | 200, updated qty |
| `DELETE /api/cart/items/:id` | 200, item removed |
| `POST /api/orders` | 201, order created |
| `GET /api/payments/:orderId` | 200, eventually includes `stripeClientSecret` |
| Browser redirect | To `/orders` after Stripe confirms |

---

## Key Things That Prove It Works

✅ Cart badge auto-updates without page reload
✅ Quantities update with PATCH (not full page refresh)
✅ Polling waits for stripeClientSecret (NOT immediately available)
✅ Stripe form only renders after secret arrives
✅ Cart clears after order placed (badge → 0)
✅ Payment redirects to /orders (Stripe confirms)
✅ Order appears as PENDING
✅ Expanding order shows correct items

---

## If Something Breaks

| Symptom | Check |
|---------|-------|
| Can't add to cart | Is user logged in? Check AuthContext |
| Cart page blank | Is CartProvider in layout.tsx? |
| Checkout form missing | Is STRIPE_PUBLISHABLE_KEY in .env.local? |
| Stripe not appearing | Wait for polling to complete (5 sec max) |
| Order page 404 | Is `/orders/page.tsx` created? ✓ |
| Badge doesn't update | Is useCartContext() in Header.tsx? ✓ |
