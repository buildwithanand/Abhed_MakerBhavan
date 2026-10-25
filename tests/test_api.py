import csv
import io
import time

import pytest
from abhed_app import create_app
from abhed_app.simulator import Simulator
from abhed_app.state import SystemState


@pytest.fixture()
def client():
    state = SystemState(simulation_enabled=False)
    app = create_app(start_simulator=False, state=state)
    app.config.update(TESTING=True, INGEST_API_KEY='test-secret-key')
    with app.test_client() as test_client:
        yield test_client


def test_health(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json['status'] == 'ok'


def test_snapshot_contains_nodes_and_incidents(client):
    response = client.get('/api/snapshot')
    assert response.status_code == 200
    body = response.json
    assert len(body['nodes']) >= 1
    assert 'overview' in body
    assert 'incidents' in body


@pytest.mark.parametrize('limit', ['0', '301', 'invalid'])
def test_events_rejects_invalid_limit(client, limit):
    response = client.get(f'/api/events?limit={limit}')
    assert response.status_code == 400


def test_csv_export_neutralizes_spreadsheet_formulas(client):
    state = client.application.extensions['abhed_state']
    state.add_event('test', '=1+1', '  @SUM(1,1)', 'info', 'SYS')

    response = client.get('/api/export/events.csv')
    rows = list(csv.DictReader(io.StringIO(response.get_data(as_text=True))))

    assert rows[0]['title'] == "'=1+1"
    assert rows[0]['message'] == "'  @SUM(1,1)"


def test_incident_acknowledge_and_resolve(client):
    active = next(i for i in client.get('/api/incidents').json if i['status'] == 'active')
    acknowledged = client.post(f"/api/incidents/{active['id']}/acknowledge", json={'operator':'Test operator'})
    assert acknowledged.status_code == 200
    assert acknowledged.json['incident']['status'] == 'acknowledged'
    resolved = client.post(f"/api/incidents/{active['id']}/resolve", json={'operator':'Test operator','note':'Validated in test'})
    assert resolved.status_code == 200
    assert resolved.json['incident']['status'] == 'resolved'


def test_incident_transitions_reject_duplicate_actions(client):
    active = next(i for i in client.get('/api/incidents').json if i['status'] == 'active')
    incident_id = active['id']

    assert client.post(f'/api/incidents/{incident_id}/acknowledge').status_code == 200
    duplicate_ack = client.post(f'/api/incidents/{incident_id}/acknowledge')
    assert duplicate_ack.status_code == 409
    assert duplicate_ack.json['error'] == 'Incident has already been acknowledged.'

    assert client.post(f'/api/incidents/{incident_id}/resolve').status_code == 200
    duplicate_resolve = client.post(f'/api/incidents/{incident_id}/resolve')
    assert duplicate_resolve.status_code == 409
    assert duplicate_resolve.json['error'] == 'Incident has already been resolved.'


def test_config_validation(client):
    good = client.put('/api/config', json={'refresh_seconds': 5, 'detection_threshold': 0.8})
    assert good.status_code == 200
    bad = client.put('/api/config', json={'refresh_seconds': 99})
    assert bad.status_code == 400
    invalid_simulation = client.put('/api/config', json={'simulation_enabled': 'false'})
    assert invalid_simulation.status_code == 400


@pytest.mark.parametrize('body', ['not-json', '[]', 'null'])
def test_config_update_requires_json_object(client, body):
    response = client.put('/api/config', data=body, content_type='application/json')
    assert response.status_code == 400
    assert response.json['error'] == 'Request body must be a JSON object.'


@pytest.mark.parametrize('threshold', [float('nan'), float('inf'), float('-inf')])
def test_config_rejects_non_finite_threshold(client, threshold):
    response = client.put('/api/config', json={'detection_threshold': threshold})
    assert response.status_code == 400


def test_config_accepts_boolean_simulation_setting(client):
    response = client.put('/api/config', json={'simulation_enabled': False})
    assert response.status_code == 200
    assert response.json['config']['simulation_enabled'] is False


@pytest.mark.parametrize('refresh_seconds', [2.5, True])
def test_config_rejects_non_integer_refresh_interval(client, refresh_seconds):
    response = client.put('/api/config', json={'refresh_seconds': refresh_seconds})
    assert response.status_code == 400
    assert response.json['error'] == 'refresh_seconds must be an integer.'


def test_invalid_config_update_does_not_partially_apply(client):
    original_config = client.get('/api/config').json
    response = client.put('/api/config', json={
        'site_name': 'Changed site',
        'detection_threshold': 0.9,
        'refresh_seconds': 8,
        'simulation_enabled': 'false',
    })
    assert response.status_code == 400
    assert client.get('/api/config').json == original_config


def test_ingest_requires_api_key(client):
    payload = {'node_id':'ABH-N01','sensor_type':'mmWave','value':5.4,'unit':'m'}
    response = client.post('/api/ingest/sensor', json=payload)
    assert response.status_code == 401


def test_ingest_accepts_valid_payload(client):
    payload = {'node_id':'ABH-N01','sensor_type':'mmWave','metric':'range','value':5.4,
               'unit':'m','event_type':'telemetry','detection':False,'confidence':0.0}
    response = client.post('/api/ingest/sensor', json=payload, headers={'X-API-Key':'test-secret-key'})
    assert response.status_code == 201
    assert response.json['accepted'] is True
    assert response.json['node_id'] == 'ABH-N01'


def test_ingest_requires_boolean_detection_flag(client):
    payload = {'node_id':'ABH-N01','sensor_type':'mmWave','value':5.4,'detection':'false'}
    response = client.post('/api/ingest/sensor', json=payload, headers={'X-API-Key':'test-secret-key'})
    assert response.status_code == 400
    assert response.json['error'] == 'detection must be a boolean.'


@pytest.mark.parametrize('event_type', ['unknown', '', 1, None])
def test_ingest_rejects_unsupported_event_type(client, event_type):
    payload = {'node_id':'ABH-N01','sensor_type':'mmWave','value':5.4,'event_type':event_type}
    response = client.post('/api/ingest/sensor', json=payload, headers={'X-API-Key':'test-secret-key'})
    assert response.status_code == 400
    assert response.json['error'] == 'event_type must be telemetry or detection.'


@pytest.mark.parametrize(('field', 'value'), [
    ('value', float('nan')),
    ('value', float('inf')),
    ('confidence', float('nan')),
    ('confidence', float('inf')),
])
def test_ingest_rejects_non_finite_numbers(client, field, value):
    payload = {'node_id':'ABH-N01','sensor_type':'mmWave','value':5.4,'confidence':0.0}
    payload[field] = value
    response = client.post('/api/ingest/sensor', json=payload, headers={'X-API-Key':'test-secret-key'})
    assert response.status_code == 400


def test_unknown_node_rejected(client):
    payload = {'node_id':'DOES-NOT-EXIST','sensor_type':'mmWave','value':5.4}
    response = client.post('/api/ingest/sensor', json=payload, headers={'X-API-Key':'test-secret-key'})
    assert response.status_code == 404


def test_register_node_and_ingest_first_heartbeat(client):
    created = client.post('/api/nodes', json={'id':'ABH-N07','name':'Western Ridge','sensors':['mmWave','Thermal'],'x':50,'y':40})
    assert created.status_code == 201
    assert created.json['node']['status'] == 'offline'
    payload = {'node_id':'ABH-N07','sensor_type':'mmWave','metric':'range','value':3.2,
               'unit':'m','event_type':'telemetry','detection':False,'confidence':0.0}
    response = client.post('/api/ingest/sensor', json=payload, headers={'X-API-Key':'test-secret-key'})
    assert response.status_code == 201
    node = next(n for n in client.get('/api/nodes').json if n['id'] == 'ABH-N07')
    assert node['status'] == 'online'


def test_duplicate_node_rejected(client):
    created = client.post('/api/nodes', json={'id':'ABH-N01','name':'Duplicate','sensors':['mmWave']})
    assert created.status_code == 400


@pytest.mark.parametrize(('coordinate', 'value'), [('x', 12.7), ('y', True)])
def test_register_node_rejects_non_integer_coordinates(client, coordinate, value):
    payload = {'id':'ABH-N08','name':'Test node','sensors':['mmWave'],coordinate:value}
    response = client.post('/api/nodes', json=payload)
    assert response.status_code == 400
    assert response.json['error'] == 'x and y positions must be integers from 0 to 100.'


def test_simulator_keeps_running_when_all_nodes_are_offline():
    state = SystemState(simulation_enabled=True)
    for node in state.nodes:
        node['status'] = 'offline'

    simulator = Simulator(state, interval=0.001)
    simulator.start()
    try:
        time.sleep(0.05)
        assert simulator._thread is not None
        assert simulator._thread.is_alive()
    finally:
        simulator.stop()
