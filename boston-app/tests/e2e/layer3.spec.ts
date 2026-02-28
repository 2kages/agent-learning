import { test, expect } from '@playwright/test'

test.describe('Layer 3: Observational Memory', () => {
  test('app loads with file panel showing no files', async ({ page }) => {
    await page.goto('/?mock=true')
    await expect(page.getByTestId('file-panel')).toContainText('No files')
  })

  test('sending messages works with all layers active', async ({ page }) => {
    await page.goto('/?mock=true')

    await page.getByTestId('chat-input').fill('Remember that I prefer dark mode')
    await page.getByTestId('send-button').click()

    await expect(page.getByTestId('message-user')).toContainText('dark mode')
    await expect(page.getByTestId('message-assistant')).toBeVisible({ timeout: 5000 })
  })
})
