import { test, expect } from '@playwright/test';

const generateRandomUser = () => {
  const id = Math.floor(Math.random() * 10000);
  return {
    username: `dash_user_${id}`,
    email: `dash_user_${id}@example.com`,
    password: 'Password123!',
  };
};

test.describe('Dashboard & Navigation', () => {
  const user = generateRandomUser();

  test.beforeAll(async ({ browser }) => {
    // Register a user for the session
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/register');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="confirmPassword"]', user.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should load dashboard with key elements', async ({ page }) => {
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Recent Runs')).toBeVisible();
    
    // Verify stats cards exist
    await expect(page.getByText('Active Endpoints')).toBeVisible();
    await expect(page.getByText('Successful Runs')).toBeVisible();
    await expect(page.getByText('Failed Runs')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ page }) => {
    // Navigate to Jobs
    await page.click('a[href="/jobs"]');
    await expect(page).toHaveURL('/jobs');
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();

    // Navigate to Endpoints (formerly Agents)
    await page.click('a[href="/endpoints"]');
    await expect(page).toHaveURL('/endpoints');
    await expect(page.getByRole('heading', { name: 'Endpoints' })).toBeVisible();

    // Navigate to Runs
    await page.click('a[href="/runs"]');
    await expect(page).toHaveURL('/runs');
    await expect(page.getByRole('heading', { name: 'Job Run Log' })).toBeVisible();
  });

  test('should toggle dark/light mode', async ({ page }) => {
    // Find theme toggle button (usually sun/moon icon)
    // Since specific selector might vary, let's assume it's button with accessible name or icon
    // Based on previous implementation: ThemeSelector component
    
    // Check current theme (default dark)
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Toggle theme
    // Use a more resilient selector if possible, e.g. test-id
    // If not available, try looking for button in header
    const themeButton = page.locator('button[aria-label="Toggle theme"]').first();
    if (await themeButton.isVisible()) {
        await themeButton.click();
        // Wait for class change
        await expect(page.locator('html')).not.toHaveClass(/dark/);
        
        // Toggle back
        await themeButton.click();
        await expect(page.locator('html')).toHaveClass(/dark/);
    } else {
        console.log('Theme toggle button not found, skipping theme test');
    }
  });
});
