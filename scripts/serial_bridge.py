"""Forward newline-delimited, pre-normalised JSON from serial to ABHED.

The upstream device must emit one JSON object per line. This is a generic
transport bridge, not a decoder for any specific sensor protocol.
"""
import argparse
import json
import os
import sys
import time
import requests
from dotenv import load_dotenv

load_dotenv()
import serial


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', required=True, help='Serial port, e.g. COM5 or /dev/ttyACM0')
    parser.add_argument('--baud', type=int, default=115200)
    parser.add_argument('--url', default='http://127.0.0.1:5000', help='ABHED base URL')
    parser.add_argument('--timeout', type=float, default=1.0, help='Serial read timeout in seconds')
    parser.add_argument('--api-key', default=os.getenv('ABHED_INGEST_API_KEY', ''), help='Ingest key')
    args = parser.parse_args()
    if not args.api_key:
        print('Missing API key. Set ABHED_INGEST_API_KEY or pass --api-key.', file=sys.stderr)
        return 2
    endpoint = f'{args.url.rstrip("/")}/api/ingest/sensor'
    print(f'ABHED serial bridge starting: {args.port} @ {args.baud}; endpoint={endpoint}')
    print('Waiting for newline-delimited JSON. Press Ctrl+C to stop.')
    try:
        with serial.Serial(args.port, args.baud, timeout=args.timeout) as port:
            while True:
                raw = port.readline()
                if not raw:
                    continue
                line = raw.decode('utf-8', errors='replace').strip()
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                    if not isinstance(payload, dict):
                        raise ValueError('JSON line must be an object.')
                except (json.JSONDecodeError, ValueError) as exc:
                    print(f'Skipping invalid JSON line: {exc}', file=sys.stderr)
                    continue
                try:
                    response = requests.post(endpoint, json=payload,
                                             headers={'X-API-Key': args.api_key}, timeout=5)
                    print(f'{time.strftime("%H:%M:%S")} HTTP {response.status_code} · {payload.get("node_id", "unknown node")} · {response.text[:180]}')
                    response.raise_for_status()
                except requests.RequestException as exc:
                    print(f'Forwarding failed: {exc}', file=sys.stderr)
    except KeyboardInterrupt:
        print('\nSerial bridge stopped.')
        return 0
    except serial.SerialException as exc:
        print(f'Could not open/read serial port: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
