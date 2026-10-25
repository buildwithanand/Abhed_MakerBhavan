# ABHED Field Awareness Platform

[![Python](https://img.shields.io/badge/python-3.10%2B-3776AB.svg)](https://www.python.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

ABHED is a field-awareness and operator-monitoring platform for distributed sensor nodes, designed to help teams review live or simulated environmental activity, understand node health, and triage incidents with a clear operational view.

This repository provides a working Flask-based dashboard, normalised sensor ingestion endpoints, event logging, simulation utilities, and an operator workflow for acknowledging or resolving candidate incidents.

> Important: the default application starts in demo simulation mode. The displayed nodes, readings, and incidents are sample data and are not operational evidence.

## Overview

ABHED brings together:

- sensor node health and telemetry summaries
- a schematic field map with node connectivity
- incident candidate detection and review workflows
- event history and CSV export for audits
- an API contract for normalised sensor ingestion
- a local simulation environment for testing and demonstrations

The system is intended as an operational prototype and integration scaffold for field deployments, not as a standalone safety-critical system.

## Core capabilities

- Operations overview with availability, health, and incident indicators
- Schematic map for node visibility and logical connectivity
- Normalised reading model for sensor inputs from edge devices or gateways
- Incident lifecycle: open, acknowledge, resolve, note, export
- Event timeline for operator and system actions
- Configurable UI settings for refresh rate, confidence threshold, and simulation mode
- Flask API with validation and authenticated sensor ingestion
- JSON-lines serial bridge for devices already producing normalised payloads

## Architecture

ABHED separates sensor-specific acquisition from the dashboard service. Edge devices or an upstream adapter send normalised JSON to the Flask API; the API updates a thread-safe, in-memory state store. The browser fetches snapshots on a timer and sends operator actions back through the API. In demo mode, a background simulator updates the same state store. There is no database or server-push connection in the current implementation.

```mermaid
flowchart LR
    subgraph Devices["Field devices and adapters"]
        Sensors["Sensors and node firmware"]
        Normalize["Device-side acquisition and normalization"]
        Publisher["Sample publisher"]
        Serial["JSON-lines serial bridge"]
        Sensors --> Normalize
        Normalize --> Serial
    end

    subgraph Service["ABHED Flask service"]
        App["Application factory<br/>run.py"]
        Routes["HTTP routes<br/>HTML, API, CSV export"]
        State[("SystemState<br/>thread-safe in-memory data")]
        Simulator["Demo simulator<br/>background thread"]
        App --> Routes
        Routes <--> State
        Simulator --> State
    end

    subgraph Browser["Operator browser"]
        Page["Dashboard HTML, CSS, JavaScript"]
        Operator["Operator<br/>reviews incidents and events"]
        Operator --> Page
    end

    Normalize -->|"Normalized JSON + X-API-Key"| Routes
    Serial -->|"POST /api/ingest/sensor"| Routes
    Publisher -->|"POST /api/ingest/sensor"| Routes
    Routes -->|"Dashboard page and static assets"| Page
    Page -->|"Poll GET /api/snapshot<br/>and send operator actions"| Routes
```

```mermaid
sequenceDiagram
    participant Node as Edge node or sample publisher
    participant Bridge as Optional serial bridge
    participant API as ABHED API
    participant Store as SystemState (memory)
    participant UI as Browser Dashboard
    actor Operator

    alt Serial transport
        Node->>Bridge: Newline-delimited normalized JSON
        Bridge->>API: POST /api/ingest/sensor + X-API-Key
    else Direct HTTP client
        Node->>API: POST /api/ingest/sensor + X-API-Key
    end
    API->>API: Validate payload and check ingest key
    API->>Store: Update node reading; append event
    opt Detection meets configured threshold
        API->>Store: Create incident candidate
    end
    alt Serial transport
        API-->>Bridge: HTTP result
    else Direct HTTP client
        API-->>Node: HTTP result
    end

    UI->>API: GET / (load dashboard)
    API-->>UI: HTML and static assets
    loop Configured refresh interval
        UI->>API: GET /api/snapshot
        API->>Store: Read current state
        Store-->>API: Nodes, incidents, events, config
        API-->>UI: JSON snapshot
    end
    Operator->>UI: Acknowledge or resolve candidate
    UI->>API: POST incident action
    API->>Store: Update incident and append event
    API-->>UI: Updated incident
    UI->>API: GET /api/export/events.csv (on export)
    API->>Store: Read event history
    API-->>UI: CSV download
```

The serial bridge is optional and only forwards complete, normalized JSON lines; it does not decode device-specific sensor protocols. The simulator is for demonstrations and tests, not live sensing.

## Repository structure

```text
.
|-- abhed_app/
|   |-- __init__.py              # Flask application factory
|   |-- routes.py                # Flask routes and API logic
|   |-- simulator.py             # Demo simulation and telemetry generation
|   |-- state.py                 # In-memory node, incident, and event state
|   |-- static/                  # CSS, JavaScript, and static assets
|   `-- templates/               # Dashboard HTML templates
|-- docs/
|   |-- api.md                   # API reference and payload examples
|   |-- architecture.md          # Design notes and deployment guidance
|   |-- hardware-integration.md  # Hardware integration guidance
|   `-- openapi.yaml             # OpenAPI specification
|-- hardware/
|   |-- electrical/              # BOM and electrical reference tables
|   `-- mechanical/              # 3D mechanical models
|-- scripts/
|   |-- publish_sample.py        # Example sensor publisher
|   `-- serial_bridge.py         # JSON-lines serial adapter
|-- tests/
|   `-- test_api.py              # API and workflow tests
|-- .gitignore
|-- CONTRIBUTING.md
|-- LICENSE
|-- Makefile                     # Common local commands
|-- pytest.ini                   # Pytest configuration
|-- README.md                    # Project documentation
|-- requirements.txt             # Python dependencies
|-- run.py                       # Application startup entry point
`-- SECURITY.md                  # Security reporting guidance
```

Hardware reference files are grouped by type: the bill of materials and electrical connection/pin tables are in [`hardware/electrical/`](hardware/electrical/), and 3D mechanical models are in [`hardware/mechanical/`](hardware/mechanical/). Runtime application state is currently held in memory and is not stored in a repository data directory.

## Quick start

Requirements: Python 3.10+

### Windows (PowerShell)

```powershell
cd ABHED_Field_Awareness_Platform
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Sensor ingestion is disabled until `ABHED_INGEST_API_KEY` is set to a strong secret. For example, set it in your environment before starting the app: `$env:ABHED_INGEST_API_KEY = "your-secret"` in PowerShell or `export ABHED_INGEST_API_KEY="your-secret"` on Linux/macOS.

```powershell
python run.py
```

Open http://127.0.0.1:5000 in your browser.

### Linux / macOS

```bash
cd ABHED_Field_Awareness_Platform
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Then start the application:

```bash
python run.py
```

## Configuration

The project uses environment variables for local configuration. The defaults are suitable for a demo environment, but production or field deployment should use stronger configuration controls.

| Variable | Default | Description |
|---|---|---|
| `ABHED_HOST` | `127.0.0.1` | Bind address |
| `ABHED_PORT` | `5000` | HTTP port |
| `ABHED_DEBUG` | `false` | Flask debug mode |
| `ABHED_SIMULATION` | `true` | Enables demo telemetry generation |
| `ABHED_INGEST_API_KEY` | placeholder | Secret required for authenticated sensor writes |
| `ABHED_SITE_NAME` | `ABHED Field Operations` | Display name in the UI and API metadata |
| `ABHED_DETECTION_THRESHOLD` | `0.72` | Incident candidate threshold |

## Sensor ingestion and event flow

1. A node or gateway normalises a sensor reading into the project schema.
2. A trusted client posts to `POST /api/ingest/sensor` with the correct API key.
3. The backend validates the payload, updates node state, and appends an event.
4. If the reading exceeds the configured threshold and a similar candidate is not already open, an incident record may be created.
5. The operator can acknowledge or resolve the candidate and add a note.
6. Event history can be reviewed in the UI and exported to CSV.

### Example publisher

```bash
# Windows PowerShell
$env:ABHED_INGEST_API_KEY="your-secret"
python scripts/publish_sample.py --node ABH-N01 --sensor mmWave --value 5.4 --unit m
```

### Serial bridge

For hardware already producing one valid JSON object per line:

```bash
python scripts/serial_bridge.py --port COM5 --baud 115200
# Linux example: python scripts/serial_bridge.py --port /dev/ttyACM0 --baud 115200
```

This helper does not replace device-specific sensor acquisition or calibration logic; it passes through an already-normalised payload.

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health and version probe |
| `GET` | `/api/snapshot` | Dashboard data snapshot |
| `GET` | `/api/nodes` | Node registry and telemetry |
| `POST` | `/api/nodes` | Register a node |
| `GET` | `/api/incidents?status=active` | Get incident candidates |
| `POST` | `/api/incidents/{id}/acknowledge` | Acknowledge an incident |
| `POST` | `/api/incidents/{id}/resolve` | Resolve an incident with a note |
| `GET` | `/api/events?limit=50` | Recent event trail |
| `GET` | `/api/export/events.csv` | Export the event log |
| `GET` / `PUT` | `/api/config` | Read or update local configuration |
| `POST` | `/api/nodes/{id}/self-test` | Run a software-level self-test |
| `POST` | `/api/ingest/sensor` | Authenticated ingestion of a sensor payload |

See [`docs/api.md`](docs/api.md) for payload validation details and examples.

## Demo mode and operational cautions

This project intentionally ships with a visible demo state to make testing and UI review easy.

- Node positions and readings are illustrative, not geographic truth.
- Incident candidates are not verified operational alerts.
- The simulation is not a substitute for calibrated field devices.
- Self-tests validate software flow, not physical sensor alignment or environmental conditions.
- In-memory state is not durable; an app restart clears runtime data.

## Deployment and hardening guidance

ABHED is structured as a prototype and integration scaffold. Before any real-world deployment, operators should consider:

- persistent storage for readings and events
- user authentication and roles
- TLS termination and encrypted transport
- device-level credential rotation and node scoping
- audit retention and backup plans
- rate limits and abuse monitoring
- sensor validation against ground truth and calibration procedures
- privacy and cyber-security review for the target environment

## Testing

```bash
pytest -q
```

## Contributing

Contributions are welcome. For bug fixes, feature additions, or API changes:

1. create a feature branch
2. update or add tests where relevant
3. verify the local project behavior with the existing test suite
4. open a pull request with a clear summary of changes

## Security

Please report security issues privately in accordance with [`SECURITY.md`](SECURITY.md). Do not disclose vulnerabilities publicly before a remediation path has been established.

## License

This project is licensed under the MIT license. See [`LICENSE`](LICENSE).
