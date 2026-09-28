#!/usr/bin/env python3
"""
Calendar Launcher
=================
Wrapper and entry point for term_calendar.
"""

import sys
from term_calendar import main

if __name__ == "__main__":
    if any(arg in sys.argv for arg in ("--web", "-w")):
        import serve_web
        serve_web.start_server()
    else:
        main()
