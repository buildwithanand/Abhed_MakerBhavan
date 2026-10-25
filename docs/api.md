# API Reference

Base URL for local use: `http://127.0.0.1:5000`.

## `GET /api/health`

Returns `{"status":"ok","service":"abhed-dashboard","version":"1.0.0"}` when the HTTP service is responding. This is not a physical node health check.

## `GET /api/snapshot`

Returns `meta`, `overview`, `nodes`, `incidents`, `events`, and `config`. The snapshot is designed for the browser dashboard.

## `GET /api/nodes`

Returns the registered nodes including node ID, logical location, status, battery estimate, temperature, uptime estimate, firmware label, last-seen timestamp, position on the schematic, configured sensor list, and latest readings.

## `POST /api/nodes`

Registers a node in the in-memory registry. New nodes start as `offline` until their first authenticated sensor reading is received.

```json
{
  "id": "ABH-N07",
  "name": "Western Ridge",
  "sensors": ["mmWave", "Thermal"],
  "x": 50,
  "y": 40
}
```

`id` must be unique and 2–40 characters using letters, numbers, underscores, or hyphens. `name` must be 1–80 characters. `sensors` can be a list or comma-separated string with 1–12 labels. `x` and `y` are integer positions from 0–100 on the schematic (not geographic coordinates).

## `GET /api/incidents?status=active`

Accepted `status` values are `all`, `active`, `acknowledged`, and `resolved`.

## `POST /api/incidents/{incident_id}/acknowledge`

Optional JSON body:

```json
{"operator":"Field operator"}
```

Returns `404` when not found and `409` if the record is already resolved.

## `POST /api/incidents/{incident_id}/resolve`

Optional JSON body:

```json
{"operator":"Field operator","note":"Reviewed; no further action required."}
```

## `GET /api/events?limit=50`

Returns a limited set of recent in-memory events. The `limit` must be an integer from 1 to 300.

## `GET /api/export/events.csv`

Downloads the current event log in CSV form with columns `id`, `timestamp`, `type`, `severity`, `source`, `title`, and `message`.

## `GET /api/config` and `PUT /api/config`

The update body may contain one or more of the fields below:

```json
{
  "site_name": "ABHED Field Operations",
  "refresh_seconds": 3,
  "detection_threshold": 0.72,
  "simulation_enabled": true
}
```

Validation: site name 1–100 characters; refresh interval 2–15 seconds; confidence threshold 0.10–0.99.

## `POST /api/nodes/{node_id}/self-test`

Performs a software-level state update and logs an event. It is not a physical sensor diagnostic.

## `POST /api/nodes/{node_id}/status`

For local development/testing only. JSON body:

```json
{"status":"degraded"}
```

Accepted values are `online`, `degraded`, and `offline`.

## `POST /api/ingest/sensor`

Requires the `X-API-Key` header to match `ABHED_INGEST_API_KEY` in `.env`. Ingestion is disabled with HTTP `503` until the placeholder secret is replaced. Invalid/missing keys receive `401`.

Example telemetry payload:

```json
{
  "node_id": "ABH-N01",
  "sensor_type": "mmWave",
  "metric": "range",
  "value": 5.4,
  "unit": "m",
  "event_type": "telemetry",
  "detection": false,
  "confidence": 0.0,
  "note": "normalised edge reading"
}
```

Example candidate payload:

```json
{
  "node_id": "ABH-N03",
  "sensor_type": "sensor_fusion",
  "metric": "presence_candidate",
  "value": 1,
  "unit": "flag",
  "event_type": "detection",
  "detection": true,
  "confidence": 0.84,
  "classification": "unclassified_movement",
  "note": "cross-sensor candidate; human review required"
}
```

Fields:

- `node_id` (required string): must already exist in the node registry.
- `sensor_type` (required string): up to 60 characters.
- `value` (required number; defaults to zero if omitted): between -1,000,000 and 1,000,000. The backend does not know if the unit is physically correct.
- `unit` (optional string): short unit label.
- `metric` (optional string): display name for the reading.
- `event_type` (optional string): must be `telemetry` or `detection`. When both `event_type` and `detection` are supplied, they must agree. If omitted, the event type is inferred from `detection`.
- `detection` (optional boolean): whether this reading is a candidate detection.
- `confidence` (optional number): 0–1, and only meaningful if calibrated by the producing model/algorithm.
- `classification` and `note` (optional strings): limited-length descriptive metadata.

Responses return `201 Created` on accepted payloads. A successful ingest can return `incident_created: true` if the candidate crosses the current configured threshold and no similar open record exists for the node. This workflow does not validate the classification or prove the event happened.

### cURL example

```bash
curl -X POST http://127.0.0.1:5000/api/ingest/sensor \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ABHED_INGEST_API_KEY" \
  -d '{"node_id":"ABH-N01","sensor_type":"mmWave","metric":"range","value":5.4,"unit":"m","event_type":"telemetry","detection":false,"confidence":0.0}'
```
