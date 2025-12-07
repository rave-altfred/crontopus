import { test, expect } from '@playwright/test';

const generateRandomUser = () => {
  const id = Math.floor(Math.random() * 10000);
  return {
    username: `agent_user_${id}`,
    email: `agent_user_${id}@example.com`,
    password: 'Password123!',
  };
};

test.describe('Agent Download', () => {
  const user = generateRandomUser();

  test.beforeAll(async ({ browser }) => {
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
    await page.goto('/login');
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should load agent download page and show platforms', async ({ page }) => {
    // Navigate to Agent Download (usually "Download Agent" or similar in sidebar)
    // If it's a main navigation item, use that. If it's a sub-item or button, adjust.
    // Based on README: "Navigate to 'Download Agent' page"
    // Let's check sidebar or URL directly
    await page.goto('/agent/download');
    
    await expect(page.getByRole('heading', { name: /Download Agent/i })).toBeVisible();
    
    // Check for platform selectors
    await expect(page.getByText(/Linux/i)).toBeVisible();
    await expect(page.getByText(/macOS/i)).toBeVisible();
    await expect(page.getByText(/Windows/i)).toBeVisible();
  });

  test('should update download command when platform changes', async ({ page }) => {
    await page.goto('/agent/download');
    
    // Click Linux (if not already selected)
    const linuxButton = page.getByRole('button', { name: /Linux/i });
    if (await linuxButton.isVisible()) {
        await linuxButton.click();
    }
    // Check for shell script
    await expect(page.getByText(/curl .*install.sh/)).toBeVisible();

    // Click Windows
    await page.getByRole('button', { name: /Windows/i }).click();
    
    // Check for PowerShell command
    await expect(page.getByText(/iwr .*install.ps1/)).toBeVisible();
  });
});
