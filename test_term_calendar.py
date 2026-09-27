#!/usr/bin/env python3
"""
Unit tests for term_calendar.py
"""

import calendar
import datetime
import unittest

from term_calendar import (
    parse_month,
    parse_month_range,
    parse_year,
    strip_ansi,
    visible_len,
    pad_ansi,
    TerminalCalendar,
    ColorTheme,
    BOX_STYLES,
    build_arg_parser,
    parse_cli_args,
)


class TestMonthParser(unittest.TestCase):
    def test_numeric_months(self):
        self.assertEqual(parse_month("1"), 1)
        self.assertEqual(parse_month("01"), 1)
        self.assertEqual(parse_month("6"), 6)
        self.assertEqual(parse_month("12"), 12)

    def test_named_months(self):
        self.assertEqual(parse_month("january"), 1)
        self.assertEqual(parse_month("January"), 1)
        self.assertEqual(parse_month("FEB"), 2)
        self.assertEqual(parse_month("March"), 3)
        self.assertEqual(parse_month("september"), 9)
        self.assertEqual(parse_month("sept"), 9)
        self.assertEqual(parse_month("sep"), 9)
        self.assertEqual(parse_month("december"), 12)

    def test_invalid_months(self):
        with self.assertRaises(ValueError):
            parse_month("0")
        with self.assertRaises(ValueError):
            parse_month("13")
        with self.assertRaises(ValueError):
            parse_month("foobar")
        with self.assertRaises(ValueError):
            parse_month("")


class TestMonthRangeParser(unittest.TestCase):
    def test_single_month(self):
        self.assertEqual(parse_month_range("5"), [5])
        self.assertEqual(parse_month_range("May"), [5])
        self.assertEqual(parse_month_range("oct"), [10])

    def test_numeric_ranges(self):
        self.assertEqual(parse_month_range("3-8"), [3, 4, 5, 6, 7, 8])
        self.assertEqual(parse_month_range("3..8"), [3, 4, 5, 6, 7, 8])
        self.assertEqual(parse_month_range("3 to 8"), [3, 4, 5, 6, 7, 8])
        self.assertEqual(parse_month_range("3 through 5"), [3, 4, 5])

    def test_named_ranges(self):
        self.assertEqual(parse_month_range("March-August"), [3, 4, 5, 6, 7, 8])
        self.assertEqual(parse_month_range("Mar - Aug"), [3, 4, 5, 6, 7, 8])
        self.assertEqual(parse_month_range("Jan to Mar"), [1, 2, 3])
        self.assertEqual(parse_month_range("October..December"), [10, 11, 12])

    def test_keywords(self):
        expected_all = list(range(1, 13))
        self.assertEqual(parse_month_range("all"), expected_all)
        self.assertEqual(parse_month_range("*"), expected_all)
        self.assertEqual(parse_month_range("year"), expected_all)
        self.assertEqual(parse_month_range("1-12"), expected_all)

    def test_comma_separated(self):
        self.assertEqual(parse_month_range("1, 3, 5"), [1, 3, 5])
        self.assertEqual(parse_month_range("Jan, Mar, May"), [1, 3, 5])
        self.assertEqual(parse_month_range("1-2, 5-6"), [1, 2, 5, 6])

    def test_wrap_around_range(self):
        self.assertEqual(parse_month_range("11-2"), [11, 12, 1, 2])
        self.assertEqual(parse_month_range("Nov to Feb"), [11, 12, 1, 2])


class TestYearParser(unittest.TestCase):
    def test_valid_year(self):
        self.assertEqual(parse_year("2026"), 2026)
        self.assertEqual(parse_year("1999"), 1999)
        self.assertEqual(parse_year("1"), 1)
        self.assertEqual(parse_year("9999"), 9999)

    def test_invalid_year(self):
        with self.assertRaises(ValueError):
            parse_year("0")
        with self.assertRaises(ValueError):
            parse_year("10000")
        with self.assertRaises(ValueError):
            parse_year("abc")
        with self.assertRaises(ValueError):
            parse_year("")


class TestAnsiAndPad(unittest.TestCase):
    def test_strip_ansi(self):
        colored = "\033[1m\033[31mHello\033[0m"
        self.assertEqual(strip_ansi(colored), "Hello")
        self.assertEqual(visible_len(colored), 5)

    def test_pad_ansi(self):
        colored = "\033[32mHi\033[0m"
        padded_center = pad_ansi(colored, 6, align="center")
        self.assertEqual(visible_len(padded_center), 6)
        self.assertEqual(strip_ansi(padded_center), "  Hi  ")

        padded_right = pad_ansi(colored, 6, align="right")
        self.assertEqual(strip_ansi(padded_right), "    Hi")

        padded_left = pad_ansi(colored, 6, align="left")
        self.assertEqual(strip_ansi(padded_left), "Hi    ")


class TestTerminalCalendar(unittest.TestCase):
    def test_render_single_month_lines_and_alignment(self):
        theme = ColorTheme(enabled=False)
        cal = TerminalCalendar(style="rounded", theme=theme)
        lines = cal.render_month_box(2026, 10, today=datetime.date(2026, 10, 15))

        # Expected number of lines:
        # Top border (1) + Title (1) + Sep (1) + Weekday Header (1) + 6 weeks (6) + Bottom border (1) = 11 lines
        self.assertEqual(len(lines), 11)

        # Ensure all lines have the exact same visual length (22 inner width + 2 borders = 24 chars)
        for idx, line in enumerate(lines):
            vlen = visible_len(line)
            self.assertEqual(
                vlen,
                24,
                f"Line {idx} visual length {vlen} != 24. Content: '{line}'"
            )

        # Check content includes month and year
        self.assertIn("October 2026", lines[1])
        # Check weekdays
        self.assertIn("Mo", lines[3])
        self.assertIn("Su", lines[3])

    def test_render_with_colors_enabled(self):
        theme = ColorTheme(enabled=True)
        cal = TerminalCalendar(style="rounded", theme=theme)
        lines = cal.render_month_box(2026, 10, today=datetime.date(2026, 10, 15))
        self.assertEqual(len(lines), 11)
        # Even with ANSI colors, visible length must be exactly 24 chars for every line!
        for idx, line in enumerate(lines):
            vlen = visible_len(line)
            self.assertEqual(
                vlen,
                24,
                f"Line {idx} visual length {vlen} != 24. Stripped: '{strip_ansi(line)}'"
            )

    def test_all_box_styles(self):
        theme = ColorTheme(enabled=False)
        for style in BOX_STYLES:
            cal = TerminalCalendar(style=style, theme=theme)
            lines = cal.render_month_box(2026, 5)
            self.assertEqual(len(lines), 11)
            for line in lines:
                self.assertEqual(visible_len(line), 24)

    def test_sunday_first(self):
        theme = ColorTheme(enabled=False)
        cal = TerminalCalendar(first_day=calendar.SUNDAY, theme=theme)
        lines = cal.render_month_box(2026, 5)
        # Header inside the box borders should start with Su
        stripped_header = strip_ansi(lines[3]).strip().strip("│|║┃ ")
        self.assertTrue(stripped_header.startswith("Su"))

    def test_leap_year_february(self):
        theme = ColorTheme(enabled=False)
        cal = TerminalCalendar(theme=theme)
        # 2024 is a leap year (29 days)
        lines_2024 = cal.render_month_box(2024, 2)
        full_text_2024 = "\n".join(lines_2024)
        self.assertIn("29", full_text_2024)

        # 2026 is non-leap year (28 days)
        lines_2026 = cal.render_month_box(2026, 2)
        full_text_2026 = "\n".join(lines_2026)
        self.assertNotIn("29", full_text_2026)
        self.assertIn("28", full_text_2026)

    def test_render_multi_months_grid(self):
        theme = ColorTheme(enabled=False)
        cal = TerminalCalendar(theme=theme)
        # Render 3 months in 3 columns
        output = cal.render_months(2026, [3, 4, 5], columns=3)
        lines = output.split("\n")
        self.assertEqual(len(lines), 11)
        # 3 boxes of width 24 + 2 spaces between = 24 + 2 + 24 + 2 + 24 = 76
        for line in lines:
            self.assertEqual(visible_len(line), 76)

    def test_render_two_rows(self):
        theme = ColorTheme(enabled=False)
        cal = TerminalCalendar(theme=theme)
        # Render 4 months in 2 columns -> 2 rows
        output = cal.render_months(2026, [1, 2, 3, 4], columns=2)
        lines = output.split("\n")
        # 11 lines for row 1 + 1 blank line separator + 11 lines for row 2 = 23 lines
        self.assertEqual(len(lines), 23)


class TestCliArgs(unittest.TestCase):
    def test_positional_year_and_month(self):
        parser = build_arg_parser()
        args = parser.parse_args(["2026", "5"])
        year, months, options = parse_cli_args(args)
        self.assertEqual(year, 2026)
        self.assertEqual(months, [5])

    def test_positional_month_and_year(self):
        parser = build_arg_parser()
        args = parser.parse_args(["May", "2026"])
        year, months, options = parse_cli_args(args)
        self.assertEqual(year, 2026)
        self.assertEqual(months, [5])

    def test_positional_range(self):
        parser = build_arg_parser()
        args = parser.parse_args(["2026", "3-6"])
        year, months, options = parse_cli_args(args)
        self.assertEqual(year, 2026)
        self.assertEqual(months, [3, 4, 5, 6])

    def test_flags(self):
        parser = build_arg_parser()
        args = parser.parse_args(["-y", "2026", "-m", "October", "--style", "double", "-s"])
        year, months, options = parse_cli_args(args)
        self.assertEqual(year, 2026)
        self.assertEqual(months, [10])
        self.assertEqual(options["style"], "double")
        self.assertEqual(options["first_day"], calendar.SUNDAY)


if __name__ == "__main__":
    unittest.main()
