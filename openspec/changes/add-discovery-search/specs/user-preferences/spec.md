## ADDED Requirements

### Requirement: User preferences are readable
The API SHALL expose `GET /api/v1/users/me/preferences` protected by JWT.

The response data SHALL include:

| Field | Type | Description |
|-------|------|-------------|
| `dietary_style` | string \| null | e.g. `omnivore`, `vegetarian`, `vegan` |
| `spice_level` | string \| null | e.g. `mild`, `medium`, `hot` |
| `cuisine_preferences` | string[] | Preferred cuisines |
| `disliked_ingredients` | string[] | Ingredients user avoids |
| `health_goals` | string[] | e.g. `low_carb`, `high_protein` |

#### Scenario: First read returns defaults
- **WHEN** an authenticated user has never saved preferences
- **THEN** GET SHALL return HTTP 200 with empty arrays and null scalar fields (not 404)

#### Scenario: Unauthenticated read blocked
- **WHEN** no valid Bearer token is provided
- **THEN** the API SHALL return HTTP 401

### Requirement: User preferences are upsertable
The API SHALL expose `PUT /api/v1/users/me/preferences` protected by JWT. The request body MAY include any subset of preference fields; omitted fields SHALL retain their previous values on update, or use defaults on first create.

#### Scenario: User saves spice preference
- **WHEN** the user PUTs `{ "spice_level": "hot" }`
- **THEN** subsequent GET SHALL return `spice_level: "hot"`

#### Scenario: User updates cuisine list
- **WHEN** the user PUTs `{ "cuisine_preferences": ["vietnamese", "japanese"] }`
- **THEN** GET SHALL return the updated array

#### Scenario: Invalid enum-like values rejected
- **WHEN** the user PUTs a `spice_level` value outside the allowed set documented in DTO
- **THEN** the API SHALL return HTTP 400 with code `INVALID_INPUT`

### Requirement: Preferences are used by discovery search
When discovery search is called with `options.use_preferences: true`, the service SHALL read preferences for the authenticated user from the database.

#### Scenario: No saved preferences with toggle on
- **WHEN** discovery search runs with `use_preferences: true` and the user has default/empty preferences
- **THEN** generation SHALL proceed without preference constraints (no error)
