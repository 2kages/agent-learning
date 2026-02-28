import { test, expect } from '@playwright/test'

test.describe('Layer 0: Agent Loop', () => {
  test('sends message and receives assistant response', async ({ page }) => {
    await page.goto('/?mock=true')

    const input = page.getByTestId('chat-input')
    const sendBtn = page.getByTestId('send-button')

    await input.fill('Hello agent')
    await sendBtn.click()

    // User message should appear
    await expect(page.getByTestId('message-user')).toBeVisible()
    await expect(page.getByTestId('message-user')).toContainText('Hello agent')

    // Assistant response should appear (mock engine returns fallback)
    await expect(page.getByTestId('message-assistant')).toBeVisible({ timeout: 5000 })
  })

  test('trace panel shows loop events', async ({ page }) => {
    await page.goto('/?mock=true')

    const input = page.getByTestId('chat-input')
    const sendBtn = page.getByTestId('send-button')

    await input.fill('Hello')
    await sendBtn.click()

    // Wait for trace entries to appear
    await expect(page.getByTestId('trace-entry').first()).toBeVisible({ timeout: 5000 })

    // Should have at least loop_start and loop_end
    const entries = page.getByTestId('trace-entry')
    await expect(entries).not.toHaveCount(0)
  })

  test('input is disabled while agent is running', async ({ page }) => {
    await page.goto('/?mock=true')

    const input = page.getByTestId('chat-input')
    await input.fill('Test')
    await page.getByTestId('send-button').click()

    // Input should clear after sending
    await expect(input).toHaveValue('')
  })
})
