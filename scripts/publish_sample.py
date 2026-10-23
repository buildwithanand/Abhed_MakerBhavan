"""Send one normalised sample reading to a running ABHED instance."""
import argparse
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5000', help='ABHED base URL')
    parser.add_argument('--node', default='ABH-N01', help='Registered node ID')
    parser.add_argument('--sensor', default='mmWave', help='Sensor type label')
    parser.add_argument('--metric', default='range', help='Metric label')
    parser.add_argument('--value', type=float, default=5.4, help='Numeric sample value')
    parser.add_argument('--unit', default='m', help='Unit label')
    parser.add_argument('--detection', action='store_true', help='Mark this as a detection candidate')
    parser.add_argument('--confidence', type=float, default=0.0, help='Candidate confidence in [0,1]')
    parser.add_argument('--api-key', default=os.getenv('ABHED_INGEST_API_KEY', ''), help='Ingest key (or set environment variable)')
    args = parser.parse_args()
    if not args.api_key:
        print('Missing API key. Set ABHED_INGEST_API_KEY or pass --api-key.', file=sys.stderr)
        return 2
    payload = {
        'node_id': args.node, 'sensor_type': args.sensor, 'metric': args.metric,
        'value': args.value, 'unit': args.unit,
        'event_type': 'detection' if args.detection else 'telemetry',
        'detection': args.detection, 'confidence': args.confidence,
        'classification': 'unclassified_movement', 'note': 'sample publisher test payload',
    }
    try:
        response = requests.post(f'{args.url.rstrip("/")}/api/ingest/sensor', json=payload,
                                 headers={'X-API-Key': args.api_key}, timeout=5)
        print(f'HTTP {response.status_code}')
        print(response.text)
        return 0 if response.ok else 1
    except requests.RequestException as exc:
        print(f'Could not reach ABHED: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
