"""Local entry point for the ABHED dashboard."""
import os
from dotenv import load_dotenv

load_dotenv()

from abhed_app import create_app  # noqa: E402

app = create_app(start_simulator=True)

if __name__ == "__main__":
    host = os.getenv("ABHED_HOST", "127.0.0.1")
    port = int(os.getenv("ABHED_PORT", "5000"))
    debug = os.getenv("ABHED_DEBUG", "false").lower() in {"1", "true", "yes"}
    # The built-in server is intended for local development and controlled demos.
    app.run(host=host, port=port, debug=debug, threaded=True, use_reloader=False)
