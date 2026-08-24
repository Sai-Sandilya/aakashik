# Aakashik REST API

Node.js **Fastify** backend for the Aakashik Wellness store. Uses **Node.js built-in SQLite** (`node:sqlite`, Node 22.5+) — no PostgreSQL or native modules required for dev.

## Quick start

```bash
cd api
npm install
npm start
```

Server: `http://127.0.0.1:3001`

## Run automated API tests

```bash
cd api
npm test
```

Verbose output:

```bash
npm run test:verbose
```

From repo root:

```bash
npm run api:test
```

## Demo admin credentials

| Field | Value |
|-------|-------|
| Email | `owner@aakashik.local` |
| Password | `Admin@1234` |

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | API port |
| `HOST` | `127.0.0.1` | Bind address |
| `JWT_SECRET` | dev secret | Admin JWT signing |
| `ADMIN_EMAIL` | `owner@aakashik.local` | Seed admin |
| `ADMIN_PASSWORD` | `Admin@1234` | Seed admin password |
| `DB_PATH` | `data/aakashik.db` | SQLite file (non-test) |

## API endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/products` | Store catalog (active, visible) |
| GET | `/api/products/:id` | Single product |
| POST | `/api/orders` | Checkout / create order |
| GET | `/api/orders/:id/track` | Track order timeline |

### Admin (Bearer token)

Login: `POST /api/admin/login` → `{ "token": "..." }`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/me` | Current admin |
| GET | `/api/admin/products` | All products |
| POST | `/api/admin/products` | Create custom product |
| PATCH | `/api/admin/products/:id` | Edit custom product |
| DELETE | `/api/admin/products/:id` | Delete custom product |
| PATCH | `/api/admin/products/:id/visibility` | Hide/show built-in |
| GET | `/api/admin/inventory` | Stock list |
| PATCH | `/api/admin/inventory/:productId` | Set stock |
| POST | `/api/admin/inventory/:productId/adjust` | +/- stock |
| POST | `/api/admin/inventory/reseed` | Reset default stock |
| GET | `/api/admin/orders` | List orders |
| GET | `/api/admin/orders/:id` | Order detail |
| PATCH | `/api/admin/orders/:id/status` | Update status |

## Manual testing

See `tests/API_TEST_CASES.md` for curl/Postman examples.

## Notes

- SQLite is for **MVP/dev**. Production can swap to PostgreSQL on Hostinger VPS, Supabase, or Neon with the same schema.
- Frontend HTML still uses localStorage until wired to this API in a later step.
