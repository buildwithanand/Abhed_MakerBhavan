# Hardware Integration Guide

This repo defines the dashboard and transport contract, not a complete driver set for every ABHED sensor. Build and verify each device acquisition path against the manufacturer's current documentation before connecting it.

## Suggested edge-node responsibilities

An ABHED prototype may use an Arduino UNO Q, STM32H743-class MCU, Raspberry Pi camera module, MLX90640 thermal array, DFRobot C4001 mmWave sensor, geophone, and digital microphone. The actual split depends on which board can access each bus and whether the device has the necessary OS/driver support.

A robust node should:

1. Acquire the sensor's native output through its documented bus/SDK (e.g. UART, I²C, SPI, CSI, or USB as appropriate).
2. Check the reading for malformed frames and sensor health, and attach a timestamp and device/node ID.
3. Convert measurements to documented units. Do not label an uncalibrated value as a physical distance, temperature, or confidence score.
4. Optionally fuse readings locally, retain the evidence required for later operator review, and publish only the metadata needed by the dashboard.
5. Send JSON to the API over a trusted LAN, with a device credential that is not compiled into a public repository.

## Example normalisation contract

```json
{
  "node_id": "ABH-N01",
  "sensor_type": "thermal_array",
  "metric": "maximum_pixel_temperature",
  "value": 31.8,
  "unit": "degC",
  "event_type": "telemetry",
  "detection": false,
  "confidence": 0.0,
  "note": "calibrated reading; sensor health OK"
}
```

For a candidate created by a validated algorithm, use `event_type: "detection"`, `detection: true`, a class label that does not assert identity, and a calibrated confidence. An alert remains a candidate until independently reviewed.

## JSON-lines serial bridge

`scripts/serial_bridge.py` is an optional generic adapter. It expects the producer to write one complete UTF-8 JSON object followed by a newline to a serial port. It posts each line to `/api/ingest/sensor`. A raw C4001 packet, binary thermal frame, camera stream, or arbitrary debug print is **not** in this format and must be decoded/filtered by a device-side program first.

The serial adapter can be installed with the base `requirements.txt` and then launched like this:

```bash
python scripts/serial_bridge.py --port COM5 --baud 115200
```

Use a device-appropriate port name and baud rate. Do not assume the same UART pins or baud rate across boards.

## Network access

By default, the Flask service binds to `127.0.0.1`, so only the same computer can reach it. To allow a trusted device on a local isolated network to reach it, set `ABHED_HOST=0.0.0.0` and `ABHED_PORT=5000` in `.env`, then restrict the host firewall to the device subnet. This does not add TLS. Do not forward port 5000 from a router or expose it to the public internet.

Before real sensor integration, add TLS, per-node credentials and authorisation, persistent storage, replay protection, rate limits, network segmentation, monitoring, clock synchronisation, and a tested device protocol.
