// ─── E2E Test: Full Checkout Flow ────────────────────────
// Tests the critical user journey:
// Register → Browse products → Add to cart → Checkout → Order confirmation
//
// Prerequisites:
// - All backend services running via docker compose
// - Frontend dev server (started automatically by Playwright)
// - Seeded product data in the database

import { test, expect } from '@playwright/test';

// Generate a unique email per test run to avoid duplicate registration errors
const timestamp = Date.now();
const TEST_USER = {
  name: 'Test User',
  email: `testuser+${timestamp}@test.com`,
  password: 'password123',
};

// ─────────────────────────────────────────────────────────
// 1. Register a new account
// ─────────────────────────────────────────────────────────
test('register a new account', async ({ page }) => {
  // Navigate to the register page
  await page.goto('/auth/register');

  // Verify we're on the register page
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

  // Fill in the registration form
  // Labels aren't linked to inputs with htmlFor/id, so we locate by
  // finding the label text then targeting the input that follows it
  await page.locator('label:has-text("Your name") + input').fill(TEST_USER.name);
  await page.locator('label:has-text("Email") + input').first().fill(TEST_USER.email);
  await page.locator('label:has-text("Password") + input').first().fill(TEST_USER.password);
  await page.locator('label:has-text("Re-enter password") + input').fill(TEST_USER.password);

  // Submit the form
  await page.getByRole('button', { name: 'Create account' }).click();

  // Should redirect to the home page after successful registration
  await expect(page).toHaveURL('/', { timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────
// 2. Browse products
// ─────────────────────────────────────────────────────────
test('browse products page', async ({ page }) => {
  // Navigate to products page
  await page.goto('/products');

  // Wait for products to load (the Suspense fallback disappears)
  await expect(page.getByText('Loading products...')).toBeHidden({ timeout: 15_000 });

  // Verify at least one product is visible
  // Products are displayed as cards with links — look for product names or prices
  const productCards = page.locator('[class*="Card"], a[href^="/products/"]');
  await expect(productCards.first()).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────
// 3. View a product and add to cart
// ─────────────────────────────────────────────────────────
test('view product detail and add to cart', async ({ page }) => {
  // First log in (state doesn't persist between tests by default)
  await page.goto('/auth/login');
  await page.locator('label:has-text("Email") + input').fill(TEST_USER.email);
  await page.locator('label:has-text("Password") + input').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  // Navigate to products
  await page.goto('/products');
  await expect(page.getByText('Loading products...')).toBeHidden({ timeout: 15_000 });

  // Click the first product to view its detail page
  const firstProduct = page.locator('a[href^="/products/"]').first();
  await firstProduct.click();

  // Verify we're on a product detail page
  await expect(page.getByText('About this item')).toBeVisible({ timeout: 10_000 });

  // Click "Add to Cart" button
  const addToCartButton = page.getByRole('button', { name: /add to cart/i });
  await expect(addToCartButton).toBeVisible();
  await addToCartButton.click();

  // Verify cart feedback (button text change, notification, or redirect to cart)
  // Wait for some confirmation that the item was added
  await expect(
    page.getByText(/added to cart|go to cart|view cart/i).or(
      page.getByRole('button', { name: /go to cart|in cart/i })
    )
  ).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────
// 4. View cart
// ─────────────────────────────────────────────────────────
test('view cart with items', async ({ page }) => {
  // Log in
  await page.goto('/auth/login');
  await page.locator('label:has-text("Email") + input').fill(TEST_USER.email);
  await page.locator('label:has-text("Password") + input').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  // Go to cart page
  await page.goto('/cart');

  // Verify cart has items (not the empty state)
  await expect(page.getByText('Shopping Cart')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Your cart is empty')).toBeHidden();

  // Verify order summary is visible with checkout button
  await expect(page.getByText('Order Summary')).toBeVisible();
  await expect(page.getByRole('link', { name: /proceed to checkout/i })).toBeVisible();
});

// ─────────────────────────────────────────────────────────
// 5. Proceed to checkout
// ─────────────────────────────────────────────────────────
test('proceed to checkout page', async ({ page }) => {
  // Log in
  await page.goto('/auth/login');
  await page.locator('label:has-text("Email") + input').fill(TEST_USER.email);
  await page.locator('label:has-text("Password") + input').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  // Go to cart and click checkout
  await page.goto('/cart');
  await expect(page.getByText('Order Summary')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('link', { name: /proceed to checkout/i }).click();

  // Verify we're on the checkout page
  await expect(page).toHaveURL('/checkout', { timeout: 10_000 });
});
