/**
 * Calendar Web Edition
 * Pure Vanilla JavaScript implementation of term_calendar.py
 * Features:
 * - Dynamic interactive grid with day inspector & notes
 * - Real Unicode box terminal rendering matching Python term_calendar.py
 * - Flexible month & range parsing (all, 3-8, Nov to Feb, May, 1,4,7)
 * - CLI command bar parser and generator
 * - LocalStorage persistence for theme and notes
 * - Keyboard shortcuts
 */

(function () {
  'use strict';

  // --- Constants & Border Styles ---
  const BOX_STYLES = {
    rounded: {
      tl: '╭', tr: '╮', bl: '╰', br: '╯',
      h: '─', v: '│', sep_l: '├', sep_r: '┤', sep_h: '─'
    },
    double: {
      tl: '╔', tr: '╗', bl: '╚', br: '╝',
      h: '═', v: '║', sep_l: '╠', sep_r: '╣', sep_h: '═'
    },
    heavy: {
      tl: '┏', tr: '┓', bl: '┗', br: '┛',
      h: '━', v: '┃', sep_l: '┣', sep_r: '┫', sep_h: '━'
    },
    simple: {
      tl: '┌', tr: '┐', bl: '└', br: '┘',
      h: '─', v: '│', sep_l: '├', sep_r: '┤', sep_h: '─'
    },
    ascii: {
      tl: '+', tr: '+', bl: '+', br: '+',
      h: '-', v: '|', sep_l: '+', sep_r: '+', sep_h: '-'
    },
    clean: {
      tl: ' ', tr: ' ', bl: ' ', br: ' ',
      h: ' ', v: ' ', sep_l: ' ', sep_r: ' ', sep_h: ' '
    }
  };

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const MONTH_LOOKUP = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'sept': 9, 'september': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12
  };

  // Day of week names
  const DAY_NAMES_ISO = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const DAY_NAMES_SUN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // --- Application State ---
  const todayDate = new Date();
  const state = {
    year: todayDate.getFullYear(),
    months: [todayDate.getMonth() + 1],
    monthInputRaw: '',
    style: 'rounded',
    firstDay: 'monday', // 'monday' or 'sunday'
    columns: 'auto',
    highlightWeekends: true,
    highlightToday: true,
    viewMode: 'grid', // 'grid' or 'terminal'
    theme: 'cyber',
    crtGlow: false,
    notes: {} // Key: "YYYY-MM-DD" -> { text, color }
  };

  let activeModalDate = null;

  // --- LocalStorage Helpers ---
  function loadPersistedState() {
    try {
      const savedTheme = localStorage.getItem('term_cal_theme');
      if (savedTheme) state.theme = savedTheme;

      const savedNotes = localStorage.getItem('term_cal_notes');
      if (savedNotes) state.notes = JSON.parse(savedNotes);

      const savedCrt = localStorage.getItem('term_cal_crt');
      if (savedCrt !== null) state.crtGlow = savedCrt === 'true';

      const savedView = localStorage.getItem('term_cal_view');
      if (savedView) state.viewMode = savedView;
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  function saveNotes() {
    try {
      localStorage.setItem('term_cal_notes', JSON.stringify(state.notes));
      updateNotesBadge();
    } catch (e) {
      console.warn('Failed to save notes:', e);
    }
  }

  // --- Parsing Logic (matching term_calendar.py) ---

  function parseMonth(val) {
    const s = String(val).trim().toLowerCase();
    if (!s) throw new Error('Month cannot be empty.');

    if (/^\d+$/.test(s)) {
      const num = parseInt(s, 10);
      if (num >= 1 && num <= 12) return num;
      throw new Error(`Month number must be between 1 and 12 (got ${num}).`);
    }

    if (MONTH_LOOKUP[s]) return MONTH_LOOKUP[s];

    if (s.length >= 3) {
      for (const [name, num] of Object.entries(MONTH_LOOKUP)) {
        if (name.startsWith(s)) return num;
      }
    }

    throw new Error(`Unrecognized month '${val}'. Use 1-12, 'Jan'-'Dec', or full month names.`);
  }

  function parseMonthRange(val) {
    if (!val || !val.trim()) {
      return [new Date().getMonth() + 1];
    }

    const s = val.trim();

    // Check keywords for all 12 months
    if (['all', '*', 'year', '1-12'].includes(s.toLowerCase())) {
      return Array.from({ length: 12 }, (_, i) => i + 1);
    }

    // Comma-separated segments
    if (s.includes(',')) {
      const seen = new Set();
      const result = [];
      const parts = s.split(',');
      for (const part of parts) {
        if (part.trim()) {
          const subMonths = parseMonthRange(part.trim());
          for (const m of subMonths) {
            if (!seen.has(m)) {
              seen.add(m);
              result.push(m);
            }
          }
        }
      }
      return result;
    }

    // Range patterns: "3-8", "3..8", "3 to 8", "March-August", "Jan to Mar"
    const rangePatterns = [
      /^(\w+)\s*[-]\s*(\w+)$/,
      /^(\w+)\s*\.\.\s*(\w+)$/,
      /^(\w+)\s+to\s+(\w+)$/i
    ];

    for (const pat of rangePatterns) {
      const m = s.match(pat);
      if (m) {
        const start = parseMonth(m[1]);
        const end = parseMonth(m[2]);

        if (start <= end) {
          const res = [];
          for (let i = start; i <= end; i++) res.push(i);
          return res;
        } else {
          // Wrap around (e.g., 11-2 -> 11, 12, 1, 2)
          const res = [];
          for (let i = start; i <= 12; i++) res.push(i);
          for (let i = 1; i <= end; i++) res.push(i);
          return res;
        }
      }
    }

    // Single month
    return [parseMonth(s)];
  }

  function parseCLICommand(input) {
    let clean = input.trim();
    if (clean.startsWith('python calendar_app.py')) {
      clean = clean.replace('python calendar_app.py', '').trim();
    } else if (clean.startsWith('term_calendar.py')) {
      clean = clean.replace('term_calendar.py', '').trim();
    }

    const tokens = clean.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const positional = [];
    const options = {
      year: null,
      month: null,
      style: null,
      sunday: null,
      columns: null
    };

    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i].replace(/^["']|["']$/g, '');
      if (tok === '-y' || tok === '--year') {
        if (i + 1 < tokens.length) {
          options.year = parseInt(tokens[++i].replace(/^["']|["']$/g, ''), 10);
        }
      } else if (tok === '-m' || tok === '--month') {
        if (i + 1 < tokens.length) {
          options.month = tokens[++i].replace(/^["']|["']$/g, '');
        }
      } else if (tok === '--style' || tok === '-style') {
        if (i + 1 < tokens.length) {
          options.style = tokens[++i].replace(/^["']|["']$/g, '').toLowerCase();
        }
      } else if (tok === '-s' || tok === '--sunday') {
        options.sunday = true;
      } else if (tok === '-c' || tok === '--columns') {
        if (i + 1 < tokens.length) {
          const colVal = tokens[++i].replace(/^["']|["']$/g, '');
          options.columns = colVal.toLowerCase() === 'auto' ? 'auto' : parseInt(colVal, 10);
        }
      } else if (!tok.startsWith('-')) {
        positional.push(tok);
      }
      i++;
    }

    // Positional argument resolution (year, month or month, year)
    if (positional.length === 1) {
      const p = positional[0];
      if (/^\d{4}$/.test(p)) {
        options.year = parseInt(p, 10);
        if (!options.month) options.month = 'all';
      } else {
        options.month = p;
      }
    } else if (positional.length >= 2) {
      const p0 = positional[0];
      const p1 = positional[1];
      if (/^\d{4}$/.test(p0)) {
        options.year = parseInt(p0, 10);
        options.month = p1;
      } else if (/^\d{4}$/.test(p1)) {
        options.year = parseInt(p1, 10);
        options.month = p0;
      } else {
        options.year = parseInt(p0, 10) || state.year;
        options.month = p1;
      }
    }

    return options;
  }

  function generateCLIString() {
    const parts = [];
    parts.push(state.year);

    if (state.months.length === 12) {
      parts.push('all');
    } else if (state.months.length === 1) {
      parts.push(state.months[0]);
    } else {
      // Check if continuous
      let isContinuous = true;
      for (let i = 1; i < state.months.length; i++) {
        if (state.months[i] !== state.months[i - 1] + 1) {
          isContinuous = false;
          break;
        }
      }
      if (isContinuous && state.months.length > 1) {
        parts.push(`"${state.months[0]}-${state.months[state.months.length - 1]}"`);
      } else {
        parts.push(`"${state.months.join(', ')}"`);
      }
    }

    if (state.style !== 'rounded') {
      parts.push(`--style ${state.style}`);
    }

    if (state.firstDay === 'sunday') {
      parts.push('-s');
    }

    if (state.columns !== 'auto') {
      parts.push(`-c ${state.columns}`);
    }

    return parts.join(' ');
  }

  // --- Calendar Date Math ---

  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  /**
   * Generates a 6-week matrix for the month (matching Python's Calendar.monthdayscalendar).
   * Each week is an array of 7 integers (day number, or 0 if outside month).
   */
  function getMonthMatrix(year, month, firstDay) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayDate = new Date(year, month - 1, 1);
    const jsDay = firstDayDate.getDay(); // 0 is Sunday, 1 is Monday

    // Starting column index in 0-6
    let startCol;
    if (firstDay === 'sunday') {
      startCol = jsDay; // Sunday = 0, Monday = 1, ...
    } else {
      // Monday = 0, Sunday = 6
      startCol = (jsDay + 6) % 7;
    }

    const weeks = [];
    let currentWeek = new Array(7).fill(0);
    let col = startCol;

    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek[col] = day;
      col++;
      if (col === 7) {
        weeks.push(currentWeek);
        currentWeek = new Array(7).fill(0);
        col = 0;
      }
    }

    if (col > 0) {
      weeks.push(currentWeek);
    }

    // Always pad to 6 weeks for uniform height (identical to term_calendar.py)
    while (weeks.length < 6) {
      weeks.push(new Array(7).fill(0));
    }

    return weeks;
  }

  function getWeekdayHeaders(firstDay) {
    if (firstDay === 'sunday') {
      return {
        headers: DAY_NAMES_SUN,
        isWeekend: [true, false, false, false, false, false, true] // Sun, Sat
      };
    } else {
      return {
        headers: DAY_NAMES_ISO,
        isWeekend: [false, false, false, false, false, true, true] // Sa, Su
      };
    }
  }

  // --- Date Details Math for Modal ---
  function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  function getISOWeekNumber(d) {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / (7 * 24 * 3600 * 1000));
  }

  function getRelativeDateString(targetDate) {
    const today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffTime = target - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  }

  // --- Rendering: Mode 1 (Interactive Grid) ---

  function renderInteractiveGrid() {
    const container = document.getElementById('calendar-cards-grid');
    container.innerHTML = '';
    container.setAttribute('data-columns', state.columns);

    const { headers, isWeekend } = getWeekdayHeaders(state.firstDay);
    const isSingleYear = true; // In current view, single year is selected

    state.months.forEach((month) => {
      const monthCard = document.createElement('div');
      monthCard.className = 'month-card';

      // Month Card Header
      const headerEl = document.createElement('div');
      headerEl.className = 'month-card-header';
      headerEl.innerHTML = `
        <h3 class="month-title">${MONTH_NAMES[month - 1]}</h3>
        <span class="month-year-badge">${state.year}</span>
      `;
      monthCard.appendChild(headerEl);

      // Weekday Row
      const weekdaysRow = document.createElement('div');
      weekdaysRow.className = 'weekdays-row';
      headers.forEach((label, idx) => {
        const span = document.createElement('span');
        span.className = `weekday-label ${isWeekend[idx] && state.highlightWeekends ? 'is-weekend' : ''}`;
        span.textContent = label;
        weekdaysRow.appendChild(span);
      });
      monthCard.appendChild(weekdaysRow);

      // Days Matrix
      const matrixEl = document.createElement('div');
      matrixEl.className = 'days-matrix';

      const weeks = getMonthMatrix(state.year, month, state.firstDay);

      weeks.forEach((week) => {
        week.forEach((dayNum, colIdx) => {
          const dayCell = document.createElement('button');
          dayCell.type = 'button';
          dayCell.className = 'day-cell';

          if (dayNum === 0) {
            dayCell.classList.add('empty');
            dayCell.tabIndex = -1;
          } else {
            dayCell.textContent = dayNum;
            const dateKey = `${state.year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

            // Check if weekend
            if (isWeekend[colIdx] && state.highlightWeekends) {
              dayCell.classList.add('is-weekend');
            }

            // Check if today
            if (
              state.highlightToday &&
              state.year === todayDate.getFullYear() &&
              month === (todayDate.getMonth() + 1) &&
              dayNum === todayDate.getDate()
            ) {
              dayCell.classList.add('is-today');
              dayCell.title = `Today — ${MONTH_NAMES[month - 1]} ${dayNum}, ${state.year}`;
            } else {
              dayCell.title = `${MONTH_NAMES[month - 1]} ${dayNum}, ${state.year}`;
            }

            // Check if note exists
            if (state.notes[dateKey]) {
              const dot = document.createElement('span');
              dot.className = 'note-dot';
              dot.style.backgroundColor = state.notes[dateKey].color || 'var(--accent-primary)';
              dayCell.appendChild(dot);
            }

            // Click listener to inspect date
            dayCell.addEventListener('click', () => {
              openDateModal(state.year, month, dayNum);
            });
          }

          matrixEl.appendChild(dayCell);
        });
      });

      monthCard.appendChild(matrixEl);
      container.appendChild(monthCard);
    });
  }

  // --- Rendering: Mode 2 (Terminal Unicode Box Preview) ---

  function renderTerminalBox() {
    const preEl = document.getElementById('terminal-pre');
    const box = BOX_STYLES[state.style] || BOX_STYLES.rounded;
    const innerWidth = 22; // Matches Python inner_width
    const { headers, isWeekend } = getWeekdayHeaders(state.firstDay);

    // Compute layout columns for terminal
    let numCols = 1;
    if (state.columns === 'auto') {
      const containerWidth = document.getElementById('terminal-window-body').clientWidth || 800;
      const boxWidthChars = innerWidth + 2; // 24 chars
      const charWidthPx = 9.5; // Estimated monospace width
      const maxCols = Math.floor(containerWidth / (boxWidthChars * charWidthPx + 16));
      numCols = Math.max(1, Math.min(state.months.length, maxCols, 4));
    } else {
      numCols = parseInt(state.columns, 10);
    }

    // Render single month box into lines with HTML tokens for styling
    function buildMonthBoxLines(month) {
      const lines = [];
      const mName = MONTH_NAMES[month - 1];
      const yStr = String(state.year);

      // Top border
      const topBorder = `<span class="t-border">${box.tl}${box.h.repeat(innerWidth)}${box.tr}</span>`;
      lines.push(topBorder);

      // Title: Month and Year centered in innerWidth
      const titleRaw = `${mName} ${yStr}`;
      const titlePadLeft = Math.floor((innerWidth - titleRaw.length) / 2);
      const titlePadRight = innerWidth - titleRaw.length - titlePadLeft;
      const titleLine = `<span class="t-border">${box.v}</span>${' '.repeat(titlePadLeft)}<span class="t-mtitle">${mName}</span> <span class="t-ytitle">${yStr}</span>${' '.repeat(titlePadRight)}<span class="t-border">${box.v}</span>`;
      lines.push(titleLine);

      // Separator
      const sepLine = `<span class="t-border">${box.sep_l}${box.sep_h.repeat(innerWidth)}${box.sep_r}</span>`;
      lines.push(sepLine);

      // Weekday headers
      const hdrTokens = headers.map((h, i) => {
        if (isWeekend[i] && state.highlightWeekends) {
          return `<span class="t-wkndhdr">${h}</span>`;
        }
        return `<span class="t-wkhdr">${h}</span>`;
      });
      const hdrRow = hdrTokens.join(' ');
      lines.push(`<span class="t-border">${box.v}</span> ${hdrRow}  <span class="t-border">${box.v}</span>`);

      // Calendar weeks
      const weeks = getMonthMatrix(state.year, month, state.firstDay);
      weeks.forEach((week) => {
        const weekTokens = week.map((d, colIdx) => {
          if (d === 0) return '  ';
          const dStr = String(d).padStart(2, ' ');
          const isToday =
            state.highlightToday &&
            state.year === todayDate.getFullYear() &&
            month === (todayDate.getMonth() + 1) &&
            d === todayDate.getDate();

          if (isToday) {
            return `<span class="t-today">${dStr}</span>`;
          } else if (isWeekend[colIdx] && state.highlightWeekends) {
            return `<span class="t-wknd">${dStr}</span>`;
          } else {
            return `<span class="t-day">${dStr}</span>`;
          }
        });
        const weekRow = weekTokens.join(' ');
        lines.push(`<span class="t-border">${box.v}</span> ${weekRow}  <span class="t-border">${box.v}</span>`);
      });

      // Bottom border
      const btmBorder = `<span class="t-border">${box.bl}${box.h.repeat(innerWidth)}${box.br}</span>`;
      lines.push(btmBorder);

      return lines;
    }

    // Split months into rows of numCols
    const renderedRows = [];
    for (let i = 0; i < state.months.length; i += numCols) {
      const rowMonths = state.months.slice(i, i + numCols);
      const rowBoxes = rowMonths.map(buildMonthBoxLines);
      const lineCount = rowBoxes[0].length;

      for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
        const combinedLine = rowBoxes.map((b) => b[lineIdx]).join('  ');
        renderedRows.push(combinedLine);
      }
      renderedRows.push(''); // Gap between month rows
    }

    preEl.innerHTML = renderedRows.join('\n');
  }

  // --- Plain Text Generator (for clipboard and download) ---
  function generatePlainTextCalendar() {
    const box = BOX_STYLES[state.style] || BOX_STYLES.rounded;
    const innerWidth = 22;
    const { headers } = getWeekdayHeaders(state.firstDay);

    let numCols = 1;
    if (state.columns === 'auto') {
      numCols = state.months.length === 1 ? 1 : state.months.length <= 4 ? state.months.length : 3;
    } else {
      numCols = parseInt(state.columns, 10);
    }

    function buildPlainBox(month) {
      const lines = [];
      const mName = MONTH_NAMES[month - 1];
      const yStr = String(state.year);

      // Top
      lines.push(box.tl + box.h.repeat(innerWidth) + box.tr);

      // Title
      const titleRaw = `${mName} ${yStr}`;
      const padLeft = Math.floor((innerWidth - titleRaw.length) / 2);
      const padRight = innerWidth - titleRaw.length - padLeft;
      lines.push(box.v + ' '.repeat(padLeft) + titleRaw + ' '.repeat(padRight) + box.v);

      // Sep
      lines.push(box.sep_l + box.sep_h.repeat(innerWidth) + box.sep_r);

      // Header
      lines.push(box.v + ' ' + headers.join(' ') + '  ' + box.v);

      // Weeks
      const weeks = getMonthMatrix(state.year, month, state.firstDay);
      weeks.forEach((week) => {
        const rowStr = week.map((d) => (d === 0 ? '  ' : String(d).padStart(2, ' '))).join(' ');
        lines.push(box.v + ' ' + rowStr + '  ' + box.v);
      });

      // Bottom
      lines.push(box.bl + box.h.repeat(innerWidth) + box.br);

      return lines;
    }

    const outputRows = [];
    for (let i = 0; i < state.months.length; i += numCols) {
      const rowMonths = state.months.slice(i, i + numCols);
      const rowBoxes = rowMonths.map(buildPlainBox);
      const lineCount = rowBoxes[0].length;

      for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
        outputRows.push(rowBoxes.map((b) => b[lineIdx]).join('  '));
      }
      outputRows.push('');
    }

    return outputRows.join('\n');
  }

  // --- UI Synchronizer ---
  function updateUI() {
    // 1. Year input
    document.getElementById('year-input').value = state.year;

    // 2. Month input
    const monthInput = document.getElementById('month-input');
    if (document.activeElement !== monthInput) {
      if (state.months.length === 12) {
        monthInput.value = 'all';
      } else if (state.months.length === 1) {
        monthInput.value = MONTH_NAMES[state.months[0] - 1];
      } else {
        monthInput.value = `${MONTH_NAMES[state.months[0] - 1].slice(0, 3)} - ${MONTH_NAMES[state.months[state.months.length - 1] - 1].slice(0, 3)}`;
      }
    }

    // 3. Style select
    document.getElementById('border-style-select').value = state.style;

    // 4. Columns select
    document.getElementById('columns-select').value = state.columns;

    // 5. Toggles
    document.getElementById('sunday-start-toggle').checked = state.firstDay === 'sunday';
    document.getElementById('weekend-toggle').checked = state.highlightWeekends;
    document.getElementById('today-toggle').checked = state.highlightToday;

    // 6. CLI Input
    const cliInput = document.getElementById('cli-input');
    if (document.activeElement !== cliInput) {
      cliInput.value = generateCLIString();
    }

    // 7. Active summary
    const summaryEl = document.getElementById('active-summary');
    let monthLabel = '';
    if (state.months.length === 12) {
      monthLabel = 'All 12 Months';
    } else if (state.months.length === 1) {
      monthLabel = MONTH_NAMES[state.months[0] - 1];
    } else {
      monthLabel = `${state.months.length} Months (${state.months.map(m => MONTH_NAMES[m - 1].slice(0, 3)).join(', ')})`;
    }
    summaryEl.innerHTML = `Showing: <strong>${monthLabel} ${state.year}</strong> &bull; Style: <em>${state.style}</em>`;

    // 8. Render active view
    renderInteractiveGrid();
    renderTerminalBox();
    updateNotesBadge();
  }

  function updateNotesBadge() {
    const badge = document.getElementById('notes-badge');
    const noteKeys = Object.keys(state.notes);
    if (noteKeys.length > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = `${noteKeys.length} Note${noteKeys.length > 1 ? 's' : ''}`;
    } else {
      badge.style.display = 'none';
    }
  }

  // --- Date Modal Handlers ---

  function openDateModal(year, month, day) {
    activeModalDate = { year, month, day };
    const dateObj = new Date(year, month - 1, day);
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const titleEl = document.getElementById('modal-date-title');
    const badgeEl = document.getElementById('modal-date-badge');
    titleEl.textContent = `${MONTH_NAMES[month - 1]} ${day}, ${year}`;

    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const isToday =
      year === todayDate.getFullYear() &&
      month === (todayDate.getMonth() + 1) &&
      day === todayDate.getDate();

    badgeEl.textContent = `${dayName}${isToday ? ' • Today' : ''}`;

    // Metrics
    const dayOfYear = getDayOfYear(dateObj);
    const totalDays = isLeapYear(year) ? 366 : 365;
    document.getElementById('metric-day-of-year').textContent = `${dayOfYear} / ${totalDays}`;
    document.getElementById('metric-week-number').textContent = `Week ${getISOWeekNumber(dateObj)}`;
    document.getElementById('metric-relative').textContent = getRelativeDateString(dateObj);

    const quarter = Math.ceil(month / 3);
    document.getElementById('metric-quarter').textContent = `Q${quarter}`;

    // Notes
    const noteInput = document.getElementById('date-note-input');
    const deleteBtn = document.getElementById('delete-note-btn');

    if (state.notes[dateKey]) {
      noteInput.value = state.notes[dateKey].text;
      selectColorDot(state.notes[dateKey].color);
      deleteBtn.style.display = 'inline-block';
    } else {
      noteInput.value = '';
      selectColorDot('#06b6d4');
      deleteBtn.style.display = 'none';
    }

    const modal = document.getElementById('date-modal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    noteInput.focus();
  }

  function closeDateModal() {
    const modal = document.getElementById('date-modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    activeModalDate = null;
  }

  function selectColorDot(color) {
    document.querySelectorAll('.color-dot').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-color') === color);
    });
  }

  function getSelectedColorDot() {
    const active = document.querySelector('.color-dot.active');
    return active ? active.getAttribute('data-color') : '#06b6d4';
  }

  // --- Toast Notifications ---
  function showToast(message, icon = '✓') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // 1. View Mode Toggle (Grid vs Terminal)
    const gridBtn = document.getElementById('mode-grid-btn');
    const termBtn = document.getElementById('mode-terminal-btn');
    const gridView = document.getElementById('interactive-grid-view');
    const termView = document.getElementById('terminal-box-view');

    function switchView(mode) {
      state.viewMode = mode;
      localStorage.setItem('term_cal_view', mode);
      if (mode === 'grid') {
        gridBtn.classList.add('active');
        gridBtn.setAttribute('aria-selected', 'true');
        termBtn.classList.remove('active');
        termBtn.setAttribute('aria-selected', 'false');
        gridView.classList.add('active');
        termView.classList.remove('active');
      } else {
        termBtn.classList.add('active');
        termBtn.setAttribute('aria-selected', 'true');
        gridBtn.classList.remove('active');
        gridBtn.setAttribute('aria-selected', 'false');
        termView.classList.add('active');
        gridView.classList.remove('active');
        renderTerminalBox();
      }
    }

    gridBtn.addEventListener('click', () => switchView('grid'));
    termBtn.addEventListener('click', () => switchView('terminal'));

    // 2. Theme Selector
    const themeSelect = document.getElementById('theme-selector');
    themeSelect.value = state.theme;
    document.documentElement.setAttribute('data-theme', state.theme);

    themeSelect.addEventListener('change', (e) => {
      state.theme = e.target.value;
      document.documentElement.setAttribute('data-theme', state.theme);
      localStorage.setItem('term_cal_theme', state.theme);
      showToast(`Theme switched to ${e.target.options[e.target.selectedIndex].text}`);
    });

    // 3. Today Jump Button
    document.getElementById('today-jump-btn').addEventListener('click', () => {
      state.year = todayDate.getFullYear();
      state.months = [todayDate.getMonth() + 1];
      updateUI();
      showToast(`Jumped to ${MONTH_NAMES[todayDate.getMonth()]} ${state.year}`);
    });

    // 4. Steppers: Year & Month
    document.getElementById('prev-year-btn').addEventListener('click', () => {
      if (state.year > 1) {
        state.year--;
        updateUI();
      }
    });

    document.getElementById('next-year-btn').addEventListener('click', () => {
      if (state.year < 9999) {
        state.year++;
        updateUI();
      }
    });

    document.getElementById('year-input').addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 1 && val <= 9999) {
        state.year = val;
        updateUI();
      } else {
        e.target.value = state.year;
      }
    });

    document.getElementById('prev-month-btn').addEventListener('click', () => {
      if (state.months.length === 1) {
        let m = state.months[0] - 1;
        if (m < 1) {
          m = 12;
          state.year--;
        }
        state.months = [m];
      } else {
        // Shift range backwards
        state.months = state.months.map((m) => (m === 1 ? 12 : m - 1));
      }
      updateUI();
    });

    document.getElementById('next-month-btn').addEventListener('click', () => {
      if (state.months.length === 1) {
        let m = state.months[0] + 1;
        if (m > 12) {
          m = 1;
          state.year++;
        }
        state.months = [m];
      } else {
        // Shift range forward
        state.months = state.months.map((m) => (m === 12 ? 1 : m + 1));
      }
      updateUI();
    });

    document.getElementById('month-input').addEventListener('change', (e) => {
      try {
        const parsed = parseMonthRange(e.target.value);
        state.months = parsed;
        updateUI();
      } catch (err) {
        showToast(err.message, '⚠️');
        updateUI();
      }
    });

    // 5. Border Style Select
    document.getElementById('border-style-select').addEventListener('change', (e) => {
      state.style = e.target.value;
      updateUI();
      showToast(`Border style: ${e.target.value}`);
    });

    // 6. Columns Select
    document.getElementById('columns-select').addEventListener('change', (e) => {
      state.columns = e.target.value;
      updateUI();
    });

    // 7. Toggles
    document.getElementById('sunday-start-toggle').addEventListener('change', (e) => {
      state.firstDay = e.target.checked ? 'sunday' : 'monday';
      updateUI();
      showToast(state.firstDay === 'sunday' ? 'Week starts on Sunday' : 'Week starts on Monday');
    });

    document.getElementById('weekend-toggle').addEventListener('change', (e) => {
      state.highlightWeekends = e.target.checked;
      updateUI();
    });

    document.getElementById('today-toggle').addEventListener('change', (e) => {
      state.highlightToday = e.target.checked;
      updateUI();
    });

    // 8. CLI Command Input & Presets
    const cliInput = document.getElementById('cli-input');
    const cliRunBtn = document.getElementById('cli-run-btn');

    function applyCLI() {
      try {
        const parsed = parseCLICommand(cliInput.value);
        if (parsed.year) state.year = parsed.year;
        if (parsed.month) state.months = parseMonthRange(parsed.month);
        if (parsed.style) state.style = parsed.style;
        if (parsed.sunday !== null) state.firstDay = parsed.sunday ? 'sunday' : 'monday';
        if (parsed.columns !== null) state.columns = String(parsed.columns);
        updateUI();
        showToast('CLI options applied successfully');
      } catch (err) {
        showToast(err.message, '⚠️');
      }
    }

    cliRunBtn.addEventListener('click', applyCLI);
    cliInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyCLI();
    });

    document.querySelectorAll('.hint-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd');
        cliInput.value = cmd;
        applyCLI();
      });
    });

    // 9. Copy CLI Command Button
    document.getElementById('copy-cli-btn').addEventListener('click', async () => {
      const fullCmd = `python calendar_app.py ${generateCLIString()}`;
      try {
        await navigator.clipboard.writeText(fullCmd);
        const label = document.getElementById('copy-cli-text');
        const originalText = label.textContent;
        label.textContent = 'Copied!';
        showToast(`Copied to clipboard: ${fullCmd}`);
        setTimeout(() => { label.textContent = originalText; }, 2000);
      } catch (e) {
        showToast('Clipboard access denied', '⚠️');
      }
    });

    // 10. Copy Text Box & Terminal Copy
    async function copyCalendarText() {
      const text = generatePlainTextCalendar();
      try {
        await navigator.clipboard.writeText(text);
        showToast('Calendar text copied to clipboard!');
      } catch (e) {
        showToast('Clipboard copy failed', '⚠️');
      }
    }

    document.getElementById('copy-text-btn').addEventListener('click', copyCalendarText);
    document.getElementById('terminal-copy-btn').addEventListener('click', copyCalendarText);

    // 11. Download .txt Button
    document.getElementById('download-txt-btn').addEventListener('click', () => {
      const text = generatePlainTextCalendar();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calendar-${state.year}-${state.months.join('-')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded calendar .txt file');
    });

    // 12. Print Button
    document.getElementById('print-btn').addEventListener('click', () => {
      window.print();
    });

    // 13. CRT Toggle in Terminal View
    const crtToggle = document.getElementById('crt-toggle');
    const termWindow = document.querySelector('.terminal-window');
    crtToggle.checked = state.crtGlow;
    termWindow.classList.toggle('crt-active', state.crtGlow);

    crtToggle.addEventListener('change', (e) => {
      state.crtGlow = e.target.checked;
      termWindow.classList.toggle('crt-active', state.crtGlow);
      localStorage.setItem('term_cal_crt', String(state.crtGlow));
    });

    // 14. Modal Buttons (Save, Delete, Close)
    document.getElementById('modal-close-btn').addEventListener('click', closeDateModal);
    document.getElementById('cancel-modal-btn').addEventListener('click', closeDateModal);

    document.getElementById('date-modal').addEventListener('click', (e) => {
      if (e.target.id === 'date-modal') closeDateModal();
    });

    document.querySelectorAll('.color-dot').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectColorDot(btn.getAttribute('data-color'));
      });
    });

    document.getElementById('save-note-btn').addEventListener('click', () => {
      if (!activeModalDate) return;
      const { year, month, day } = activeModalDate;
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const text = document.getElementById('date-note-input').value.trim();
      const color = getSelectedColorDot();

      if (text) {
        state.notes[key] = { text, color };
        showToast(`Note saved for ${MONTH_NAMES[month - 1]} ${day}!`);
      } else {
        delete state.notes[key];
        showToast(`Note removed for ${MONTH_NAMES[month - 1]} ${day}`);
      }

      saveNotes();
      closeDateModal();
      renderInteractiveGrid();
    });

    document.getElementById('delete-note-btn').addEventListener('click', () => {
      if (!activeModalDate) return;
      const { year, month, day } = activeModalDate;
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      delete state.notes[key];
      saveNotes();
      closeDateModal();
      renderInteractiveGrid();
      showToast('Note deleted');
    });

    // 15. Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        if (e.key === 'Escape') {
          if (document.getElementById('date-modal').classList.contains('open')) {
            closeDateModal();
          } else {
            document.activeElement.blur();
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        closeDateModal();
      } else if (e.key === '/') {
        e.preventDefault();
        cliInput.focus();
        cliInput.select();
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        state.year = todayDate.getFullYear();
        state.months = [todayDate.getMonth() + 1];
        updateUI();
        showToast('Jumped to Today');
      } else if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        switchView(state.viewMode === 'grid' ? 'terminal' : 'grid');
        showToast(`Switched view to ${state.viewMode}`);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        document.getElementById(e.shiftKey ? 'prev-year-btn' : 'prev-month-btn').click();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        document.getElementById(e.shiftKey ? 'next-year-btn' : 'next-month-btn').click();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        document.getElementById('next-year-btn').click();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        document.getElementById('prev-year-btn').click();
      }
    });

    // Responsive resize handler for terminal columns
    window.addEventListener('resize', () => {
      if (state.columns === 'auto') {
        renderTerminalBox();
      }
    });
  }

  // --- Initialize App ---
  function init() {
    loadPersistedState();
    setupEventListeners();
    updateUI();
    if (state.viewMode === 'terminal') {
      document.getElementById('mode-terminal-btn').click();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
