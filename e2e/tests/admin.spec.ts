import { ADMIN_KEY } from '../playwright.config.ts';
import { expect, test } from '../support/fixtures.ts';

test.describe('@L5 Адміністратор керує подіями на /admin (REQ-1.1)', () => {
  // Прибирає тестову подію, навіть якщо сценарій упав посередині, щоб не впливати на інші тести
  test.afterEach(async ({ request }) => {
    const headers = { 'X-Admin-Key': ADMIN_KEY };
    const events: { id: number; translations: { uk?: { title: string } } }[] = await (
      await request.get('/api/admin/events', { headers })
    ).json();
    for (const e of events.filter((e) => e.translations.uk?.title === 'Лекція про Пінзеля')) {
      await request.delete(`/api/admin/events/${e.id}`, { headers });
    }
  });

  test('входить за ключем, створює подію, бачить її на терміналі і видаляє', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Ключ адміністратора').fill('wrong-key');
    await page.getByRole('button', { name: 'Увійти' }).click();
    await expect(page.getByRole('alert')).toHaveText('Невірний ключ доступу. Спробуйте ще раз.');

    await page.getByLabel('Ключ адміністратора').fill(ADMIN_KEY);
    await page.getByRole('button', { name: 'Увійти' }).click();
    await expect(page.getByRole('heading', { name: 'Події' })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(6);

    // Валідація: без назви подія не зберігається
    await page.getByRole('button', { name: '+ Нова подія' }).click();
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await expect(page.getByRole('alert')).toContainText('Назва українською обов’язкова');

    // Створення з перекладами
    await page.getByLabel('Назва (UK)').fill('Лекція про Пінзеля');
    await page.getByLabel('Категорія (UK)').fill('Лекція');
    await page.getByLabel('Місце (UK)').fill('Музей Пінзеля');
    await page.getByRole('tab', { name: 'EN' }).click();
    await page.getByLabel('Назва (EN)').fill('Lecture on Pinsel');
    await page.getByLabel('Місце (EN)').fill('Pinsel Museum');
    await page.getByLabel('Дата і час початку').fill('2026-10-25T17:00');
    await page.getByLabel('Широта').fill('49.8418');
    await page.getByLabel('Довгота').fill('24.0369');
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await expect(page.getByRole('status')).toHaveText('Подію створено');
    await expect(page.locator('tbody tr')).toHaveCount(7);

    // Редагування: після створення форма лишається відкритою для цієї події
    await page.getByRole('tab', { name: 'EN' }).click();
    await page.getByLabel('Опис (EN)').fill('Talk about Lviv baroque sculpture.');
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await expect(page.getByRole('status')).toHaveText('Зміни збережено');

    // Подія одразу з'являється на терміналі
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Лекція про Пінзеля/ })).toBeVisible();
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('button', { name: /Lecture on Pinsel/ })).toBeVisible();

    // Видалення (ключ збережено в межах вкладки)
    await page.goto('/admin');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Видалити «Лекція про Пінзеля»' }).click();
    await expect(page.getByRole('status')).toHaveText('Подію видалено');
    await expect(page.locator('tbody tr')).toHaveCount(6);

    await page.goto('/');
    await expect(page.locator('.ev-card')).toHaveCount(6);
    await expect(page.getByRole('button', { name: /Лекція про Пінзеля/ })).toHaveCount(0);
  });
});
