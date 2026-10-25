import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { TERMINALS } from '@lcn/shared';
import { createOsrmRouting } from '../../src/services/routing.ts';
import { fakeRouting, makeTestApp, opera, rynok } from './helpers.ts';

describe('Публічне API терміналу: Express + репозиторій + SQLite (REQ-1.3, REQ-2.1–2.4)', () => {
  it('віддає події запитаною мовою з запасним перекладом і зберігає переклади окремо', async () => {
    const { app, repo, db } = makeTestApp();
    const operaId = repo.create(opera()).id;
    repo.create(rynok());

    const list = await request(app).get('/api/events?lang=en').expect(200);
    expect(list.body.map((e: { title: string }) => e.title)).toEqual(['Rynok Fair', 'Natalka Poltavka']); // за датою
    expect(list.body[1]).toMatchObject({ id: operaId, lang: 'en', venue: 'Lviv Opera', lat: 49.8441 });

    const byDefault = await request(app).get('/api/events').expect(200);
    expect(byDefault.body[0]).toMatchObject({ lang: 'uk', title: 'Ярмарок на Ринку' });

    const fallback = await request(app).get(`/api/events/${operaId}?lang=pl`).expect(200);
    expect(fallback.body).toMatchObject({ lang: 'en', title: 'Natalka Poltavka' });

    expect(
      db.prepare('SELECT lang FROM event_translations WHERE event_id = ? ORDER BY lang').all(operaId),
    ).toEqual([{ lang: 'en' }, { lang: 'uk' }]);
  });

  it('@L4 будує маршрут від терміналу до події, а без OSRM — запасну пряму лінію', async () => {
    const spy = vi.spyOn(fakeRouting, 'route');
    const online = makeTestApp(fakeRouting);
    const id = online.repo.create(opera()).id;
    const res = await request(online.app).get(`/api/route?terminal=center&eventId=${id}`).expect(200);
    expect(spy).toHaveBeenCalledWith(TERMINALS.center, { lat: 49.8441, lng: 24.0262 });
    expect(res.body).toMatchObject({ mode: 'online', distanceMeters: 1234, durationMinutes: 16 });
    spy.mockRestore();

    const offline = makeTestApp(
      createOsrmRouting({
        baseUrl: 'https://osrm.invalid',
        userAgent: 'test',
        fetch: () => Promise.reject(new TypeError()),
      }),
    );
    const id2 = offline.repo.create(opera()).id;
    const fb = await request(offline.app).get(`/api/route?terminal=station&eventId=${id2}`).expect(200);
    expect(fb.body.mode).toBe('fallback');
    expect(fb.body.geometry).toEqual([
      [TERMINALS.station.lat, TERMINALS.station.lng],
      [49.8441, 24.0262],
    ]);
  });

  it('відповідає 400/404 на некоректні запити', async () => {
    const { app } = makeTestApp();
    expect((await request(app).get('/api/events?lang=de').expect(400)).body.error).toMatch(/lang/);
    expect((await request(app).get('/api/events/9999').expect(404)).body.error).toBe('Event not found');
    expect((await request(app).get('/api/route?terminal=airport&eventId=1').expect(400)).body.error).toMatch(
      /terminal/,
    );
    await request(app).get('/api/route?terminal=station').expect(400);
    await request(app).get('/api/route?terminal=station&eventId=777').expect(404);
    await request(app).get('/api/unknown').expect(404);
  });
});
