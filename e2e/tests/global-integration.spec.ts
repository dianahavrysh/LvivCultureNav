import { expect, test } from '../support/fixtures.ts';

test('@L3 інтегрує HTTP API, SQLite та сервіс маршрутів у запущеному застосунку', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect(await health.json()).toEqual({ status: 'ok' });

  const eventsResponse = await request.get('/api/events?lang=en');
  expect(eventsResponse.ok()).toBe(true);
  const events = (await eventsResponse.json()) as { id: number; title: string; lang: string }[];
  expect(events.length).toBeGreaterThan(0);
  expect(events[0]).toMatchObject({ lang: 'en' });

  const route = await request.get(`/api/route?terminal=station&eventId=${events[0].id}`);
  expect(route.ok()).toBe(true);
  expect(await route.json()).toMatchObject({
    mode: 'online',
    distanceMeters: 1500,
    durationMinutes: 20,
  });
});
