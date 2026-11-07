#!/usr/bin/env python3
"""Optional local launcher: python start.py [port]. No packages required."""
import functools
import http.server
from pathlib import Path
import sys
import webbrowser

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = str(Path(__file__).resolve().parent)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
try:
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
except OSError as error:
    raise SystemExit(f"Could not start on port {port}: {error}. Try: python start.py 8001")
url = f"http://localhost:{port}"
print(f"CuriousStride is ready at {url}\nKeep this window open. Press Ctrl+C to stop.")
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
