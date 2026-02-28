import { test, expect } from '@playwright/test'

test.describe('Layer 1+B: Code Mode', () => {
  test('app loads with all panels functional', async ({ page }) => {
    await page.goto('/?mock=true')
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await expect(page.getByTestId('trace-panel')).toBeVisible()
    await expect(page.getByTestId('file-panel')).toBeVisible()
    await expect(page.getByTestId('model-status')).toContainText('Mock mode')
  })
})
