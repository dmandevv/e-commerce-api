# JWT Secret Rotation

How to rotate `JWT_SECRET` across all services.

## Why rotate
- **Scheduled** — every 90 days as part of routine hygiene.
- **Immediate** — suspected leak, compromised developer machine, ex-employee had
  production access, or secret appeared in logs/stack traces.

## What gets affected
All 6 services (user, product, cart, order, payment, notification) sign and
verify access tokens with `JWT_SECRET`. When the secret changes:
- Existing access tokens **immediately fail verification** → every signed-in
  user sees 401.
- The frontend silent-refresh catches this, but `/refresh` also returns 401
  because the refresh-token flow re-issues using the new secret — the OLD
  access token in hand is just dead.
- Effective outcome: **all users are logged out**. They need to re-login.

**During business-hours rotations, expect a wave of logins for a few minutes.**

## Rotation procedure — dev

```bash
# 1. Generate a new strong secret
NEW_SECRET=$(openssl rand -hex 32)
echo "New secret: $NEW_SECRET"

# 2. Update the secret in Doppler (replaces .env editing)
doppler secrets set JWT_SECRET="$NEW_SECRET" --project ecommerce --config dev_personal
doppler secrets set JWT_SECRET="$NEW_SECRET" --project ecommerce --config dev
doppler secrets set JWT_SECRET="$NEW_SECRET" --project ecommerce --config prd

# 3. Restart the stack — Doppler injects the new value automatically
npm run dev-test
```
