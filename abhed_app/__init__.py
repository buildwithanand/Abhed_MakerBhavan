"""ABHED field-awareness dashboard application factory."""

import os
from flask import Flask, jsonify, render_template
from dotenv import load_dotenv

from .state import SystemState
from .routes import register_routes
from .simulator import Simulator


def create_app(start_simulator: bool = True, state: SystemState | None = None) -> Flask:
    load_dotenv()
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.config["JSON_SORT_KEYS"] = False
    app.config["INGEST_API_KEY"] = os.getenv("ABHED_INGEST_API_KEY", "replace-this-with-a-long-random-secret")

    if state is None:
        simulation_enabled = os.getenv("ABHED_SIMULATION", "true").lower() in {"1", "true", "yes"}
        site_name = os.getenv("ABHED_SITE_NAME", "ABHED Field Operations")
        try:
            threshold = float(os.getenv("ABHED_DETECTION_THRESHOLD", "0.72"))
        except ValueError:
            threshold = 0.72
        state = SystemState(site_name=site_name, simulation_enabled=simulation_enabled, detection_threshold=threshold)
    app.extensions["abhed_state"] = state

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "abhed-dashboard", "version": "1.0.0"})

    register_routes(app)

    if start_simulator:
        simulator = Simulator(state)
        simulator.start()
        app.extensions["abhed_simulator"] = simulator

    return app
