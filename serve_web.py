#!/usr/bin/env python3
"""
Web Server Launcher for Calendar
================================
Starts a lightweight local HTTP server and automatically opens
the modern Web Edition of Calendar in the default browser.

Zero dependencies required — uses only Python standard library.
"""

import http.server
import os
import socket
import socketserver
import sys
import threading
import time
import webbrowser
from typing import Optional


def find_free_port(start_port: int = 8000, max_attempts: int = 50) -> int:
    """Find an available port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start_port


class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Simple HTTP request handler with clean logging."""

    def log_message(self, format: str, *args) -> None:
        # Suppress noisy standard asset requests in console
        if any(code in args for code in ("200", "304")):
            return
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")


def start_server(port: Optional[int] = None, open_browser: bool = True) -> None:
    """Launch local web server for the calendar web app."""
    # Ensure current directory is the script root directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    chosen_port = port or find_free_port(8000)
    url = f"http://127.0.0.1:{chosen_port}"

    banner = f"""
╭────────────────────────────────────────────────────────────╮
│                    CALENDAR — WEB EDITION                  │
│                                                            │
│  ✨ Server URL: \033[1;36m{url:<41}\033[0m  │
│  📁 Root Dir:   \033[90m{base_dir[:41]:<41}\033[0m  │
│                                                            │
│  Opening browser automatically...                          │
│  Press Ctrl+C to shut down the server                      │
╰────────────────────────────────────────────────────────────╯
"""
    print(banner)

    if open_browser:
        def _open():
            time.sleep(0.5)
            webbrowser.open(url)
        threading.Thread(target=_open, daemon=True).start()

    # Reuse address to prevent TIME_WAIT port lockups
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("127.0.0.1", chosen_port), QuietHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Server gracefully stopped.")


if __name__ == "__main__":
    start_server()
