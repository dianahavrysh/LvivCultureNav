import { expect, test } from '../support/fixtures.ts';

test.describe('@L5 Турист біля терміналу на вокзалі', () => {
  test('бачить події на мапі, відкриває деталі, перемикає мову і будує маршрут (REQ-2.1–2.4)', async ({
    page,
  }) => {
    await page.goto('/?terminal=station');

    // REQ-2.1: мапа з маркерами і список подій
    await expect(page.getByRole('heading', { name: 'Події' })).toBeVisible();
    await expect(page.locator('.ev-card')).toHaveCount(6);
    await expect(page.locator('.leaflet-marker-icon[title]')).toHaveCount(6);
    await expect(page.getByText('Ви тут').last()).toBeVisible();

    // REQ-2.4: натискання на маркер відкриває деталі
    await page.locator('.leaflet-marker-icon[title="«Наталка Полтавка»"]').click();
    const details = page.locator('aside.details');
    await expect(details.getByRole('heading', { name: '«Наталка Полтавка»' })).toBeVisible();
    await expect(details.getByText('Львівська національна опера')).toBeVisible();

    // REQ-2.2: миттєве перемикання мови без перезавантаження сторінки
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(details.getByRole('heading', { name: 'Natalka Poltavka' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

    // REQ-2.3: маршрут від терміналу до події
    await page.getByRole('button', { name: 'Show route' }).click();
    const card = page.getByTestId('route-card');
    await expect(card).toContainText('1.5 km · 20 min on foot');
    await expect(card).toContainText('Walking route along streets');
    await expect(page.locator('path.route-online')).toBeVisible();

    await page.getByRole('button', { name: 'Hide route' }).click();
    await expect(card).toBeHidden();

    // REQ-1.3: якщо польського перекладу немає — показано англійський з підказкою
    await page.getByRole('button', { name: 'PL', exact: true }).click();
    await page.getByRole('button', { name: /Night Tour of the Arsenal/ }).click();
    await expect(page.getByText('Brak tłumaczenia w tym języku — pokazano w EN')).toBeVisible();
  });
});
