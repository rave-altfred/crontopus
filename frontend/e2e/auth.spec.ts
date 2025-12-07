import { test, expect } from '@playwright/test';

const generateRandomUser = () => {
  const id = Math.floor(Math.random() * 10000);
  return {
    username: `e2e_user_${id}`,
    email: `e2e_user_${id}@example.com`,
    password: 'Password123!',
  };
};

test.describe('Authentication Flow', () => {
  const user = generateRandomUser();

  test('should register a new user', async ({ page }) => {
    await page.goto('/register');
    
    // Fill registration form
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="confirmPassword"]', user.password);
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard (or login depending on flow)
    // Current flow: Auto-login after register -> Dashboard
    await expect(page).toHaveURL('/');
    
    // Verify logged in state (e.g., check for user menu or dashboard element)
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('should login with existing user', async ({ page }) => {
    // Logout if already logged in (or use a fresh context, but for simplicity in sequential runs)
    // Best practice: Independent tests. We'll register a new user for login test or use the one from previous test?
    // Playwright tests are isolated by default (new context per test).
    // So we need to register first, or seed the database.
    // For E2E without DB seeding access, we register a user for this test case specifically.
    
    const loginUser = generateRandomUser();
    
    // 1. Register first
    await page.goto('/register');
    await page.fill('input[name="username"]', loginUser.username);
    await page.fill('input[name="email"]', loginUser.email);
    await page.fill('input[name="password"]', loginUser.password);
    await page.fill('input[name="confirmPassword"]', loginUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    
    // 2. Logout
    // Assuming there is a user menu or logout button. 
    // Let's find the logout button. Usually in sidebar or header.
    await page.click('button:has-text("Logout")'); // Adjust selector based on actual UI
    await expect(page).toHaveURL('/login');

    // 3. Login
    await page.fill('input[name="username"]', loginUser.username);
    await page.fill('input[name="password"]', loginUser.password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard'); // Protected route
    await expect(page).toHaveURL('/login');
  });
});
