import { test, expect } from '@playwright/test'

test.describe('Scaffold', () => {
  test('app loads with 3 panels', async ({ page }) => {
    await page.goto('/?mock=true')

    await expect(page.getByRole('heading', { name: 'Boston Agent' })).toBeVisible()
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await expect(page.getByTestId('trace-panel')).toBeVisible()
    await expect(page.getByTestId('file-panel')).toBeVisible()
  })

  test('model status badge renders in mock mode', async ({ page }) => {
    await page.goto('/?mock=true')

    const status = page.getByTestId('model-status')
    await expect(status).toBeVisible()
    await expect(status).toContainText('Mock mode')
  })
})
