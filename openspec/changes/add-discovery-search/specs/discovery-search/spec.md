## ADDED Requirements

### Requirement: Discovery search accepts natural-language prompt
The API SHALL expose `POST /api/v1/discovery/search` protected by JWT. The request body SHALL be `{ prompt: string, options?: { use_preferences?: boolean, exclude_allergies?: boolean }, filters?: { max_time?: number, difficulty?: string, tags?: string[] } }`.

The `prompt` field SHALL be trimmed, non-empty after trim, and at most 500 characters. Validation failure SHALL return HTTP 400 with code `INVALID_INPUT`.

#### Scenario: Successful discovery search
- **WHEN** an authenticated user POSTs a valid prompt and Gemini returns recipes
- **THEN** the response SHALL be HTTP 201 with `{ success: true, data: RecipeDto[] }` containing 1–4 recipes

#### Scenario: Unauthenticated discovery search blocked
- **WHEN** the request has no valid Bearer token
- **THEN** the API SHALL return HTTP 401 and SHALL NOT invoke Gemini

#### Scenario: Empty prompt rejected
- **WHEN** the user POSTs `{ "prompt": "   " }`
- **THEN** the API SHALL return HTTP 400 with code `INVALID_INPUT`

#### Scenario: Prompt exceeds 500 characters rejected
- **WHEN** the user POSTs a prompt longer than 500 characters
- **THEN** the API SHALL return HTTP 400 with code `INVALID_INPUT`

### Requirement: Discovery search parses prompt before generation
Before calling recipe generation, the service SHALL invoke Gemini to parse the prompt into structured intent containing at minimum `ingredients: string[]` and optionally `cravings: string[]` and `dietary_notes: string[]`.

#### Scenario: Craving-only prompt yields inferred ingredients
- **WHEN** the user POSTs `{ "prompt": "Tôi đang thèm cay" }`
- **THEN** the parse step SHALL produce a non-empty ingredient or craving list used as input to recipe generation

### Requirement: Discovery search respects personalization options
When `options.use_preferences` is `true`, the service SHALL load the authenticated user's `UserPreferences` and include them in the Gemini generation context.

When `options.exclude_allergies` is `true`, the service SHALL load the user's allergy ingredients and instruct Gemini not to use those ingredients.

When an option is `false` or omitted, the corresponding profile data SHALL NOT affect generation or cache key.

#### Scenario: Preferences applied when toggle on
- **WHEN** the user has `spice_level: "hot"` saved and POSTs with `use_preferences: true`
- **THEN** the Gemini generation prompt SHALL include the user's spice preference

#### Scenario: Allergies excluded when toggle on
- **WHEN** the user is allergic to "tôm" and POSTs with `exclude_allergies: true`
- **THEN** the Gemini generation prompt SHALL explicitly exclude shrimp/allergen ingredients

#### Scenario: Toggles off skip profile
- **WHEN** the user POSTs with `use_preferences: false` and `exclude_allergies: false`
- **THEN** generation SHALL proceed using only the parsed prompt and request filters

### Requirement: Discovery search supports optional filters
The `filters` object SHALL use the same semantics as pantry search: `max_time` (minutes, positive integer), `difficulty` (`easy` | `medium` | `hard`), and `tags` (string array).

#### Scenario: Max time filter forwarded
- **WHEN** the user POSTs `filters.max_time: 30`
- **THEN** generated recipes SHOULD respect the time constraint in the Gemini prompt

#### Scenario: Vegetarian tag filter forwarded
- **WHEN** the user POSTs `filters.tags: ["vegetarian"]` (e.g. from FE Quick Start)
- **THEN** the Gemini generation prompt SHALL include the vegetarian constraint

### Requirement: Discovery search uses hybrid cache
Identical requests (normalized prompt hash + filters + options + profile snapshot when applicable) SHALL return cached recipes from `DiscoveryQuery` without calling Gemini.

#### Scenario: Cache hit returns stored recipes
- **WHEN** a second identical authenticated request hits the same cache key
- **THEN** the API SHALL return recipes from `DiscoveryQuery.resultRecipeIds` without calling `generateRecipes` again

#### Scenario: Cache miss persists new query
- **WHEN** Gemini generates new recipes on cache miss
- **THEN** a `DiscoveryQuery` row SHALL be created linking the hash to result recipe IDs

### Requirement: Discovery search persists generated recipes
On cache miss, newly generated recipes SHALL be persisted via the existing `RecipesService.persistGenerated` flow with `source: "gemini"`.

#### Scenario: Generated recipes are retrievable by id
- **WHEN** discovery search returns recipe IDs
- **THEN** each ID SHALL be loadable via `GET /api/v1/recipes/:id`

### Requirement: Discovery search error handling
Gemini rate limit errors SHALL map to HTTP 429 with code `TOO_MANY_REQUESTS`. Other Gemini or parse failures SHALL map to HTTP 500 with code `INTERNAL`.

#### Scenario: Rate limit surfaced to client
- **WHEN** Gemini returns a quota/rate-limit error
- **THEN** the API SHALL return HTTP 429 with code `TOO_MANY_REQUESTS`

### Requirement: Quick Start presets are not a server concern
The API SHALL NOT expose preset endpoints. The client composes Quick Start pills into `prompt` and optional `filters` before calling discovery search.

#### Scenario: FE vegetarian Quick Start
- **WHEN** the Flutter app sends `{ "prompt": "Gợi ý món chay", "filters": { "tags": ["vegetarian"] } }`
- **THEN** the API SHALL process it as a normal discovery search without requiring a preset identifier
