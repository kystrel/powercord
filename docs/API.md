# Data API

Set `API_BASE_URL` in `bot/.env` to a reachable HTTP or HTTPS base URL and keep `ENABLE_MOCK_API=false`. The URL must not contain credentials, query parameters or fragments.

## Required routes

Implement these seven `GET` routes for startup and all bot commands. Return JSON directly, without a `data` wrapper. The client sends no authentication headers and rejects redirects.

| Route                       | Query            | Response                          | Used by             |
| --------------------------- | ---------------- | --------------------------------- | ------------------- |
| `/health`                   | None             | `200` with JSON when ready        | Bot startup         |
| `/api/status`               | None             | `DataStatus`                      | `/status`           |
| `/api/lifters`              | `name`           | `Lifter`                          | `/lifter`           |
| `/api/lifters/autocomplete` | `query`, `limit` | `string[]`                        | Lifter autocomplete |
| `/api/meets`                | `name`           | `Meet`                            | `/meet`             |
| `/api/meets/choices`        | `query`, `limit` | `MeetChoice[]`                    | Meet autocomplete   |
| `/api/top`                  | None             | `TopLifter[]`, highest DOTS first | `/top`              |

Return `404` for missing lifters or meets, and `409` for ambiguous typed meet names. Autocomplete must respect `limit` and return `[]` when nothing matches. Respond within 2 seconds for autocomplete and 10 seconds for other requests.

## Response types

The data types are in [types.ts](../bot/src/types/types.ts). The status response uses [DataStatus](../bot/src/data/apiClient.ts). All fields are required, including those that can be `null`. Empty arrays should be `[]`.

| Fields                            | Format                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| Weights and lifts                 | Numbers in kilograms                                             |
| `dots`                            | Number                                                           |
| `personalBests`                   | Array or `null`. Lift values and DOTS in this array are strings. |
| `date`, `year`                    | Strings, such as `"2026-01-10"` and `"2026"`                     |
| Status `revision`, `loadedAt`     | Revision string and timestamp, such as `"2026-01-10T12:00:00Z"`  |
| Status `lifterCount`, `meetCount` | Non-negative safe integers                                       |

A lifter's meets should be newest first. The top lifters response should contain the leaderboard in one array, ordered by DOTS.

Meet choices use `name` for the label and `value` for the full OPL path:

- `name`: `2026-01-10 [example/123] EXAMPLE Winter Open`
- `value`: `example/123`

Selecting this choice sends `example/123` to `/api/meets` as the `name` query parameter. Return only that meet and its entries. The date and path in the label distinguish meets with the same name.

## Examples

Just some examples on how the responses for each should look.

<details>
<summary>Lifter</summary>

```json
{
    "name": "Example Lifter",
    "url": "https://www.openpowerlifting.org/u/examplelifter",
    "meets": [
        {
            "place": 1,
            "federation": "EXAMPLE",
            "date": "2026-01-10",
            "country": "USA",
            "state": null,
            "name": "Winter Open",
            "division": "Open",
            "age": 30,
            "equipment": "Raw",
            "weightClass": 83,
            "bodyWeight": 82.5,
            "squat": 200,
            "bench": 125,
            "deadlift": 250,
            "total": 575,
            "dots": 390.5
        }
    ],
    "personalBests": [
        {
            "equipment": "Raw",
            "squat": "200",
            "bench": "125",
            "deadlift": "250",
            "total": "575",
            "dots": "390.5"
        }
    ]
}
```

</details>

<details>
<summary>Meet</summary>

```json
{
    "name": "Winter Open",
    "federation": "EXAMPLE",
    "date": "2026-01-10",
    "year": "2026",
    "url": "https://www.openpowerlifting.org/m/example/123",
    "country": "USA",
    "state": null,
    "town": null,
    "entries": [
        {
            "place": 1,
            "name": "Example Lifter",
            "sex": "M",
            "age": 30,
            "equipment": "Raw",
            "weightClass": 83,
            "bodyWeight": 82.5,
            "squat": 200,
            "bench": 125,
            "deadlift": 250,
            "total": 575,
            "dots": 390.5
        }
    ]
}
```

</details>

<details>
<summary>Top lifters</summary>

```json
[
    {
        "name": "Example Lifter",
        "sex": "M",
        "url": "https://www.openpowerlifting.org/u/examplelifter",
        "squat": 200,
        "bench": 125,
        "deadlift": 250,
        "total": 575,
        "dots": 390.5
    }
]
```

</details>

<details>
<summary>Status</summary>

```json
{
    "revision": "example-revision",
    "loadedAt": "2026-01-10T12:00:00Z",
    "lifterCount": 1,
    "meetCount": 1
}
```

</details>

<details>
<summary>Meet choices</summary>

```json
[
    {
        "name": "2026-01-10 [example/123] EXAMPLE Winter Open",
        "value": "example/123"
    }
]
```

</details>
