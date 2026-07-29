## ADDED Requirements

### Requirement: User allergies are readable
The API SHALL expose `GET /api/v1/users/me/allergies` protected by JWT.

The response data SHALL be `{ allergies: { ingredient_id: string, name: string }[] }` where `name` is the ingredient's `canonicalName`.

#### Scenario: User with no allergies
- **WHEN** an authenticated user has no allergy records
- **THEN** GET SHALL return HTTP 200 with `{ "allergies": [] }`

#### Scenario: Allergies include canonical names
- **WHEN** the user is allergic to ingredient id `X` with canonical name "đậu phộng"
- **THEN** GET SHALL include `{ "ingredient_id": "X", "name": "đậu phộng" }`

### Requirement: User allergies are replaceable
The API SHALL expose `PUT /api/v1/users/me/allergies` protected by JWT with body `{ ingredient_ids: string[] }`.

The operation SHALL replace the user's entire allergy set atomically (within a transaction). Unknown ingredient IDs SHALL cause HTTP 400 with code `INVALID_INPUT`.

#### Scenario: User sets two allergies
- **WHEN** the user PUTs `{ "ingredient_ids": ["id1", "id2"] }`
- **THEN** GET SHALL return exactly those two allergies

#### Scenario: User clears all allergies
- **WHEN** the user PUTs `{ "ingredient_ids": [] }`
- **THEN** GET SHALL return an empty array

#### Scenario: Unknown ingredient id rejected
- **WHEN** the user PUTs an ingredient id that does not exist in the database
- **THEN** the API SHALL return HTTP 400 with code `INVALID_INPUT` and SHALL NOT partial-update

#### Scenario: Duplicate ids in request deduplicated
- **WHEN** the user PUTs `{ "ingredient_ids": ["id1", "id1"] }`
- **THEN** the stored allergy set SHALL contain `id1` once

### Requirement: Allergies are used by discovery search
When discovery search is called with `options.exclude_allergies: true`, the service SHALL load the user's allergy ingredient names and pass them to Gemini as exclusions.

#### Scenario: Exclude allergies with empty list
- **WHEN** discovery search runs with `exclude_allergies: true` and the user has no allergies
- **THEN** generation SHALL proceed normally (no error)

#### Scenario: Exclude allergies with toggle off
- **WHEN** discovery search runs with `exclude_allergies: false`
- **THEN** stored allergies SHALL NOT affect generation even if present
