# LvivCultureNav

Інформаційно-навігаційна система культурних подій Львова для сенсорних терміналів на вокзалі та в центрі міста.
Лабораторна робота № 2 з дисципліни «Методології розробки ПЗ»: командна розробка за стратегією
**екстремального програмування (XP)**. Процес, ролі, історії користувачів і картки Trello описано в
[docs/xp/plan.md](docs/xp/plan.md).

## Вимоги та їх реалізація

| Вимога (ЛР1)                  | Що зроблено                                                               | Де в коді                                           |
| ----------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| REQ-1.1 CRUD подій            | REST `/api/admin/events` + сторінка `/admin` з ключем адміністратора      | `server/src/api/admin.ts`, `client/src/admin/`      |
| REQ-1.2 API для партнерів     | `POST /api/partners/import`: пакетний імпорт, оновлення за `externalId`   | `server/src/api/partners.ts`                        |
| REQ-1.3 Локалізований контент | переклади uk / en / pl в окремій таблиці, запасна мова pl→en→uk           | `server/src/domain/localize.ts`, `server/src/repo/` |
| REQ-2.1 Інтерактивна мапа     | Leaflet + OpenStreetMap, нумеровані маркери подій, «Ви тут»               | `client/src/terminal/EventMap.tsx`                  |
| REQ-2.2 Миттєва зміна мови    | перемикач UK / EN / PL без перезавантаження сторінки                      | `client/src/i18n.ts`, `TerminalPage.tsx`            |
| REQ-2.3 Маршрут від терміналу | пішохідний маршрут OSRM; без мережі — пряма лінія з орієнтовною відстанню | `server/src/services/routing.ts`, `RoutePanel.tsx`  |
| REQ-2.4 Деталі події          | картка з датою, місцем, описом при натисканні на маркер або картку        | `client/src/terminal/EventDetails.tsx`              |

## Запуск

Потрібен **Node.js ≥ 20.19** (перевірено на 24).

```bash
npm install
cp .env.example .env        # за потреби змініть ADMIN_KEY і PARTNER_KEYS
npm run dev                 # сервер :3000 + клієнт :5173 з гарячим перезавантаженням
```

- Термінал на вокзалі: <http://localhost:5173/?terminal=station>
- Термінал у центрі: <http://localhost:5173/?terminal=center>
- Адмін-сторінка: <http://localhost:5173/admin> (ключ — значення `ADMIN_KEY` з `.env`, без `.env` — `admin`)

Режим «як на терміналі» (один процес, зібраний клієнт): `npm start` → <http://localhost:3000>.

База SQLite створюється автоматично (`server/data/lviv.db`) і при першому запуску заповнюється шістьма
демонстраційними подіями. Скинути базу до демо-даних: `npm run seed`.

## Тестування

| Рівень «Пентагону»      | Команда                        | Що перевіряє                                                                                                                    |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| L1 — Unit               | `npm run test:unit`            | ізольована бізнес-логіка та клієнтські компоненти                                                                               |
| L2 — Local integration  | `npm run test:integration`     | API, репозиторій і SQLite у пам'яті; компоненти працюють разом локально                                                         |
| L3 — Global integration | `npm run test:l3`              | HTTP API запущеного production-подібного застосунку, файлова SQLite та інтеграція сервісу маршрутів із локальною заглушкою OSRM |
| L4 — Fault tolerance    | `npm run test:fault-tolerance` | обробка HTTP 503, мережевої помилки й відсутнього маршруту; перевірка запасного маршруту на рівні сервісу та API                |
| L5 — End-to-end         | `npm run test:l5`              | Chromium, зібраний клієнт і сервер; повні сценарії туриста та адміністратора                                                    |
| Усе разом               | `npm run test:all`             | L1, L2 та повний Playwright набір (L3 + L5)                                                                                     |

Перед першим запуском E2E: `npx playwright install chromium` (у теці `e2e`).
HTML-звіт Playwright: `e2e/playwright-report/index.html`.

### Розподіл тестів у CI

Конфігурація [`.github/workflows/ci.yml`](.github/workflows/ci.yml) запускає перевірки кумулятивно за гілкою:

| Середовище | Гілка      | Рівні              |
| ---------- | ---------- | ------------------ |
| DEV        | `dev`      | L1, L2, L3         |
| TEST       | `test`     | L1, L2, L3, L4     |
| PRE-PROD   | `pre-prod` | L1, L2, L3, L4, L5 |
| PROD       | `prod`     | L1, L2             |

Гілки `main` і `master` збережені як сумісні гілки за замовчуванням і запускають рівні до L5. Pull request використовує гілку призначення як середовище. L3 запускається проти реально запущеного HTTP-сервера з окремою файловою SQLite; зовнішній OSRM у CI замінено локальною заглушкою для стабільності тестів.

L6 (Chaos) і автоматичний production-деплой/моніторинг не налаштовані: застосунок є монолітом без оркестратора або визначеної хмарної інфраструктури для безпечного впровадження хаос-тестів і релізу. Їх не можна достовірно відтворити наявними компонентами; для повної відповідності статті потрібні окреме PRE-PROD середовище та налаштована інфраструктура. Розподіл шарів базується на методі з [публікації EEJET](https://journals.uran.ua/eejet/article/view/360693).

### Покриття коду

`npm run test:coverage` запускає модульні та інтеграційні тести з вимірюванням покриття (V8) і друкує
таблицю по файлах; HTML-звіт — `coverage/index.html`. Серверне ядро (`domain`, `repo`, `services`, `api`)
має мінімальні пороги: рядки 90 %, гілки 75 %, функції 85 % — якщо покриття впаде нижче, команда і CI
завершаться з помилкою. Мапа Leaflet у jsdom не малюється, тому в модульних тестах `EventMap` і
`admin/EventForm` бібліотеку `react-leaflet` підмінено заглушкою (`client/test/leafletMock.tsx`), а справжню
мапу перевіряють E2E-тести в браузері. Непокритими лишаються лише захисні гілки: обробник 500, файлова БД
(тести працюють з БД у пам'яті), очікування між запитами до OSRM.

Стандарт коду: `npm run lint`, `npm run typecheck`, `npm run format`. Те саме виконує CI
(`.github/workflows/ci.yml`) на кожен push.

## Зовнішні сервіси: безкоштовні, без ключів

| Сервіс                                                      | Для чого                      | Вартість і доступ                              | Умови використання                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ----------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenStreetMap tiles** `tile.openstreetmap.org`            | підкладка мапи                | безкоштовно, реєстрація і ключ **не потрібні** | видимий підпис «© OpenStreetMap contributors» (є на мапі); браузер має надсилати Referer (робить автоматично); заборонено масове завантаження та офлайн-кешування. [Політика](https://operations.osmfoundation.org/policies/tiles/) |
| **OSRM від FOSSGIS** `routing.openstreetmap.de/routed-foot` | пішохідні маршрути            | безкоштовно, реєстрація і ключ **не потрібні** | не більше 1 запиту на секунду, змістовний User-Agent, підпис OSM. [Опис сервісу](https://routing.openstreetmap.de/about.html)                                                                                                       |
| **Google Fonts**                                            | шрифти Unbounded і Golos Text | безкоштовно, без ключа                         | ліцензія SIL Open Font License                                                                                                                                                                                                      |

Як застосунок дотримується умов:

- Сервер звертається до OSRM сам (клієнт не ходить туди напряму), надсилає User-Agent `OSRM_USER_AGENT`,
  кешує готові маршрути і робить не більше одного запиту на секунду (`minIntervalMs: 1000`).
- Якщо OSRM не відповів за 5 с, повернув помилку або не знайшов маршрут, термінал показує пряму лінію з
  відстанню за формулою гаверсинуса й позначкою «орієнтовно». Термінал не «падає» без мережі.
- Тести не звертаються до цих сервісів: OSRM підмінено, тайли OSM в E2E заблоковано.

Якщо публічні сервіси стануть недоступні або проєкт вийде за межі навчального навантаження, OSRM можна
розгорнути самостійно (також безкоштовно) і вказати адресу в `OSRM_URL`:

```bash
# дані України з Geofabrik, профіль foot
wget https://download.geofabrik.de/europe/ukraine-latest.osm.pbf
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-extract -p /opt/foot.lua /data/ukraine-latest.osm.pbf
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-partition /data/ukraine-latest.osrm
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-customize /data/ukraine-latest.osrm
docker run -p 5000:5000 -v "$PWD:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/ukraine-latest.osrm
# .env: OSRM_URL=http://localhost:5000
```

> Тайли CARTO, які часто беруть для Leaflet, тепер вимагають API-ключ (безкоштовний, але з реєстрацією через
> email), тому в проєкті використано стандартні тайли OpenStreetMap, яким ключ не потрібен.

## REST API

| Метод і шлях                                       | Доступ          | Опис                                                                                                |
| -------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| `GET /api/events?lang=uk\|en\|pl`                  | публічний       | події однією мовою, відсортовані за датою; поле `lang` — фактична мова                              |
| `GET /api/events/:id?lang=`                        | публічний       | одна подія                                                                                          |
| `GET /api/route?terminal=station\|center&eventId=` | публічний       | маршрут `{ mode: online\|fallback, distanceMeters, durationMinutes, geometry }`                     |
| `GET /api/admin/events`                            | `X-Admin-Key`   | події з усіма перекладами                                                                           |
| `POST /api/admin/events`                           | `X-Admin-Key`   | створити (201) або 400 з `details`                                                                  |
| `PUT /api/admin/events/:id`                        | `X-Admin-Key`   | оновити (200 / 400 / 404)                                                                           |
| `DELETE /api/admin/events/:id`                     | `X-Admin-Key`   | видалити (204 / 404)                                                                                |
| `POST /api/partners/import`                        | `X-Partner-Key` | `{ events: [{ externalId, startsAt, lat, lng, translations }] }` → `{ created, updated, rejected }` |

Приклад імпорту від партнера (ключі задаються в `PARTNER_KEYS=partnerId:key,...`):

```bash
curl -X POST http://localhost:3000/api/partners/import \
  -H "Content-Type: application/json" -H "X-Partner-Key: opera-secret" \
  -d '{"events":[{"externalId":"traviata-2026-11-07","startsAt":"2026-11-07T18:00","lat":49.8441,"lng":24.0262,
       "translations":{"uk":{"title":"Травіата","venue":"Львівська опера","category":"Опера","description":""}}}]}'
```

## Структура

```
shared/   спільні типи й константи (мови, термінали, межі Львова)
server/   Express + SQLite: domain/ (чиста логіка), repo/, services/routing, api/
client/   React + Vite + Leaflet: terminal/ (кіоск), admin/ (/admin), i18n
e2e/      Playwright: сценарії, заглушка OSRM
docs/     план XP (docs/xp/plan.md), макет інтерфейсу (docs/mockup.html)
```

## Домовленості щодо комітів (XP)

- Цикл TDD: коміт `test(...)` з червоним тестом іде перед комітом `feat(...)`, що робить його зеленим,
  далі за потреби `refactor(...)`.
- Кінець ітерації — малий реліз із тегом: `v0.1` «Афіша», `v0.2` «Маршрут і редакція».
- Перед push: `npm run lint && npm run typecheck && npm run test:all` (те саме перевіряє CI).
