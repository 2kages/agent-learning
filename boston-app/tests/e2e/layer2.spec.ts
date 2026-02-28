import { test, expect } from '@playwright/test'

test.describe('Layer 2: Context Management', () => {
  test('app remains functional with context management', async ({ page }) => {
    await page.goto('/?mock=true')
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await expect(page.getByTestId('trace-panel')).toBeVisible()

    // Send a message — app should handle it normally
    await page.getByTestId('chat-input').fill('Test context management')
    await page.getByTestId('send-button').click()

    await expect(page.getByTestId('message-user')).toContainText('Test context management')
    await expect(page.getByTestId('message-assistant')).toBeVisible({ timeout: 5000 })
  })
})
