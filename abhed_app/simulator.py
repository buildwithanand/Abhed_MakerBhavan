"""Deterministic-enough demo telemetry generator; never a substitute for field data."""
from __future__ import annotations

import random
import threading

from .state import SystemState, utc_now


class Simulator:
    def __init__(self, state: SystemState, interval: float = 3.5):
        self.state = state
        self.interval = max(0.05, float(interval))
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._paused = False

    def set_interval(self, interval: float) -> float:
        if interval <= 0:
            raise ValueError("interval must be greater than zero.")
        self.interval = max(0.05, float(interval))
        return self.interval

    def pause(self) -> None:
        self._paused = True

    def resume(self) -> None:
        self._paused = False

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._paused = False
        self._thread = threading.Thread(target=self._run, name="abhed-demo-simulator", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._paused = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def _run(self) -> None:
        tick = 0
        while not self._stop.wait(self.interval):
            if self._paused:
                continue
            if not self.state.simulation_enabled:
                continue
            tick += 1
            with self.state.lock:
                for node in self.state.nodes:
                    if node["status"] == "offline":
                        continue
                    node["last_seen"] = utc_now()
                    node["temperature_c"] = round(max(22.0, min(49.0, node["temperature_c"] + random.uniform(-0.25, 0.25))), 1)
                    if node["battery_pct"] > 20 and random.random() < 0.08:
                        node["battery_pct"] = max(20, node["battery_pct"] - 1)
                    for reading in node["readings"]:
                        if reading["metric"] == "surface_temperature":
                            reading["value"] = round(31.2 + random.uniform(-1.3, 1.3), 1)
                        elif reading["metric"] == "range":
                            reading["value"] = round(max(0.2, 5.5 + random.uniform(-1.9, 1.9)), 2)
                        elif reading["metric"] == "sound_level":
                            reading["value"] = round(37 + random.uniform(-5, 7), 1)
                        elif reading["metric"] == "vibration_rms":
                            reading["value"] = round(max(0.001, 0.018 + random.uniform(-0.009, 0.014)), 3)
                        reading["updated_at"] = utc_now()
                reporting_nodes = [node for node in self.state.nodes if node["status"] != "offline"]
                if tick % 8 == 0 and reporting_nodes:
                    node = random.choice(reporting_nodes)
                    reading = random.choice(node["readings"])
                    self.state._add_event_unlocked(
                        "sensor_reading", "Telemetry heartbeat",
                        f"{node['id']} · {reading['sensor']} refreshed. Demo telemetry only.", "info", node["id"])
                online_nodes = [node for node in self.state.nodes if node["status"] == "online"]
                if tick % 13 == 0 and online_nodes and random.random() < 0.30:
                    node = random.choice(online_nodes)
                    exists = any(i["node_id"] == node["id"] and i["status"] in {"active", "acknowledged"}
                                 for i in self.state.incidents)
                    if not exists:
                        p = node["position"]
                        incident = self.state._new_incident(node["id"], node["location"], "unclassified_movement",
                                                            "medium", round(random.uniform(0.73, 0.86), 2),
                                                            "Simulator · sensor correlation", p["x"], p["y"])
                        incident["notes"] = "Simulated candidate. Verify independently; this is not a real-world alert."
                        self.state.incidents.insert(0, incident)
                        self.state._add_event_unlocked("incident_opened", "New demo incident candidate",
                                                        f"{incident['id']} · {node['location']} · simulated event.",
                                                        "warning", node["id"])
