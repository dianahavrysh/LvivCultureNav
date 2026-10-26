import { describe, expect, it, vi } from 'vitest';
import { TERMINALS } from '@lcn/shared';
import { createOsrmRouting } from '../../src/services/routing.ts';

const opera = { lat: 49.8441, lng: 24.0262 };

const osrmOk = {
  code: 'Ok',
  routes: [
    {
      distance: 2624.3,
      duration: 2101.9,
      geometry: {
        coordinates: [
          [23.9945, 49.8396],
          [24.0262, 49.8441],
        ],
      },
    },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function setup(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, timeoutMs = 1000) {
  const fetch = vi.fn(fetchImpl);
  const routing = createOsrmRouting({
    baseUrl: 'https://osrm.test/routed-foot',
    userAgent: 'LCN-test',
    fetch,
    timeoutMs,
  });
  return { fetch, routing };
}

describe('сервіс маршрутів OSRM (US-05, US-06, REQ-2.3)', () => {
  it('будує пішохідний маршрут вулицями і кешує його', async () => {
    const { fetch, routing } = setup(async () => json(osrmOk));

    const r = await routing.route(TERMINALS.station, opera);
    await routing.route(TERMINALS.station, opera);

    expect(r).toEqual({
      mode: 'online',
      distanceMeters: 2624,
      durationMinutes: 36,
      geometry: [
        [49.8396, 23.9945],
        [49.8441, 24.0262],
      ],
    });
    expect(fetch).toHaveBeenCalledTimes(1); // другий запит — з кешу
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://osrm.test/routed-foot/route/v1/foot/23.9945,49.8396;24.0262,49.8441?overview=full&geometries=geojson',
    );
    expect(new Headers(init?.headers).get('User-Agent')).toBe('LCN-test');
  });

  it('@L4 при будь-якому збої OSRM повертає пряму лінію і не кешує її', async () => {
    const failures = [
      () => Promise.resolve(json({}, 503)), // помилка HTTP
      () => Promise.reject(new TypeError('fetch failed')), // немає мережі
      () => Promise.resolve(json({ code: 'NoRoute', routes: [] })), // маршрут не знайдено
    ];
    let call = 0;
    const { fetch, routing } = setup(() =>
      failures[call] ? failures[call++]() : Promise.resolve(json(osrmOk)),
    );

    for (let i = 0; i < failures.length; i++) {
      const r = await routing.route(TERMINALS.station, opera);
      expect(r.mode).toBe('online');
      expect(r.geometry).toEqual([
        [TERMINALS.station.lat, TERMINALS.station.lng],
        [opera.lat, opera.lng],
      ]);
      expect(r.distanceMeters).toBeGreaterThan(2300);
      expect(r.durationMinutes).toBe(Math.ceil(r.distanceMeters / 80));
    }
    // мережа відновилась — знову йдемо в OSRM
    expect((await routing.route(TERMINALS.station, opera)).mode).toBe('online');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('не чекає OSRM довше за тайм-аут', async () => {
    const { routing } = setup(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
      30,
    );
    const started = Date.now();
    expect((await routing.route(TERMINALS.station, opera)).mode).toBe('fallback');
    expect(Date.now() - started).toBeLessThan(500);
  });
});
