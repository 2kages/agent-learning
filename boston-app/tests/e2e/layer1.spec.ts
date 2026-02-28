import { test, expect } from '@playwright/test'

test.describe('Layer 1: Tools & Execution', () => {
  test('file panel shows "No files yet" initially', async ({ page }) => {
    await page.goto('/?mock=true')
    await expect(page.getByTestId('file-panel')).toContainText('No files')
  })

  test('chat input and send button are visible', async ({ page }) => {
    await page.goto('/?mock=true')
    await expect(page.getByTestId('chat-input')).toBeVisible()
    await expect(page.getByTestId('send-button')).toBeVisible()
  })

  test('sending a message shows user bubble and assistant response', async ({ page }) => {
    await page.goto('/?mock=true')

    await page.getByTestId('chat-input').fill('List files')
    await page.getByTestId('send-button').click()

    await expect(page.getByTestId('message-user')).toContainText('List files')
    await expect(page.getByTestId('message-assistant')).toBeVisible({ timeout: 5000 })
  })
})
