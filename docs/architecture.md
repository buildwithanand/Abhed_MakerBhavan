# ABHED Architecture Notes

## Purpose

ABHED provides a common operator view across distributed edge nodes that may combine RGB imagery, thermal readings, mmWave presence/range signals, geophone vibration, and acoustic samples. Sensor-specific acquisition and local processing remain on the appropriate edge hardware. The web service receives normalised readings and gives operators a consistent way to inspect status and review candidate events.

## Components

### 1. Edge sensing node

A node owns device drivers, timestamping, calibration, health diagnostics, and any sensor-specific signal processing. It should send only the fields required for operations. Keep raw imagery/audio local where possible; define explicit retention and access rules before transmitting such data.

### 2. Normalisation / transport boundary

Every upstream adapter maps native outputs into a stable JSON contract. A single API contract prevents the dashboard from needing to understand each sensor manufacturer's byte stream. The included serial bridge supports one JSON object per line; it is not a hardware driver.

### 3. Flask API and state store

The backend validates the JSON shape and numeric limits, checks the ingest API key, updates the node's latest reading, and appends an event. A detection candidate above the configured confidence threshold can create an incident record when a similar candidate is not already open for that node. Incident acknowledgement and resolution also append events.

The starter uses a thread-safe in-memory store. A field deployment should replace it with durable storage and consider a message broker or queue if sensor events can arrive in bursts.

### 4. Browser client

The UI polls `/api/snapshot` on a configurable interval and renders overview cards, a schematic node map, sensor cards, incident workflows, the event table, and settings. It does not include a map provider or claim surveyed locations.

## Data flow

1. Device driver acquires and timestamps a reading.
2. Node-side logic normalises units and sets `node_id`, `sensor_type`, `value`, `unit`, and event metadata.
3. Gateway authenticates with `X-API-Key` and posts to `/api/ingest/sensor` over a trusted network.
4. Backend validates the payload and updates the node registry.
5. A detection candidate may open an incident record; an operator reviews it and acknowledges or resolves it.
6. Event history is displayed in the dashboard and exported as CSV for review.

## Proposed hardening before field deployment

- Persist readings/events in PostgreSQL or another selected database, with migrations and retention policy.
- Use user authentication, role-based authorisation, CSRF protection for cookie-authenticated workflows, rate limits, and audit identity.
- Terminate TLS, rotate device credentials, and scope each device key to its node ID.
- Add schema versioning, signed firmware identity, replay protection, monotonic sequence numbers, and device clock health.
- Add health checks based on the actual hardware interfaces and calibrated self-test fixtures.
- Measure end-to-end latency, missing-packet rate, false-positive/false-negative rate, battery life, environmental performance, and cross-sensor failure modes with a documented test protocol.
- Add alert acknowledgement SLAs, incident escalation rules, and human-factors testing with operators.
- Conduct privacy, cybersecurity, reliability, and legal review for the intended deployment context.
