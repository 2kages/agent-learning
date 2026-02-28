import { test, expect } from '@playwright/test'

test.describe('Layer 4: Sub-agents', () => {
  test('app loads with all layers active', async ({ page }) => {
    await page.goto('/?mock=true')
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await expect(page.getByTestId('trace-panel')).toBeVisible()
    await expect(page.getByTestId('file-panel')).toBeVisible()
    await expect(page.getByTestId('model-status')).toContainText('Mock mode')
  })

  test('sending a message works end-to-end', async ({ page }) => {
    await page.goto('/?mock=true')

    await page.getByTestId('chat-input').fill('Create two files simultaneously')
    await page.getByTestId('send-button').click()

    await expect(page.getByTestId('message-user')).toContainText('Create two files')
    await expect(page.getByTestId('message-assistant')).toBeVisible({ timeout: 5000 })
  })
})
