import { test, expect } from '@playwright/test'

test.describe('Layer 1+A: Progressive Discovery', () => {
  test('app loads with all panels visible', async ({ page }) => {
    await page.goto('/?mock=true')
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await expect(page.getByTestId('trace-panel')).toBeVisible()
    await expect(page.getByTestId('file-panel')).toBeVisible()
  })

  test('model status shows mock mode', async ({ page }) => {
    await page.goto('/?mock=true')
    await expect(page.getByTestId('model-status')).toContainText('Mock mode')
  })
})
