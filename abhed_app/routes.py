"""HTTP API routes for the ABHED dashboard."""
from __future__ import annotations

import csv
import io
import hmac
from flask import jsonify, request, current_app, Response


def _state():
    return current_app.extensions["abhed_state"]


def _json_body() -> dict:
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def _spreadsheet_safe(value: str) -> str:
    if value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def register_routes(app) -> None:
    @app.get("/api/snapshot")
    def snapshot():
        return jsonify(_state().snapshot())

    @app.get("/api/nodes")
    def nodes():
        return jsonify(_state().snapshot()["nodes"])

    @app.post("/api/nodes")
    def register_node():
        try:
            node = _state().add_node(_json_body())
            return jsonify({"ok": True, "node": node}), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.get("/api/incidents")
    def incidents():
        status = request.args.get("status", "all").lower()
        if status not in {"all", "active", "acknowledged", "resolved"}:
            return jsonify({"error": "status must be all, active, acknowledged, or resolved."}), 400
        items = _state().snapshot()["incidents"]
        if status != "all":
            items = [item for item in items if item["status"] == status]
        return jsonify(items)

    @app.get("/api/events")
    def events():
        try:
            limit = int(request.args.get("limit", "50"))
        except ValueError:
            return jsonify({"error": "limit must be an integer."}), 400
        if not 1 <= limit <= 300:
            return jsonify({"error": "limit must be between 1 and 300."}), 400
        return jsonify(_state().snapshot()["events"][:limit])

    @app.get("/api/config")
    def get_config():
        return jsonify(_state().snapshot()["config"])

    @app.put("/api/config")
    def update_config():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Request body must be a JSON object."}), 400
        try:
            config = _state().update_config(body)
            return jsonify({"ok": True, "config": config})
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.post("/api/incidents/<incident_id>/acknowledge")
    def acknowledge(incident_id: str):
        body = request.get_json(silent=True) if request.data else {}
        if not isinstance(body, dict):
            return jsonify({"error": "Request body must be a JSON object."}), 400
        operator = body.get("operator", "Duty operator")
        if not isinstance(operator, str) or not operator.strip() or len(operator.strip()) > 80:
            return jsonify({"error": "operator must contain 1–80 characters."}), 400
        try:
            result = _state().acknowledge_incident(incident_id, operator.strip())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 409
        if result is None:
            return jsonify({"error": "Incident not found."}), 404
        return jsonify({"ok": True, "incident": result})

    @app.post("/api/incidents/<incident_id>/resolve")
    def resolve(incident_id: str):
        body = request.get_json(silent=True) if request.data else {}
        if not isinstance(body, dict):
            return jsonify({"error": "Request body must be a JSON object."}), 400
        operator = body.get("operator", "Duty operator")
        note = body.get("note", "")
        if not isinstance(operator, str) or not operator.strip() or len(operator.strip()) > 80:
            return jsonify({"error": "operator must contain 1–80 characters."}), 400
        if not isinstance(note, str):
            return jsonify({"error": "note must be a string."}), 400
        try:
            result = _state().resolve_incident(incident_id,
                                               operator.strip(),
                                               note)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 409
        if result is None:
            return jsonify({"error": "Incident not found."}), 404
        return jsonify({"ok": True, "incident": result})

    @app.post("/api/nodes/<node_id>/self-test")
    def self_test(node_id: str):
        result = _state().self_test(node_id)
        if result is None:
            return jsonify({"error": "Node not found."}), 404
        return jsonify({"ok": True, "node": result, "message": "Software-level connectivity check completed."})

    @app.post("/api/nodes/<node_id>/status")
    def node_status(node_id: str):
        try:
            ok = _state().set_node_status(node_id, str(_json_body().get("status", "")))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        if not ok:
            return jsonify({"error": "Node not found."}), 404
        return jsonify({"ok": True})

    @app.post("/api/ingest/sensor")
    def ingest_sensor():
        expected_key = str(current_app.config.get("INGEST_API_KEY", ""))
        supplied_key = request.headers.get("X-API-Key", "")
        if not expected_key or expected_key == "replace-this-with-a-long-random-secret":
            return jsonify({"error": "Configure ABHED_INGEST_API_KEY in .env before accepting sensor ingestion."}), 503
        if not hmac.compare_digest(supplied_key, expected_key):
            return jsonify({"error": "Unauthorised. Provide the configured X-API-Key header."}), 401
        try:
            result, incident_created = _state().ingest(_json_body())
        except KeyError as exc:
            return jsonify({"error": str(exc).strip("'")}), 404
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        result["incident_created"] = incident_created
        return jsonify(result), 201

    @app.get("/api/export/events.csv")
    def export_events():
        rows = _state().export_events()
        buffer = io.StringIO()
        fields = ["id", "timestamp", "type", "severity", "source", "title", "message"]
        writer = csv.DictWriter(buffer, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({
            field: _spreadsheet_safe(str(row.get(field, "")))
            for field in fields
        } for row in rows)
        return Response(buffer.getvalue(), mimetype="text/csv",
                        headers={"Content-Disposition": "attachment; filename=abhed-events.csv"})
