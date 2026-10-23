# Security Policy

ABHED in this repository is a prototype. Do not connect it to an exposed or safety-critical environment without an independent security and operational review.

## Reporting a vulnerability

Please do not publish secrets, device keys, private sensor data, sensitive facility locations, or exploit details in a public issue. For this public starter repository, open a private security advisory through GitHub if enabled by the repository owner. Otherwise contact the repository maintainers privately before disclosing technical details.

## Current security limitations

- The local demo does not implement user login or role-based access control.
- Only the sensor-ingest endpoint requires an API key; the other write endpoints are designed for a local prototype and are not production-authorised.
- The Flask development server does not provide TLS.
- Configuration, node records, incidents, and event history live in memory and are not durable.
- Device keys are shared at the application level in this starter; per-device scoped credentials and rotation are not implemented.

Before field deployment, add authenticated operator sessions, authorisation on every write endpoint, TLS, per-device credentials, replay protection, persistent audit records, secure configuration management, network restrictions, and an independent penetration test.
