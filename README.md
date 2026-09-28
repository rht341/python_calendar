# Calendar (Python)

A modern, beautifully formatted calendar application for the web written in Python. It supports flexible month and year inputs, customizable themes, ANSI colors, weekend highlighting, current date indicator, and responsive multi-column layouts.

---

## ✨ Features

- **Flexible Input Formats**:
  - **Single month**: By number (`5`), 3-letter abbreviation (`May`, `oct`), or full name (`September`).
  - **Month ranges**: Numeric (`3-8`, `3..8`, `3 to 8`), by name (`March-August`, `Mar to Aug`), or comma-separated lists (`1, 3, 5` or `1-3, 7-9`).
  - **Full year**: `all`, `*`, `1-12`, or simply passing the 4-digit year.
  - **Wrap-around ranges**: Cross-year ranges like `11-2` or `Nov to Feb`.
- **Responsive Multi-Column Display**:
  - Automatically calculates how many calendar columns fit your terminal width (`1` to `4` columns).
  - Can be manually controlled with `-c` or `--columns`.
  - All month cards in the same row align with identical vertical height and clear spacing.
- **Visual Styling & Highlighting**:
  - **Today Highlight**: Current date highlighted with a distinct background badge.
  - **Weekend Highlight**: Saturday and Sunday marked with subtle accent colors.
  - **Border Styles**: Choose from `rounded` (default), `double`, `heavy`, `simple`, `ascii`, or `clean`.
- **First Day of the Week**:
  - Starts on **Monday** by default (ISO standard).
  - Easily switch to **Sunday** first with `-s` / `--sunday`.
- **Zero External Dependencies**:
  - Pure Python standard library (`calendar`, `datetime`, `re`, `shutil`, `argparse`).
  - Runs out-of-the-box on Python 3.8+.
- **Interactive Mode**:
  - Simply run `python calendar_app.py` without arguments for an interactive guide.
- **🌐 Web Edition (New)**:
  - Gorgeous modern web interface with dual views: Interactive Grid & Terminal CRT box preview.
  - Interactive CLI command bar with instant parsing and generator.
  - 5 themes: Cyber Neon, Nord Frost, Retro Matrix, Tokyo Night, and Daylight Clean.
  - Date statistics inspector and persistent day notes/reminders.
  - Export to raw Unicode text, .txt download, and print.

---

## 🚀 Quick Start

### 1. Launch Web Edition
Start the web interface with automatic browser launch:
```bash
python calendar_app.py --web
# or
python serve_web.py
```
Or simply open `index.html` in any browser!

### 2. Interactive Terminal Mode
Run the calendar without arguments to launch the interactive prompt:
```bash
python calendar_app.py
```
Or explicitly:
```bash
python calendar_app.py -i
```

### 2. View a Single Month
```bash
# Month number and year
python calendar_app.py 2026 5

# Month name and year
python calendar_app.py 2026 October
python calendar_app.py May 2026

# Using flags
python calendar_app.py -y 2026 -m 10
```

### 3. View a Range of Months
```bash
# Numeric range
python calendar_app.py 2026 3-8

# Word range
python calendar_app.py 2026 "March to August"
python calendar_app.py 2026 Mar-Aug

# Comma-separated list
python calendar_app.py 2026 "1, 4, 7, 10"

# Using flags
python calendar_app.py -y 2026 -m 3-8
```

### 4. View a Full Year
```bash
python calendar_app.py 2026
python calendar_app.py 2026 all
python calendar_app.py -y 2026 -m 1-12
```

---

## 🎨 Customization & Options

| Option | Flag | Description | Default |
|---|---|---|---|
| **Year** | `-y`, `--year` | Year to display (1–9999) | Current year |
| **Month** | `-m`, `--month` | Month or month range | Current month |
| **Columns** | `-c`, `--columns` | Number of columns per row | Auto (terminal width) |
| **Style** | `--style` | Border style (`rounded`, `double`, `heavy`, `simple`, `ascii`, `clean`) | `rounded` |
| **Sunday First** | `-s`, `--sunday` | Start week on Sunday instead of Monday | Monday |
| **No Color** | `--no-color` | Disable ANSI color sequences | Enabled |
| **Interactive** | `-i`, `--interactive` | Prompt interactively for inputs | If no args |

### Border Styles Example:

#### Rounded (`--style rounded`):
```text
╭──────────────────────╮
│     October 2026     │
├──────────────────────┤
│ Mo Tu We Th Fr Sa Su │
│           1  2  3  4 │
│  5  6  7  8  9 10 11 │
│ 12 13 14 15 16 17 18 │
│ 19 20 21 22 23 24 25 │
│ 26 27 28 29 30 31    │
╰──────────────────────╯
```

#### Double (`--style double`):
```text
╔══════════════════════╗
║     October 2026     ║
╠══════════════════════╣
║ Mo Tu We Th Fr Sa Su ║
║           1  2  3  4 ║
║  5  6  7  8  9 10 11 ║
║ 12 13 14 15 16 17 18 ║
║ 19 20 21 22 23 24 25 ║
║ 26 27 28 29 30 31    ║
╚══════════════════════╝
```

#### ASCII (`--style ascii`):
```text
+----------------------+
|     October 2026     |
+----------------------+
| Mo Tu We Th Fr Sa Su |
|           1  2  3  4 |
|  5  6  7  8  9 10 11 |
| 12 13 14 15 16 17 18 |
| 19 20 21 22 23 24 25 |
| 26 27 28 29 30 31    |
+----------------------+
```

---

## 🧪 Running Tests

To run the unit test suite:
```bash
python -m unittest test_term_calendar.py
```
or
```bash
python test_term_calendar.py
```
