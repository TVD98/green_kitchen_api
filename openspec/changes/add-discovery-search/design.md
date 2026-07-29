## Context

`green_kitchen_api` already implements JWT auth, ingredient autocomplete, structured pantry search (`POST /pantry/search`), and recipe read APIs. Gemini generates 2–4 recipes from a canonical ingredient list with optional `{ max_time, difficulty, tags }` filters and caches by ingredient hash.

The new Discover screen (Flutter) sends a free-text `prompt` (max 500 chars) composed by the user or by Quick Start pills on the client. Two toggles control personalization: `use_preferences` and `exclude_allergies`.

## Goals / Non-Goals

**Goals:**

- Single discovery endpoint that accepts natural-language prompts and returns `RecipeDto[]`.
- Persist and serve user eating preferences and allergies.
- When toggles are on, merge profile data into Gemini context before generation.
- Stable cache to avoid duplicate Gemini calls for identical requests.
- JWT required on all new write/search endpoints.

**Non-goals:**

- Quick Start preset API (FE builds prompt).
- Voice/STT backend.
- Breaking or replacing `POST /pantry/search` (kept for structured ingredient flow).
- Cross-device discovery history sync in MVP (DB may store `DiscoveryQuery` for future use).
- Post-generation allergen validation beyond prompt instructions (optional follow-up).

## Decisions

### 1. New module `discovery` instead of extending `pantry`

`pantry/search` normalizes explicit ingredient names to DB canonical IDs. Discovery first **parses NL prompt → structured intent** (ingredients, cravings, inferred filters). Different validation, cache key, and Gemini prompt — separate `DiscoveryService` and controller.

**Alternative considered:** add optional `prompt` to `PantrySearchDto`. Rejected — mixed responsibilities and confusing cache semantics.

### 2. Two-step Gemini pipeline

```
prompt + filters
    → parseDiscoveryPrompt() → { ingredients[], cravings[], dietary_notes[] }
    → merge user preferences / allergies (if toggles on)
    → generateRecipes(ingredients, filters, context)
    → persistGenerated()
    → cache DiscoveryQuery
```

Parsing uses structured JSON schema (like existing `normalizeIngredients`). Generation reuses `GENERATED_RECIPES_SCHEMA`.

### 3. Cache key composition

SHA-256 over stable JSON:

```json
{
  "prompt_normalized": "...",
  "filters": { "difficulty": "easy", "max_time": 30, "tags": ["vegetarian"] },
  "options": { "use_preferences": true, "exclude_allergies": true },
  "preference_snapshot": { ... } | null,
  "allergy_ids": ["..."] | null
}
```

When `use_preferences` is false, omit preference snapshot from hash. When `exclude_allergies` is false, omit allergy ids.

Store in `DiscoveryQuery` with `promptHash` unique constraint (same race-handling pattern as `PantryQuery` P2002).

### 4. User preferences schema

```prisma
model UserPreferences {
  userId              String   @id
  user                User     @relation(...)
  dietaryStyle        String?  // e.g. vegetarian, vegan, omnivore
  spiceLevel          String?  // mild | medium | hot
  cuisinePreferences  String[] // e.g. vietnamese, asian
  dislikedIngredients String[] // free-text or canonical names
  healthGoals         String[] // e.g. low_carb, high_protein
  updatedAt           DateTime @updatedAt
}
```

Default: empty preferences on first `GET` (upsert-not-required; return defaults).

### 5. User allergies schema

```prisma
model UserAllergy {
  userId       String
  ingredientId String
  user         User       @relation(...)
  ingredient   Ingredient @relation(...)
  createdAt    DateTime   @default(now())

  @@id([userId, ingredientId])
}
```

`PUT /users/me/allergies` replaces the full set atomically (delete + insert in transaction).

### 6. Auth routing

New routes under `@Controller('users')` with `@UseGuards(JwtAuthGuard)`:

- `GET /users/me/preferences`
- `PUT /users/me/preferences`
- `GET /users/me/allergies`
- `POST /discovery/search`

Follow existing `@CurrentUser() user: AuthUserContext` pattern from `pantry.controller.ts`.

### 7. DTO validation

| Field | Rules |
|-------|-------|
| `prompt` | required, string, trim, `@MinLength(1)`, `@MaxLength(500)` |
| `options.use_preferences` | optional boolean, default false |
| `options.exclude_allergies` | optional boolean, default false |
| `filters` | same shape as `PantrySearchFiltersDto` |

### 8. Error mapping

Reuse existing codes:

| Condition | Code | HTTP |
|-----------|------|------|
| Empty/whitespace prompt | `INVALID_INPUT` | 400 |
| Missing JWT | guard | 401 |
| Gemini quota | `TOO_MANY_REQUESTS` | 429 |
| Gemini/parse failure | `INTERNAL` | 500 |

## API Summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/discovery/search` | JWT | NL prompt → recipes |
| GET | `/users/me/preferences` | JWT | Read preferences |
| PUT | `/users/me/preferences` | JWT | Upsert preferences |
| GET | `/users/me/allergies` | JWT | List allergies with ingredient names |
| PUT | `/users/me/allergies` | JWT | Replace allergy set |

## Request / Response Examples

**POST /api/v1/discovery/search**

```json
// Request
{
  "prompt": "Tôi đang thèm: Cay. Tôi có thể nấu gì?",
  "options": {
    "use_preferences": true,
    "exclude_allergies": false
  },
  "filters": {
    "max_time": 30,
    "tags": ["healthy"]
  }
}

// Response 201
{
  "success": true,
  "data": [ /* RecipeDto[] */ ]
}
```

**GET /api/v1/users/me/preferences**

```json
{
  "success": true,
  "data": {
    "dietary_style": "omnivore",
    "spice_level": "medium",
    "cuisine_preferences": ["vietnamese"],
    "disliked_ingredients": [],
    "health_goals": []
  }
}
```

**PUT /api/v1/users/me/allergies**

```json
// Request
{ "ingredient_ids": ["clx...", "clx..."] }

// Response 200
{
  "success": true,
  "data": {
    "allergies": [
      { "ingredient_id": "clx...", "name": "đậu phộng" }
    ]
  }
}
```
