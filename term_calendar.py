#!/usr/bin/env python3
"""
Calendar Application
====================
Displays beautifully formatted calendars in the terminal with customizable
border styles, ANSI colors, weekend highlighting, today highlighting, and
multi-column grid layouts for single or multiple months.

Supports flexible inputs for year and month / month ranges (names, abbreviations, numbers, ranges).
"""

from __future__ import annotations

import calendar
import datetime
import os
import re
import shutil
import sys
from typing import List, Optional, Tuple, Dict, Any

# Regular expression to strip ANSI escape codes when computing visual string length
ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")


def strip_ansi(text: str) -> str:
    """Return text without ANSI escape sequences."""
    return ANSI_ESCAPE_RE.sub("", text)


def visible_len(text: str) -> int:
    """Return visual width of text, ignoring ANSI escape sequences."""
    return len(strip_ansi(text))


def pad_ansi(text: str, width: int, align: str = "left") -> str:
    """
    Pad a string containing ANSI escape codes to a target visual width.
    align: 'left', 'right', or 'center'
    """
    vlen = visible_len(text)
    pad = max(0, width - vlen)
    if align == "right":
        return " " * pad + text
    elif align == "center":
        left_pad = pad // 2
        right_pad = pad - left_pad
        return " " * left_pad + text + " " * right_pad
    else:  # left
        return text + " " * pad


class Colors:
    """ANSI color code definitions."""
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    ITALIC = "\033[3m"
    UNDERLINE = "\033[4m"
    REVERSE = "\033[7m"

    # Text Colors
    BLACK = "\033[30m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"
    BRIGHT_BLACK = "\033[90m"
    BRIGHT_RED = "\033[91m"
    BRIGHT_GREEN = "\033[92m"
    BRIGHT_YELLOW = "\033[93m"
    BRIGHT_BLUE = "\033[94m"
    BRIGHT_MAGENTA = "\033[95m"
    BRIGHT_CYAN = "\033[96m"
    BRIGHT_WHITE = "\033[97m"

    # Background Colors
    BG_BLACK = "\033[40m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"
    BG_BLUE = "\033[44m"
    BG_MAGENTA = "\033[45m"
    BG_CYAN = "\033[46m"
    BG_WHITE = "\033[47m"
    BG_BRIGHT_BLUE = "\033[104m"
    BG_BRIGHT_MAGENTA = "\033[105m"


class ColorTheme:
    """Color configuration for calendar components."""

    def __init__(self, enabled: bool = True):
        self.enabled = enabled

    def _apply(self, code: str, text: str) -> str:
        if not self.enabled:
            return text
        return f"{code}{text}{Colors.RESET}"

    def border(self, text: str) -> str:
        return self._apply(Colors.BRIGHT_BLACK, text)

    def month_title(self, text: str) -> str:
        return self._apply(Colors.BOLD + Colors.BRIGHT_YELLOW, text)

    def year_title(self, text: str) -> str:
        return self._apply(Colors.BOLD + Colors.BRIGHT_CYAN, text)

    def weekday_header(self, text: str) -> str:
        return self._apply(Colors.BOLD + Colors.BRIGHT_WHITE, text)

    def weekday_weekend_header(self, text: str) -> str:
        return self._apply(Colors.BOLD + Colors.BRIGHT_MAGENTA, text)

    def normal_day(self, text: str) -> str:
        return self._apply(Colors.WHITE, text)

    def weekend_day(self, text: str) -> str:
        return self._apply(Colors.CYAN, text)

    def today(self, text: str) -> str:
        # High visibility highlight for current date
        return self._apply(Colors.BOLD + Colors.BG_BRIGHT_BLUE + Colors.BRIGHT_WHITE, text)

    def info(self, text: str) -> str:
        return self._apply(Colors.CYAN, text)

    def error(self, text: str) -> str:
        return self._apply(Colors.BOLD + Colors.RED, text)

    def prompt(self, text: str) -> str:
        return self._apply(Colors.BOLD + Colors.BRIGHT_GREEN, text)


# Predefined border styles for calendar boxes
BOX_STYLES: Dict[str, Dict[str, str]] = {
    "rounded": {
        "tl": "╭", "tr": "╮", "bl": "╰", "br": "╯",
        "h": "─", "v": "│", "sep_l": "├", "sep_r": "┤", "sep_h": "─"
    },
    "double": {
        "tl": "╔", "tr": "╗", "bl": "╚", "br": "╝",
        "h": "═", "v": "║", "sep_l": "╠", "sep_r": "╣", "sep_h": "═"
    },
    "heavy": {
        "tl": "┏", "tr": "┓", "bl": "┗", "br": "┛",
        "h": "━", "v": "┃", "sep_l": "┣", "sep_r": "┫", "sep_h": "━"
    },
    "simple": {
        "tl": "┌", "tr": "┐", "bl": "└", "br": "┘",
        "h": "─", "v": "│", "sep_l": "├", "sep_r": "┤", "sep_h": "─"
    },
    "ascii": {
        "tl": "+", "tr": "+", "bl": "+", "br": "+",
        "h": "-", "v": "|", "sep_l": "+", "sep_r": "+", "sep_h": "-"
    },
    "clean": {
        "tl": " ", "tr": " ", "bl": " ", "br": " ",
        "h": " ", "v": " ", "sep_l": " ", "sep_r": " ", "sep_h": " "
    }
}

# Month names mapping (both full name and 3-char abbreviations)
MONTH_NAMES = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12
}


def parse_month(val: str) -> int:
    """
    Parse a single month string to an integer from 1 to 12.
    Accepts: '1'-'12', '01'-'09', or month names/abbreviations ('Jan', 'January', etc.).
    """
    s = val.strip().lower()
    if not s:
        raise ValueError("Month cannot be empty.")
    
    if s.isdigit():
        num = int(s)
        if 1 <= num <= 12:
            return num
        raise ValueError(f"Month number must be between 1 and 12 (got {num}).")
    
    if s in MONTH_NAMES:
        return MONTH_NAMES[s]
    
    # Try prefix matching for length >= 3
    for name, num in MONTH_NAMES.items():
        if len(s) >= 3 and name.startswith(s):
            return num
            
    raise ValueError(f"Unrecognized month '{val}'. Use 1-12, 'Jan'-'Dec', or full month names.")


def _dedupe_preserve_order(items: List[int]) -> List[int]:
    """Remove duplicate months while preserving the original order."""
    seen = set()
    unique: List[int] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def _split_month_range(value: str) -> Optional[Tuple[str, str]]:
    """Return a normalized month range as (start, end) if a range delimiter is found."""
    delimiters = ["..", " through ", " thru ", " to ", "—", "–", "-"]
    for delim in delimiters:
        if delim in value:
            left, right = value.split(delim, 1)
            left = left.strip()
            right = right.strip()
            if left and right:
                return left, right
    return None


def parse_month_range(val: str) -> List[int]:
    """
    Parse a month specification string into a list of month integers (1-12).

    Supports:
    - Single month: "5", "May", "mar"
    - Ranges: "3-8", "3..8", "3 to 8", "March-August", "Jan to Mar"
    - Comma-separated: "1, 3, 5" or "1-3, 7-9"
    - Keywords: "all", "*", "year", "1-12"
    - Wrap-around ranges: "11-2" -> [11, 12, 1, 2]
    """
    s = val.strip().lower()
    if not s:
        raise ValueError("Month input cannot be empty.")

    if s in ("all", "*", "year", "full"):
        return list(range(1, 13))

    if "," in s:
        months: List[int] = []
        for part in s.split(","):
            part = part.strip()
            if part:
                months.extend(parse_month_range(part))
        return _dedupe_preserve_order(months)

    range_match = _split_month_range(s)
    if range_match is not None:
        start_text, end_text = range_match
        m_start = parse_month(start_text)
        m_end = parse_month(end_text)
        if m_start <= m_end:
            return list(range(m_start, m_end + 1))
        return list(range(m_start, 13)) + list(range(1, m_end + 1))

    return [parse_month(s)]


def parse_year(val: str) -> int:
    """Parse and validate year string."""
    s = val.strip()
    if not s:
        raise ValueError("Year cannot be empty.")
    try:
        y = int(s)
        if 1 <= y <= 9999:
            return y
        raise ValueError(f"Year must be between 1 and 9999 (got {y}).")
    except ValueError as e:
        if "Year must be" in str(e):
            raise
        raise ValueError(f"Invalid year '{val}'. Must be an integer between 1 and 9999.")


class TerminalCalendar:
    """
    Renders calendars in terminal with custom styling, box drawing, and color themes.
    """

    def __init__(
        self,
        style: str = "rounded",
        first_day: int = calendar.MONDAY,
        theme: Optional[ColorTheme] = None,
        inner_width: int = 22,
    ):
        """
        first_day: calendar.MONDAY (0) or calendar.SUNDAY (6)
        style: one of 'rounded', 'double', 'heavy', 'simple', 'ascii', 'clean'
        """
        self.style_name = style.lower() if style.lower() in BOX_STYLES else "rounded"
        self.box = BOX_STYLES[self.style_name]
        self.first_day = first_day
        self.theme = theme or ColorTheme(enabled=True)
        self.inner_width = inner_width  # 22 chars fits standard 20 chars of days + 1 space padding on each side
        self.cal = calendar.Calendar(firstweekday=self.first_day)

    def _get_weekday_headers(self) -> Tuple[List[str], List[bool]]:
        """
        Return list of 2-letter weekday names and boolean list indicating if each is a weekend day.
        """
        # Day names standard abbreviations
        day_names = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
        # Rotate based on first_day
        rotated_days = [day_names[(self.first_day + i) % 7] for i in range(7)]
        # Saturday and Sunday indices
        is_weekend = [((self.first_day + i) % 7) in (5, 6) for i in range(7)]
        return rotated_days, is_weekend

    def render_month_box(
        self,
        year: int,
        month: int,
        today: Optional[datetime.date] = None
    ) -> List[str]:
        """
        Render a single month box into a list of formatted lines.
        Every rendered month is guaranteed to have the exact same height (10 or 11 lines)
        so they align horizontally when displayed side-by-side.
        """
        if today is None:
            today = datetime.date.today()

        lines: List[str] = []
        b = self.box
        w = self.inner_width

        # Top border
        top_border = self.theme.border(b["tl"] + b["h"] * w + b["tr"])
        lines.append(top_border)

        # Header: Month and Year (e.g., "October 2026")
        month_name = calendar.month_name[month]
        title_raw = f"{month_name} {year}"
        styled_title = f"{self.theme.month_title(month_name)} {self.theme.year_title(str(year))}"
        padded_title = pad_ansi(styled_title, w, align="center")
        lines.append(self.theme.border(b["v"]) + padded_title + self.theme.border(b["v"]))

        # Separator below title
        sep_line = self.theme.border(b["sep_l"] + b["sep_h"] * w + b["sep_r"])
        lines.append(sep_line)

        # Weekday headers (e.g. "Mo Tu We Th Fr Sa Su")
        day_headers, is_weekend = self._get_weekday_headers()
        header_tokens = []
        for d_str, is_wk in zip(day_headers, is_weekend):
            if is_wk:
                header_tokens.append(self.theme.weekday_weekend_header(d_str))
            else:
                header_tokens.append(self.theme.weekday_header(d_str))
        header_row = " ".join(header_tokens)
        padded_header = pad_ansi(f" {header_row} ", w, align="center")
        lines.append(self.theme.border(b["v"]) + padded_header + self.theme.border(b["v"]))

        # Calendar weeks
        month_matrix = self.cal.monthdayscalendar(year, month)
        
        # Format weeks (always pad to 6 weeks for uniform box height)
        for week_idx in range(6):
            if week_idx < len(month_matrix):
                week = month_matrix[week_idx]
                day_tokens = []
                for col_idx, day_num in enumerate(week):
                    if day_num == 0:
                        day_tokens.append("  ")
                    else:
                        day_str = f"{day_num:2d}"
                        if (
                            today.year == year
                            and today.month == month
                            and today.day == day_num
                        ):
                            day_tokens.append(self.theme.today(day_str))
                        elif is_weekend[col_idx]:
                            day_tokens.append(self.theme.weekend_day(day_str))
                        else:
                            day_tokens.append(self.theme.normal_day(day_str))
                week_str = " ".join(day_tokens)
                padded_week = pad_ansi(f" {week_str} ", w, align="left")
                lines.append(self.theme.border(b["v"]) + padded_week + self.theme.border(b["v"]))
            else:
                # Blank week row for alignment
                blank_row = " " * w
                lines.append(self.theme.border(b["v"]) + blank_row + self.theme.border(b["v"]))

        # Bottom border
        bottom_border = self.theme.border(b["bl"] + b["h"] * w + b["br"])
        lines.append(bottom_border)

        return lines

    def render_months(
        self,
        year: int,
        months: List[int],
        columns: Optional[int] = None,
        term_width: Optional[int] = None,
        today: Optional[datetime.date] = None
    ) -> str:
        """
        Render multiple months arranged in a grid with the specified number of columns.
        If columns is None, it is automatically computed based on the terminal width.
        """
        if not months:
            return ""

        # Box width = inner_width + 2 border chars
        box_width = self.inner_width + 2
        col_spacing = 2  # Space between adjacent month boxes

        # Determine terminal width
        if term_width is None:
            try:
                term_width = shutil.get_terminal_size(fallback=(80, 24)).columns
            except Exception:
                term_width = 80

        # Auto-detect column count if not specified
        if columns is None or columns <= 0:
            # How many boxes fit in term_width?
            # n * box_width + (n - 1) * col_spacing <= term_width
            # n * (box_width + col_spacing) - col_spacing <= term_width
            max_cols = (term_width + col_spacing) // (box_width + col_spacing)
            columns = max(1, min(len(months), max_cols))
            # Cap at 4 columns for readability
            columns = min(columns, 4)

        output_rows: List[str] = []

        # Split months into rows of `columns`
        for i in range(0, len(months), columns):
            row_months = months[i : i + columns]
            # Render each month box in this row
            rendered_boxes = [
                self.render_month_box(year, m, today=today) for m in row_months
            ]

            # All boxes in this row have the exact same number of lines
            num_lines = len(rendered_boxes[0])
            for line_idx in range(num_lines):
                row_line = (" " * col_spacing).join(
                    box[line_idx] for box in rendered_boxes
                )
                output_rows.append(row_line)

            # Add an empty line between rows of month boxes
            if i + columns < len(months):
                output_rows.append("")

        return "\n".join(output_rows)


def detect_color_support() -> bool:
    """Detect whether the current terminal supports ANSI colors."""
    if "NO_COLOR" in os.environ:
        return False
    if os.environ.get("TERM") == "dumb":
        return False

    # Check if stdout is an interactive tty or Windows Terminal
    if not hasattr(sys.stdout, "isatty") or not sys.stdout.isatty():
        # Allow override if CLICOLOR_FORCE is set
        return os.environ.get("CLICOLOR_FORCE", "0") != "0"

    return True
def configure_console_output() -> None:
    """Ensure standard output and error support UTF-8 encoding and ANSI processing."""
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            # STD_OUTPUT_HANDLE = -11
            handle = kernel32.GetStdHandle(-11)
            mode = ctypes.c_ulong()
            if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
                # ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
                kernel32.SetConsoleMode(handle, mode.value | 0x0004)
        except Exception:
            # Fallback for Windows consoles: running empty cmd activates ANSI in some versions
            os.system("")


def interactive_prompt() -> Tuple[int, List[int]]:
    """
    Run an interactive prompt to solicit year and month/month range from the user.
    """
    today = datetime.date.today()
    theme = ColorTheme(enabled=detect_color_support())

    print()
    banner_bar = "═" * 50
    print(theme.month_title(banner_bar))
    print(theme.month_title("              📅  CALENDAR EXPLORER  📅             "))
    print(theme.month_title(banner_bar))
    print(theme.info("Easily view single months, month ranges, or full years."))
    print()

    # 1. Solicit Year
    while True:
        year_prompt = f"Enter year [default: {today.year}]: "
        try:
            val = input(theme.prompt(year_prompt)).strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting.")
            sys.exit(0)

        if not val:
            year = today.year
            break
        try:
            year = parse_year(val)
            break
        except ValueError as e:
            print(theme.error(f"  Error: {e}"))

    # 2. Solicit Month or Month Range
    current_month_name = calendar.month_name[today.month]
    print()
    print(theme.info("Month formats supported:"))
    print(theme.border("  • Single month : 5, May, October, 12"))
    print(theme.border("  • Month range  : 3-8, Mar-Aug, March to August, 9..12"))
    print(theme.border("  • Multiple     : 1, 3, 5 or 1-3, 7-9"))
    print(theme.border("  • Full year    : all, *, 1-12"))
    print()

    while True:
        month_prompt = f"Enter month or range [default: {current_month_name} ({today.month})]: "
        try:
            val = input(theme.prompt(month_prompt)).strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting.")
            sys.exit(0)

        if not val:
            months = [today.month]
            break
        try:
            months = parse_month_range(val)
            break
        except ValueError as e:
            print(theme.error(f"  Error: {e}"))

    return year, months


def build_arg_parser() -> Any:
    """Build command line argument parser."""
    import argparse
    parser = argparse.ArgumentParser(
        description="Display a beautifully formatted terminal calendar with multi-column layout, box styling, and colors.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode:
  python term_calendar.py

  # Single month:
  python term_calendar.py 2026 5
  python term_calendar.py 2026 October
  python term_calendar.py -y 2026 -m May

  # Range of months:
  python term_calendar.py 2026 3-8
  python term_calendar.py 2026 March-August
  python term_calendar.py 2026 "3 to 8"
  python term_calendar.py -y 2026 -m 1-6

  # Full year:
  python term_calendar.py 2026 all
  python term_calendar.py -y 2026 -m 1-12

  # Custom styling and Sunday-first weeks:
  python term_calendar.py 2026 1-4 --style double --sunday --columns 2
  python term_calendar.py 2026 5 --style ascii --no-color
"""
    )

    # Positional inputs (optional)
    parser.add_argument(
        "inputs",
        nargs="*",
        help="Positional inputs: [year month] or [month year] or [year] (e.g. '2026 5', '2026 3-8', 'October 2026')."
    )

    # Explicit flags
    parser.add_argument(
        "-y", "--year",
        dest="year",
        type=str,
        default=None,
        help="Year to display (1-9999, default: current year)."
    )
    parser.add_argument(
        "-m", "--month",
        dest="month",
        type=str,
        default=None,
        help="Month or range of months (e.g. 5, 3-8, May, Mar-Aug, all)."
    )
    parser.add_argument(
        "-c", "--columns",
        dest="columns",
        type=int,
        default=None,
        help="Number of calendar columns per row (default: auto-detected based on terminal width)."
    )
    parser.add_argument(
        "--style",
        dest="style",
        choices=["rounded", "double", "heavy", "simple", "ascii", "clean"],
        default="rounded",
        help="Border style for calendar cards (default: rounded)."
    )
    parser.add_argument(
        "-s", "--sunday",
        dest="sunday",
        action="store_true",
        help="Start week on Sunday instead of Monday."
    )
    parser.add_argument(
        "--no-color",
        dest="no_color",
        action="store_true",
        help="Disable ANSI color output."
    )
    parser.add_argument(
        "-i", "--interactive",
        dest="interactive",
        action="store_true",
        help="Run in interactive prompt mode."
    )

    return parser


def _is_likely_year(token: str) -> bool:
    """Return True when the token likely represents a year instead of a month."""
    token_strip = token.strip()
    if token_strip.isdigit():
        val = int(token_strip)
        return val > 12 or len(token_strip) == 4
    return False


def build_runtime_options(args: Any) -> Dict[str, Any]:
    """Package CLI options into a single runtime config dictionary."""
    return {
        "style": args.style,
        "first_day": calendar.SUNDAY if args.sunday else calendar.MONDAY,
        "columns": args.columns,
        "no_color": args.no_color,
    }


def parse_cli_args(args: Any) -> Tuple[int, List[int], Dict[str, Any]]:
    """
    Resolve year, months, and render options from parsed CLI arguments.
    """
    today = datetime.date.today()
    year: Optional[int] = None
    months: Optional[List[int]] = None

    # Check explicit flags first
    if args.year is not None:
        year = parse_year(args.year)

    if args.month is not None:
        months = parse_month_range(args.month)

    # Process positional inputs if flags weren't fully provided
    positional = list(args.inputs)
    if positional:
        if len(positional) >= 2:
            arg1, arg2 = positional[0], positional[1]

            if _is_likely_year(arg1) and not _is_likely_year(arg2):
                if year is None:
                    year = parse_year(arg1)
                if months is None:
                    months = parse_month_range(arg2)
            elif _is_likely_year(arg2) and not _is_likely_year(arg1):
                if year is None:
                    year = parse_year(arg2)
                if months is None:
                    months = parse_month_range(arg1)
            else:
                try:
                    y_test = parse_year(arg1)
                    m_test = parse_month_range(arg2)
                    if year is None:
                        year = y_test
                    if months is None:
                        months = m_test
                except Exception:
                    m_test = parse_month_range(arg1)
                    y_test = parse_year(arg2)
                    if year is None:
                        year = y_test
                    if months is None:
                        months = m_test

        elif len(positional) == 1:
            arg = positional[0]
            if arg.strip().isdigit() and (len(arg.strip()) == 4 or int(arg.strip()) > 12):
                if year is None:
                    year = parse_year(arg)
                if months is None:
                    months = list(range(1, 13))
            else:
                try:
                    m_test = parse_month_range(arg)
                    if months is None:
                        months = m_test
                    if year is None:
                        year = today.year
                except Exception:
                    if year is None:
                        year = parse_year(arg)
                    if months is None:
                        months = list(range(1, 13))

    if year is None and months is None:
        if args.interactive or not sys.stdin.isatty():
            year = today.year
            months = [today.month]
        else:
            year, months = interactive_prompt()

    if year is None:
        year = today.year
    if months is None:
        months = [today.month]

    return year, months, build_runtime_options(args)


def main() -> None:
    """Main CLI entry point."""
    configure_console_output()
    parser = build_arg_parser()

    try:
        args = parser.parse_args()
    except KeyboardInterrupt:
        print("\nExiting.", file=sys.stderr)
        sys.exit(130)

    try:
        if args.interactive:
            year, months = interactive_prompt()
            options = build_runtime_options(args)
        else:
            year, months, options = parse_cli_args(args)
    except KeyboardInterrupt:
        print("\nExiting.", file=sys.stderr)
        sys.exit(130)
    except ValueError as err:
        theme = ColorTheme(enabled=not args.no_color and detect_color_support())
        print(theme.error(f"Error: {err}"), file=sys.stderr)
        sys.exit(1)

    # Determine color support
    use_color = not options["no_color"] and detect_color_support()
    theme = ColorTheme(enabled=use_color)

    # Initialize TerminalCalendar
    cal = TerminalCalendar(
        style=options["style"],
        first_day=options["first_day"],
        theme=theme
    )

    # Render and print calendar
    output = cal.render_months(
        year=year,
        months=months,
        columns=options["columns"]
    )

    try:
        print()
        print(output)
        print()
    except BrokenPipeError:
        sys.exit(1)


if __name__ == "__main__":
    main()
