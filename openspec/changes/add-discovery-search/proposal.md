## Why

The Flutter app needs a Yemake-style AI recipe discovery screen: users describe cravings or meal ideas in natural Vietnamese (`prompt`), optionally apply saved eating preferences and allergy exclusions, and receive personalized Gemini-generated recipes. The existing `POST /api/v1/pantry/search` only accepts a structured `ingredients[]` array and has no user preference or allergy model — it cannot power the new Discover UX.

Quick Start preset pills (fridge, cravings, fast & healthy, vegetarian) are composed entirely on the client into `prompt` + optional `filters`; no preset API is required.

## What Changes

- Add **`discovery-search`** module: `POST /api/v1/discovery/search` accepting `{ prompt, options?, filters? }`, parsing natural language via Gemini, merging user context, generating recipes, and caching results.
- Add **`user-preferences`** module: `GET` / `PUT /api/v1/users/me/preferences` for dietary style, spice level, cuisine preferences, disliked ingredients, and health goals.
- Add **`user-allergies`** module: `GET` / `PUT /api/v1/users/me/allergies` for ingredient-based allergy list linked to the existing `Ingredient` table.
- Extend **`GeminiService`** with `parseDiscoveryPrompt()` and context-aware `generateRecipes()` (preferences + allergy exclusions).
- Add Prisma models: `UserPreferences`, `UserAllergy`, `DiscoveryQuery` (cache + optional per-user history).
- Add e2e tests for discovery search happy path, preference merge, allergy exclusion, cache hit, and auth guard.

Non-goals for this change: server-side speech-to-text (voice stays client-side STT → `prompt`); Quick Start preset endpoints; discovery history sync API for the Flutter app (local-only history remains acceptable for MVP); changes to existing `POST /pantry/search` contract; rate-limit middleware beyond existing Gemini error mapping.

## Capabilities

### New Capabilities

- `discovery-search`: Natural-language prompt → parsed intent → personalized Gemini recipe generation with hybrid cache.
- `user-preferences`: CRUD for user eating preferences used when `options.use_preferences` is true.
- `user-allergies`: CRUD for user allergen ingredients used when `options.exclude_allergies` is true.

### Modified Capabilities

- `gemini`: Add prompt parsing and personalization context to recipe generation prompts.
- `users`: Expose authenticated `/users/me/*` sub-routes (preferences, allergies).

## Impact

- **New modules**: `src/modules/discovery/`, `src/modules/users/` (controller expansion), Prisma migrations.
- **Unchanged**: `POST /pantry/search`, `GET /recipes`, `GET /recipes/:id`, `GET /ingredients`, all `/auth/*` routes.
- **Database**: three new tables + `User` relations.
- **Flutter (future)**: will consume new endpoints; out of scope for this API change but specs are the contract of record.
- **Testing**: unit tests for hash/cache/prompt validation; e2e with mocked GeminiService.
