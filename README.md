# Green Kitchen API

NestJS + TypeScript + PostgreSQL (Prisma) backend for the Green Kitchen Flutter app.

Base URL prefix: `/api/v1`  
Response envelope: `{ "success": true|false, "code": "...", "data"|"message": ... }` (snake_case fields).

## Quick start (Docker)

```bash
cp .env.example .env   # set JWT secrets + optional GEMINI_API_KEY
docker compose up --build -d
curl http://localhost:3000/api/v1/health
```

Compose starts Postgres + API. On boot the API runs `prisma migrate deploy`, seeds ingredients, then serves on port `3000`.

## Local development

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

API: `http://localhost:3000/api/v1`

## Environment

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | HTTP port (default `3000`) |
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing secrets |
| `ACCESS_TTL` / `REFRESH_TTL` | Token TTLs (seconds) |
| `OTP_TTL_SECONDS` / `OTP_RESEND_SECONDS` | Password-reset OTP timing |
| `MAX_LOGIN_ATTEMPTS` | Lockout threshold |
| `GEMINI_API_KEY` | Google Gemini key for pantry recipe generation |

Never commit `.env`. Copy from `.env.example`.

## Auth endpoints (`/api/v1/auth`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/signup` | `SIGNUP_SUCCESS` → `{ user, tokens }` |
| POST | `/login` | `LOGIN_SUCCESS`; throttled; lockout after N fails |
| POST | `/social-login` | Stub: any non-empty `id_token` except `"fail"` |
| POST | `/forgot-password` | Always `OTP_SENT` (no enumeration); console OTP; `dev_otp` when not production |
| POST | `/verify-otp` | → `{ reset_token }` |
| POST | `/reset-password` | `PASSWORD_RESET_SUCCESS`; revokes all refresh tokens |
| POST | `/refresh-token` | New access token |
| POST | `/logout` | Revoke refresh token |

## Discovery endpoints (JWT required)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/ingredients?q=` | Autocomplete (name/aliases), limit 20 |
| POST | `/pantry/search` | Normalize ingredients → hybrid cache → Gemini on miss |
| GET | `/recipes` | Filters: `q`, `max_time`, `difficulty`, `tags` |
| GET | `/recipes/:id` | Recipe detail |

## Flutter wire-up

In the Flutter repo (`green_kitchen`):

```bash
# Android emulator
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1 \
  --dart-define=USE_FAKE_AUTH=false

# iOS simulator / desktop
flutter run \
  --dart-define=API_BASE_URL=http://localhost:3000/api/v1 \
  --dart-define=USE_FAKE_AUTH=false
```

- `USE_FAKE_AUTH` defaults to `true` (offline fake). Set `false` to hit this API.
- Social login is a stub (no real Google/Facebook verification yet).
- Password-reset OTP is logged to the API console; non-production responses may include `dev_otp`.

## Tests

```bash
npm test
npm run test:e2e
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Watch mode |
| `npm run start:prod` | `node dist/src/main` |
| `npm run build` | Nest build |
| `npx prisma migrate deploy` | Apply migrations |
| `npx prisma db seed` | Seed Vietnamese ingredients |
