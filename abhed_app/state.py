"""Thread-safe in-memory state for demo telemetry and operational events.

The in-memory store is intentionally replaceable: connect a database before using
this prototype for a persistent or operational deployment.
"""
from __future__ import annotations

import copy
import math
import threading
import uuid
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def short_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


class SystemState:
    def __init__(self, site_name: str = "ABHED Field Operations", simulation_enabled: bool = True,
                 detection_threshold: float = 0.72):
        self.lock = threading.RLock()
        self.site_name = site_name
        self.simulation_enabled = simulation_enabled
        self.detection_threshold = min(0.99, max(0.1, float(detection_threshold)))
        self.refresh_seconds = 3
        self.started_at = utc_now()
        self._last_incident_by_node: dict[str, float] = {}
        self.nodes: list[dict[str, Any]] = []
        self.incidents: list[dict[str, Any]] = []
        self.events: list[dict[str, Any]] = []
        self._seed()

    def _seed(self) -> None:
        now = utc_now()
        nodes = [
            ("ABH-N01", "North Gate", 13, 22, "online", 98, ["RGB camera", "Thermal", "mmWave"]),
            ("ABH-N02", "Ridgeline East", 32, 13, "online", 93, ["mmWave", "Geophone", "Acoustic"]),
            ("ABH-N03", "Sector B-04", 52, 26, "online", 87, ["RGB camera", "Thermal", "Acoustic"]),
            ("ABH-N04", "Dry Creek", 73, 16, "degraded", 64, ["mmWave", "Geophone"]),
            ("ABH-N05", "South Track", 87, 43, "online", 91, ["RGB camera", "Thermal", "mmWave"]),
            ("ABH-N06", "Relay Station", 42, 57, "online", 100, ["Edge gateway", "Network relay"]),
        ]
        for node_id, location, x, y, status, battery, sensors in nodes:
            self.nodes.append({
                "id": node_id,
                "name": location,
                "location": location,
                "status": status,
                "battery_pct": battery,
                "temperature_c": round(34.5 + (x % 8) * 0.7, 1),
                "uptime_pct": round(99.2 - (x % 4) * 0.25, 2),
                "firmware": "0.4.2-demo",
                "last_seen": now,
                "position": {"x": x, "y": y},
                "sensors": sensors,
                "readings": self._initial_readings(sensors),
                "detections_today": 2 if node_id in {"ABH-N01", "ABH-N03"} else 0,
                "last_self_test": "Passed · demo",
            })

        self.incidents = [
            self._new_incident("ABH-N03", "Sector B-04", "human_presence", "high", 0.91,
                               "Multi-sensor correlation", 52, 26, "active", age_min=4),
            self._new_incident("ABH-N01", "North Gate", "unclassified_movement", "medium", 0.77,
                               "mmWave + thermal", 13, 22, "acknowledged", age_min=19),
            self._new_incident("ABH-N05", "South Track", "animal_movement", "low", 0.66,
                               "RGB motion candidate", 87, 43, "resolved", age_min=52),
        ]
        self.events = [
            self._event("system", "System initialised", "ABHED operations service started in simulation mode.", "info", "SYS"),
            self._event("node_online", "Node connected", "ABH-N01 · North Gate reporting normally.", "success", "ABH-N01"),
            self._event("sensor_reading", "Thermal sample received", "ABH-N03 · 31.8 °C surface estimate (demo reading).", "info", "ABH-N03"),
            self._event("incident_opened", "Incident raised", "ABH-N03 · Multi-sensor correlation exceeded the configured threshold.", "warning", "ABH-N03"),
            self._event("node_degraded", "Node health degraded", "ABH-N04 · Battery below preferred operating level.", "warning", "ABH-N04"),
            self._event("incident_acknowledged", "Incident acknowledged", "ABH-N01 · Assigned to the review queue.", "info", "ABH-N01"),
        ]

    @staticmethod
    def _initial_readings(sensors: list[str]) -> list[dict[str, Any]]:
        readings = []
        values = {
            "RGB camera": ("frame_rate", 14.8, "fps"),
            "Thermal": ("surface_temperature", 31.8, "°C"),
            "mmWave": ("range", 6.4, "m"),
            "Geophone": ("vibration_rms", 0.018, "g"),
            "Acoustic": ("sound_level", 38.6, "dB"),
            "Edge gateway": ("cpu_load", 28, "%"),
            "Network relay": ("packet_loss", 0.2, "%"),
        }
        for sensor in sensors:
            key, value, unit = values.get(sensor, ("signal", 0, ""))
            readings.append({"sensor": sensor, "metric": key, "value": value, "unit": unit, "updated_at": utc_now()})
        return readings

    def _new_incident(self, node_id: str, location: str, classification: str, severity: str,
                      confidence: float, source: str, x: int, y: int, status: str = "active",
                      age_min: int = 0) -> dict[str, Any]:
        from datetime import timedelta
        created = datetime.now(timezone.utc) - timedelta(minutes=age_min)
        timestamp = created.isoformat(timespec="seconds").replace("+00:00", "Z")
        return {
            "id": short_id("INC"), "node_id": node_id, "location": location,
            "classification": classification, "severity": severity,
            "confidence": round(float(confidence), 3), "source": source,
            "position": {"x": x, "y": y}, "status": status,
            "created_at": timestamp, "updated_at": timestamp,
            "acknowledged_by": "Duty operator" if status in {"acknowledged", "resolved"} else None,
            "resolved_at": timestamp if status == "resolved" else None,
            "notes": "Demo incident — verify with sensor evidence before taking action.",
        }

    def _event(self, event_type: str, title: str, message: str, severity: str, source: str) -> dict[str, Any]:
        return {"id": short_id("EVT"), "type": event_type, "title": title, "message": message,
                "severity": severity, "source": source, "timestamp": utc_now()}

    def _add_event_unlocked(self, event_type: str, title: str, message: str,
                            severity: str = "info", source: str = "SYS") -> dict[str, Any]:
        event = self._event(event_type, title, message, severity, source)
        self.events.insert(0, event)
        self.events = self.events[:300]
        return event

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            nodes = copy.deepcopy(self.nodes)
            incidents = copy.deepcopy(self.incidents)
            events = copy.deepcopy(self.events[:300])
            active = sum(1 for item in incidents if item["status"] == "active")
            acknowledged = sum(1 for item in incidents if item["status"] == "acknowledged")
            resolved = sum(1 for item in incidents if item["status"] == "resolved")
            online = sum(1 for node in nodes if node["status"] == "online")
            degraded = sum(1 for node in nodes if node["status"] == "degraded")
            offline = sum(1 for node in nodes if node["status"] == "offline")
            detections = sum(node["detections_today"] for node in nodes)
            coverage = round((online / max(1, len(nodes))) * 100)
            return {
                "meta": {"site_name": self.site_name, "version": "1.0.0", "timestamp": utc_now(),
                         "simulation_enabled": self.simulation_enabled, "uptime_since": self.started_at},
                "overview": {"total_nodes": len(nodes), "online_nodes": online, "degraded_nodes": degraded,
                             "offline_nodes": offline, "active_incidents": active,
                             "acknowledged_incidents": acknowledged, "resolved_incidents": resolved,
                             "detections_today": detections, "coverage_pct": coverage,
                             "system_status": "attention" if (degraded or offline or active) else "nominal"},
                "nodes": nodes, "incidents": incidents, "events": events,
                "config": {"site_name": self.site_name, "simulation_enabled": self.simulation_enabled,
                           "detection_threshold": self.detection_threshold, "refresh_seconds": self.refresh_seconds,
                           "persistence": "in-memory demo store"},
            }

    def add_event(self, event_type: str, title: str, message: str,
                  severity: str = "info", source: str = "SYS") -> dict[str, Any]:
        with self.lock:
            return copy.deepcopy(self._add_event_unlocked(event_type, title, message, severity, source))

    def acknowledge_incident(self, incident_id: str, operator: str = "Duty operator") -> dict[str, Any] | None:
        with self.lock:
            incident = next((item for item in self.incidents if item["id"] == incident_id), None)
            if not incident:
                return None
            if incident["status"] == "resolved":
                raise ValueError("Resolved incidents cannot be acknowledged.")
            incident["status"] = "acknowledged"
            incident["acknowledged_by"] = operator[:80]
            incident["updated_at"] = utc_now()
            self._add_event_unlocked("incident_acknowledged", "Incident acknowledged",
                                      f"{incident['id']} · {incident['location']} assigned to {incident['acknowledged_by']}.",
                                      "info", incident["node_id"])
            return copy.deepcopy(incident)

    def resolve_incident(self, incident_id: str, operator: str = "Duty operator", note: str = "") -> dict[str, Any] | None:
        with self.lock:
            incident = next((item for item in self.incidents if item["id"] == incident_id), None)
            if not incident:
                return None
            incident["status"] = "resolved"
            incident["resolved_at"] = utc_now()
            incident["updated_at"] = incident["resolved_at"]
            if note.strip():
                incident["notes"] = note.strip()[:500]
            incident["acknowledged_by"] = operator[:80]
            self._add_event_unlocked("incident_resolved", "Incident resolved",
                                      f"{incident['id']} · {incident['location']} marked resolved by {incident['acknowledged_by']}.",
                                      "success", incident["node_id"])
            return copy.deepcopy(incident)

    def self_test(self, node_id: str) -> dict[str, Any] | None:
        with self.lock:
            node = next((item for item in self.nodes if item["id"] == node_id), None)
            if not node:
                return None
            node["last_self_test"] = f"Passed · {utc_now()}"
            self._add_event_unlocked("self_test", "Node self-test completed",
                                      f"{node_id} · dashboard API action completed; physical sensor path not tested.",
                                      "success", node_id)
            return copy.deepcopy(node)

    def update_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            site_name = self.site_name
            detection_threshold = self.detection_threshold
            refresh_seconds = self.refresh_seconds
            simulation_enabled = self.simulation_enabled

            if "site_name" in payload:
                site_name = str(payload["site_name"]).strip()
                if not site_name or len(site_name) > 100:
                    raise ValueError("site_name must contain 1–100 characters.")
            if "detection_threshold" in payload:
                try:
                    detection_threshold = float(payload["detection_threshold"])
                except (TypeError, ValueError):
                    raise ValueError("detection_threshold must be a number.")
                if not math.isfinite(detection_threshold) or not 0.1 <= detection_threshold <= 0.99:
                    raise ValueError("detection_threshold must be between 0.10 and 0.99.")
            if "refresh_seconds" in payload:
                requested_refresh = payload["refresh_seconds"]
                if isinstance(requested_refresh, bool):
                    raise ValueError("refresh_seconds must be an integer.")
                try:
                    refresh_seconds = int(requested_refresh)
                except (TypeError, ValueError):
                    raise ValueError("refresh_seconds must be an integer.")
                if isinstance(requested_refresh, float) and requested_refresh != refresh_seconds:
                    raise ValueError("refresh_seconds must be an integer.")
                if not 2 <= refresh_seconds <= 15:
                    raise ValueError("refresh_seconds must be between 2 and 15.")
            if "simulation_enabled" in payload:
                requested_simulation = payload["simulation_enabled"]
                if not isinstance(requested_simulation, bool):
                    raise ValueError("simulation_enabled must be a boolean.")
                simulation_enabled = requested_simulation

            simulation_changed = simulation_enabled != self.simulation_enabled
            self.site_name = site_name
            self.detection_threshold = detection_threshold
            self.refresh_seconds = refresh_seconds
            self.simulation_enabled = simulation_enabled

            if simulation_changed:
                self._add_event_unlocked("simulation_mode", "Simulation mode updated",
                                          f"Simulation mode {'enabled' if self.simulation_enabled else 'disabled'}.",
                                          "info", "SYS")
            self._add_event_unlocked("config_updated", "Configuration updated",
                                      "Dashboard configuration has been updated.", "info", "SYS")
            return {"site_name": self.site_name, "simulation_enabled": self.simulation_enabled,
                    "detection_threshold": self.detection_threshold, "refresh_seconds": self.refresh_seconds,
                    "persistence": "in-memory demo store"}

    def ingest(self, payload: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        """Accept one normalised node reading. Returns (accepted data, incident_created)."""
        node_id = str(payload.get("node_id", "")).strip()
        sensor_type = str(payload.get("sensor_type", "")).strip()
        if not node_id or not sensor_type:
            raise ValueError("node_id and sensor_type are required.")
        if len(node_id) > 40 or len(sensor_type) > 60:
            raise ValueError("node_id or sensor_type is too long.")
        try:
            value = float(payload.get("value", 0))
            confidence = float(payload.get("confidence", 0))
        except (TypeError, ValueError):
            raise ValueError("value and confidence must be numeric.")
        if not math.isfinite(value) or not (-1_000_000 <= value <= 1_000_000):
            raise ValueError("value is outside the accepted range.")
        if not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ValueError("confidence must be between 0 and 1.")
        if "detection" in payload and not isinstance(payload["detection"], bool):
            raise ValueError("detection must be a boolean.")
        unit = str(payload.get("unit", ""))[:16]
        event_type = str(payload.get("event_type", "telemetry")).lower()
        detection = payload.get("detection", event_type == "detection")
        classification = str(payload.get("classification", "unclassified_movement"))[:80]
        note = str(payload.get("note", "Sensor payload received"))[:200]
        with self.lock:
            node = next((item for item in self.nodes if item["id"] == node_id), None)
            if not node:
                raise KeyError("Unknown node_id. Add the node to the registry before ingesting readings.")
            reading = {"sensor": sensor_type, "metric": str(payload.get("metric", sensor_type))[:60],
                       "value": round(value, 4), "unit": unit, "updated_at": utc_now()}
            node["readings"] = [r for r in node["readings"] if r["sensor"].lower() != sensor_type.lower()]
            node["readings"].insert(0, reading)
            if not any(existing.lower() == sensor_type.lower() for existing in node["sensors"]) and len(node["sensors"]) < 12:
                node["sensors"].append(sensor_type)
            node["readings"] = node["readings"][:12]
            node["last_seen"] = utc_now()
            node["status"] = "online"
            if detection:
                node["detections_today"] += 1
            severity = "warning" if detection else "info"
            self._add_event_unlocked("sensor_detection" if detection else "sensor_reading",
                                      "Detection candidate received" if detection else "Sensor reading received",
                                      f"{node_id} · {sensor_type} = {value:g}{(' ' + unit) if unit else ''}. {note}",
                                      severity, node_id)
            created = False
            if detection and confidence >= self.detection_threshold:
                existing_open = any(i["node_id"] == node_id and i["status"] in {"active", "acknowledged"}
                                    and i["classification"] == classification for i in self.incidents)
                if not existing_open:
                    p = node["position"]
                    severity_level = "high" if confidence >= 0.88 else "medium"
                    incident = self._new_incident(node_id, node["location"], classification, severity_level,
                                                  confidence, f"{sensor_type} · edge ingest", p["x"], p["y"])
                    incident["notes"] = "Created from an authenticated sensor ingest payload. Validate with independent evidence."
                    self.incidents.insert(0, incident)
                    self._add_event_unlocked("incident_opened", "New incident candidate",
                                              f"{incident['id']} · {classification.replace('_', ' ')} at {node['location']}.",
                                              "warning", node_id)
                    created = True
            return {"accepted": True, "node_id": node_id, "reading": reading,
                    "detection": detection, "confidence": confidence}, created

    def add_node(self, payload: dict[str, Any]) -> dict[str, Any]:
        import re
        node_id = str(payload.get("id", payload.get("node_id", ""))).strip()
        name = str(payload.get("name", payload.get("location", ""))).strip()
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{1,39}", node_id):
            raise ValueError("id must be 2–40 characters using letters, numbers, underscores, or hyphens.")
        if not name or len(name) > 80:
            raise ValueError("name must contain 1–80 characters.")
        raw_sensors = payload.get("sensors", ["mmWave"])
        if isinstance(raw_sensors, str):
            sensors = [item.strip() for item in raw_sensors.split(",") if item.strip()]
        elif isinstance(raw_sensors, list):
            sensors = [str(item).strip() for item in raw_sensors if str(item).strip()]
        else:
            raise ValueError("sensors must be a list or comma-separated string.")
        sensors = list(dict.fromkeys(sensors))
        if not sensors or len(sensors) > 12 or any(len(item) > 60 for item in sensors):
            raise ValueError("Provide between 1 and 12 sensor labels, each no longer than 60 characters.")
        position_values = (payload.get("x", 50), payload.get("y", 50))
        if any(isinstance(value, bool) for value in position_values):
            raise ValueError("x and y positions must be integers from 0 to 100.")
        try:
            x, y = (int(value) for value in position_values)
        except (TypeError, ValueError):
            raise ValueError("x and y positions must be integers from 0 to 100.")
        if any(isinstance(value, float) and value != int(value) for value in position_values):
            raise ValueError("x and y positions must be integers from 0 to 100.")
        if not (0 <= x <= 100 and 0 <= y <= 100):
            raise ValueError("x and y positions must be between 0 and 100.")
        with self.lock:
            if any(node["id"].lower() == node_id.lower() for node in self.nodes):
                raise ValueError("A node with this id already exists.")
            node = {
                "id": node_id, "name": name, "location": name, "status": "offline",
                "battery_pct": 100, "temperature_c": 25.0, "uptime_pct": 0.0,
                "firmware": "unreported", "last_seen": None,
                "position": {"x": x, "y": y}, "sensors": sensors, "readings": [],
                "detections_today": 0, "last_self_test": "Not run",
            }
            self.nodes.append(node)
            self._add_event_unlocked("node_registered", "Node registered",
                                      f"{node_id} · {name} added to the registry; awaiting first sensor heartbeat.",
                                      "info", node_id)
            return copy.deepcopy(node)

    def set_node_status(self, node_id: str, status: str) -> bool:
        with self.lock:
            node = next((item for item in self.nodes if item["id"] == node_id), None)
            if not node:
                return False
            if status not in {"online", "degraded", "offline"}:
                raise ValueError("status must be online, degraded, or offline.")
            node["status"] = status
            if status != "offline":
                node["last_seen"] = utc_now()
            self._add_event_unlocked("node_status", "Node status changed", f"{node_id} · status is now {status}.",
                                      "warning" if status != "online" else "success", node_id)
            return True

    def export_events(self) -> list[dict[str, Any]]:
        with self.lock:
            return copy.deepcopy(self.events)
