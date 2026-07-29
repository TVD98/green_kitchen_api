## 1. Prisma schema & migration

- [x] 1.1 Add `UserPreferences`, `UserAllergy`, `DiscoveryQuery` models and `User` relations to `prisma/schema.prisma`
- [x] 1.2 Run migration and verify generated client compiles

## 2. Gemini extensions

- [x] 2.1 Add `DISCOVERY_PROMPT_SCHEMA` and `parseDiscoveryPrompt()` in `gemini.schema.ts` / `gemini.service.ts`
- [x] 2.2 Extend `generateRecipes()` to accept optional `DiscoveryContext` (preferences, allergies, cravings)
- [x] 2.3 Unit-test parse + generate prompt assembly (mock model)

## 3. User preferences module

- [x] 3.1 Create DTOs with validation (`dietary_style`, `spice_level`, arrays)
- [x] 3.2 Implement `UsersPreferencesService` (get defaults, upsert)
- [x] 3.3 Add `GET` / `PUT /users/me/preferences` on `UsersController` with JWT guard

## 4. User allergies module

- [x] 4.1 Implement `UsersAllergiesService` (get with join, replace set in transaction)
- [x] 4.2 Validate ingredient IDs exist before write
- [x] 4.3 Add `GET` / `PUT /users/me/allergies` on `UsersController`

## 5. Discovery search module

- [x] 5.1 Create `DiscoveryModule`, `DiscoveryController`, `DiscoveryService`
- [x] 5.2 Create `DiscoverySearchDto` (prompt max 500, options, filters)
- [x] 5.3 Implement pipeline: parse → load profile → hash → cache lookup → generate → persist → cache write
- [x] 5.4 Reuse `PantryQuery` race-handling pattern for `DiscoveryQuery` P2002
- [x] 5.5 Register module in `AppModule`

## 6. Testing

- [x] 6.1 E2e: discovery search happy path (mock Gemini)
- [x] 6.2 E2e: cache hit — second identical request skips `generateRecipes`
- [x] 6.3 E2e: 401 without JWT on discovery + users/me routes
- [x] 6.4 E2e: preferences PUT/GET roundtrip
- [x] 6.5 E2e: allergies PUT with invalid ingredient id → 400
- [x] 6.6 E2e: discovery with `exclude_allergies: true` passes allergen names to Gemini (spy/mock assert)

## 7. Verification

- [x] 7.1 `npm run build` passes
- [x] 7.2 `npm run test:e2e` passes
- [x] 7.3 Manual smoke via `test.http` entries for new endpoints
