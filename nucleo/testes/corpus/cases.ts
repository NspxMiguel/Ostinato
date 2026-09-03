// The corpus: at least 100 schedule tables, each covering a genuinely
// different mess — not a hundred cosmetic variations of the same one.
//
// Most are born from the same factory (`builder.ts`), varying the axes a
// real school actually varies: where the header sits, how the weekday is
// written, where the time lives, how many days the week has, what noise the
// paper or the OCR introduces. A handful are written by hand because the
// mess isn't a parameter — it's a whole different shape (a transposed table,
// a column that slipped).
//
// Every case says whether the deterministic reader SHOULD get it right
// (`readableByAlgorithm`). When it shouldn't, `corpus.test.ts` doesn't
// demand a correct read — it demands that the wrong read come with the
// quality score warning, or the case is documented as a known blind spot.

import type { ExpectedLesson, TimeFormat, WeekSpec, Period } from './builder.ts'
import { render, defaultWeek, transpose, type DayLabelStyle, type SchedulePosition } from './builder.ts'

export type CorpusCase = {
  name: string
  table: string[][]
  expected: ExpectedLesson[]
  /** The deterministic reader should manage this on its own. */
  readableByAlgorithm: boolean
  /**
   * Only matters when `readableByAlgorithm` is false: should the wrong read
   * come back with a quality score below the cutoff (the app calls the
   * model)?
   *
   * Defaults to `true` — a wrong read that stays silent is a real
   * regression. `false` marks a KNOWN, accepted blind spot: the corruption
   * leaves no verifiable signal in the output (same lesson count per day, no
   * inverted time, no odd-looking name), so no sound heuristic catches it
   * without also flagging a day that's legitimately shorter than the
   * others. Documented, not "fixed".
   */
  shouldBeFlagged: boolean
}

function testCase(
  name: string,
  built: { table: string[][]; expected: ExpectedLesson[] },
  readableByAlgorithm = true,
): CorpusCase {
  return { name, table: built.table, expected: built.expected, readableByAlgorithm, shouldBeFlagged: true }
}

const PERIODS: Period[] = [
  { inicio: '07:25', fim: '08:10' },
  { inicio: '08:10', fim: '08:55' },
  { inicio: '08:55', fim: '09:40' },
]

const cases: CorpusCase[] = []

// ─── 1. Each weekday label style, on its own ─────────────────────────────────

const STYLES: DayLabelStyle[] = [
  'ptFull',
  'ptAbbr3',
  'ptAbbrDot',
  'ptOrdinal',
  'ptOrdinalFeira',
  'english',
  'englishAbbr',
  'spanish',
  'spanishAbbr',
]

for (const style of STYLES) {
  cases.push(testCase(`weekday in ${style} style`, render(defaultWeek(), { dayLabelStyle: style })))
}

cases.push(testCase('weekday in UPPERCASE', render(defaultWeek(), { dayLabelStyle: 'ptAbbr3', dayCasing: 'upper' })))
cases.push(testCase('weekday in lowercase', render(defaultWeek(), { dayLabelStyle: 'ptFull', dayCasing: 'lower' })))
cases.push(testCase('weekday with a dot, uppercase', render(defaultWeek(), { dayLabelStyle: 'ptAbbrDot', dayCasing: 'upper' })))

// ─── 2. How many days the week has ───────────────────────────────────────────

cases.push(testCase('2-day week (technical course)', render(defaultWeek([2, 4]))))
cases.push(testCase('4-day week', render(defaultWeek([1, 2, 4, 5]))))
cases.push(testCase('6-day week, with Saturday', render(defaultWeek([1, 2, 3, 4, 5, 6]))))
cases.push(testCase('full 7-day week, with Sunday', render(defaultWeek([0, 1, 2, 3, 4, 5, 6]), { dayLabelStyle: 'ptFull' })))

// ─── 3. Where the schedule column lives ──────────────────────────────────────

cases.push(testCase('schedule column at the end', render(defaultWeek(), { schedulePosition: 'end' })))
cases.push(testCase('schedule column with only the start time', render(defaultWeek(), { schedulePosition: 'startOnly' })))
cases.push(
  testCase(
    'schedule column with only the start time, 6-day week',
    render(defaultWeek([1, 2, 3, 4, 5, 6]), { schedulePosition: 'startOnly' }),
  ),
)
cases.push(
  testCase(
    'no schedule column at all — just "1st period" — needs the model',
    render(defaultWeek(), { schedulePosition: 'none' }),
    false,
  ),
)

// ─── 4. Time format: mark × separator × leading zero ─────────────────────────

const SEPARATORS: TimeFormat['separator'][] = ['-', '–', '—', ' às ', ' a ', ' até ']
const MARKS: TimeFormat['mark'][] = [':', 'h', '.']

let formatCounter = 0
for (const mark of MARKS) {
  for (const separator of SEPARATORS) {
    const leadingZero = formatCounter % 2 === 0
    formatCounter++
    cases.push(
      testCase(
        `time "${mark}" separated by "${separator.trim()}"${leadingZero ? '' : ', no leading zero'}`,
        render(defaultWeek(), { timeFormat: { mark, separator, leadingZero } }),
      ),
    )
  }
}

// ─── 5. Title rows before the header ─────────────────────────────────────────

cases.push(testCase('one title row before the header', render(defaultWeek(), { titleRows: ['9TH GRADE SCHEDULE'] })))
cases.push(
  testCase(
    'two title rows before the header',
    render(defaultWeek(), { titleRows: ['Model School', 'Schedule — 9th grade A — 2026'] }),
  ),
)
cases.push(
  testCase(
    'three title rows, one of them blank',
    render(defaultWeek(), { titleRows: ['Model School', '', 'Class 9A — morning shift'] }),
  ),
)

// ─── 6. Extra column with no day at all ──────────────────────────────────────

cases.push(testCase('extra room column at the end', render(defaultWeek(), { extraColumn: 'Room' })))
cases.push(testCase('extra teacher column at the end', render(defaultWeek(), { extraColumn: 'Teacher' })))

// ─── 7. Space noise ───────────────────────────────────────────────────────────

cases.push(testCase('double and trailing space inside cells', render(defaultWeek(), { spaceNoise: true })))
cases.push(
  testCase(
    'trailing space, weekday in English, hour with "h"',
    render(defaultWeek(), {
      spaceNoise: true,
      dayLabelStyle: 'english',
      timeFormat: { mark: 'h', separator: ' a ', leadingZero: false },
    }),
  ),
)

// ─── 8. A fully blank row in the middle ──────────────────────────────────────

cases.push(testCase('blank row after the 1st period', render(defaultWeek(), { blankRowAfter: 0 })))
cases.push(testCase('blank row after the 2nd period', render(defaultWeek(), { blankRowAfter: 1 })))

// ─── 9. Break, recess and lunch splitting the day ────────────────────────────

cases.push(
  testCase(
    '15-minute BREAK in the middle of the day',
    render(defaultWeek(), { breakAfter: { indice: 0, label: 'INTERVALO', durationMin: 15 } }),
  ),
)
cases.push(
  testCase(
    '20-minute RECESS',
    render(defaultWeek(), { breakAfter: { indice: 1, label: 'RECREIO', durationMin: 20 } }),
  ),
)
cases.push(
  testCase(
    'recess written lowercase',
    render(defaultWeek(), { breakAfter: { indice: 0, label: 'recreio', durationMin: 15 } }),
  ),
)
cases.push(
  testCase(
    '1-hour lunch splitting the day into two blocks',
    render(defaultWeek([1, 2, 3, 4, 5]), { breakAfter: { indice: 1, label: 'ALMOÇO', durationMin: 60 } }),
  ),
)

// ─── 10. Decorated subject: slash, dot, room attached, teacher attached ─────

function withCustomSubject(dias: number[], materia: (dia: number, idx: number) => string): WeekSpec {
  return { dias, periodos: PERIODS, materia }
}

cases.push(
  testCase(
    'subject with a slash ("ART/PE")',
    render(withCustomSubject([1, 2, 3], (dia, i) => (i === 0 ? 'ART/PE' : ['MAT', 'POR'][i % 2]!))),
  ),
)
cases.push(
  testCase(
    'subject with a dot ("Ed. Fis.")',
    render(withCustomSubject([1, 2, 3], (dia, i) => (i === 1 ? 'Ed. Fis.' : ['GEO', 'HIS'][i % 2]!))),
  ),
)
cases.push(
  testCase(
    'subject with the room attached ("MAT - 204")',
    render(withCustomSubject([1, 2, 3], (dia, i) => (i === 0 ? 'MAT - 204' : ['CIE', 'ART'][i % 2]!))),
  ),
)
cases.push(
  testCase(
    'subject with the teacher attached ("MAT (Silva)")',
    render(withCustomSubject([1, 2, 3], (dia, i) => (i === 2 ? 'MAT (Silva)' : ['ING', 'FIS'][i % 2]!))),
  ),
)

// ─── 11. Lost accents / full subject names ───────────────────────────────────

cases.push(
  testCase(
    'full subject names, no accents (OCR ate them)',
    render(
      withCustomSubject(
        [1, 2, 3, 4, 5],
        (dia) => ['Matematica', 'Portugues', 'Educacao Fisica', 'Historia', 'Ciencias'][dia % 5]!,
      ),
    ),
  ),
)
cases.push(
  testCase(
    'full subject names, with accents',
    render(
      withCustomSubject(
        [1, 2, 3, 4, 5],
        (dia) => ['Matemática', 'Português', 'Educação Física', 'História', 'Ciências'][dia % 5]!,
      ),
    ),
  ),
)
cases.push(
  testCase(
    'subject name in French',
    render(withCustomSubject([1, 2], (dia, i) => ['Mathématiques', 'Français', 'Histoire'][i % 3]!)),
  ),
)

// ─── 12. Subject casing ───────────────────────────────────────────────────────

cases.push(testCase('subject entirely uppercase', render(defaultWeek(), { subjectCasing: 'upper' })))
cases.push(testCase('subject entirely lowercase', render(defaultWeek(), { subjectCasing: 'lower' })))
cases.push(
  testCase(
    'subject in mixed case, the way a person typed it',
    render(withCustomSubject([1, 2, 3], (dia, i) => ['MateMÁtica', 'ingLÊS', 'Artes'][i % 3]!)),
  ),
)

// ─── 13. Merged cell repeated horizontally ───────────────────────────────────

cases.push(
  testCase(
    'two-day block, same subject (a merged cell exported with the text repeated)',
    render(
      withCustomSubject([1, 2, 3, 4, 5], (dia, i) => (i === 0 && (dia === 1 || dia === 2) ? 'PROJETO' : ['MAT', 'POR', 'GEO'][i % 3]!)),
    ),
  ),
)
cases.push(
  testCase(
    'workshop spanning three days in the same merged cell',
    render(withCustomSubject([2, 3, 4, 5], (dia, i) => (i === 1 && dia >= 2 && dia <= 4 ? 'OFICINA' : ['HIS', 'ING'][i % 2]!))),
  ),
)

// ─── 14. Same subject across two consecutive rows (double period) ───────────

cases.push(
  testCase(
    'double period: same subject in two consecutive periods of the same day',
    render(withCustomSubject([1, 2, 3], (dia, i) => (dia === 1 && (i === 0 || i === 1) ? 'REDAÇÃO' : ['GEO', 'HIS', 'ART'][i % 3]!))),
  ),
)
cases.push(
  testCase(
    'double period at the end of the day',
    render(withCustomSubject([1, 2], (dia, i) => (dia === 2 && (i === 1 || i === 2) ? 'LABORATÓRIO' : ['MAT', 'POR'][i % 2]!))),
  ),
)

// ─── 15. Scattered no-class cells (not a whole break row) ───────────────────

function noClassCase(name: string, texto: string, periodIdx: number, dia: number): CorpusCase {
  return testCase(name, render(defaultWeek([1, 2, 3]), { noClassCells: [{ periodIdx, dia, texto }] }))
}

cases.push(noClassCase('a plain hyphen cell in the middle of the grid', '-', 1, 2))
cases.push(noClassCase('an em dash cell in the middle of the grid', '—', 0, 1))
cases.push(noClassCase('a middle-dot cell in the middle of the grid', '·', 2, 3))
cases.push(noClassCase('a "free" cell in the middle of the grid', 'livre', 1, 1))
cases.push(noClassCase('a "VACANT" cell in the middle of the grid', 'VAGO', 0, 3))
cases.push(noClassCase('a completely empty cell in the middle of the grid', '', 2, 2))

// ─── 16. Interaction matrix: day style × schedule position × week length ────

const STYLES_FOR_MATRIX: DayLabelStyle[] = ['ptAbbr3', 'english', 'spanishAbbr']
const POSITIONS_FOR_MATRIX: SchedulePosition[] = ['start', 'end', 'startOnly']
const WEEKS_FOR_MATRIX: number[][] = [
  [1, 2, 3, 4, 5],
  [1, 2, 3, 4, 5, 6],
]

for (const style of STYLES_FOR_MATRIX) {
  for (const position of POSITIONS_FOR_MATRIX) {
    for (const dias of WEEKS_FOR_MATRIX) {
      cases.push(
        testCase(
          `interaction: ${style} weekday, ${position} schedule, ${dias.length} days`,
          render(defaultWeek(dias), { dayLabelStyle: style, schedulePosition: position }),
        ),
      )
    }
  }
}

// ─── 17. Hand-written cases: structurally different shapes ──────────────────

// 17.1 — transposed table: days in ROWS, times in COLUMNS.
// A normal header has 1 weekday per row, never 2+ — the reader finds no
// header at all and returns empty, and it's that emptiness that triggers
// the model.
{
  const base = render(defaultWeek())
  cases.push({
    name: 'transposed table (days in the row, time in the column) — needs the model',
    table: transpose(base.table),
    expected: base.expected,
    readableByAlgorithm: false,
    shouldBeFlagged: true,
  })
}

// 17.2 — shifted columns: a cell slipped into the neighboring column on one
// row. This is indistinguishable from a day that's legitimately shorter
// without an outside reference for the grid — a KNOWN blind spot,
// documented in the report, not "fixed" with a heuristic (a sound heuristic
// here would just as loudly flag any day with fewer lessons than the
// others).
{
  const base = render(defaultWeek())
  const table = base.table.map((r) => [...r])
  // The 2nd-period row: row 0 is the header, row 1 is period 0, row 2 is
  // period 1 — no title rows in this fixture.
  const targetRow = 2
  const withoutTime = table[targetRow]!.slice(1) // drop the schedule column
  const shifted = ['', ...withoutTime.slice(0, -1)] // push everything 1 column right, drop the last
  table[targetRow] = [table[targetRow]![0]!, ...shifted]
  cases.push({
    name: 'shifted columns on one row (a cell slipped to its neighbor) — known blind spot',
    table,
    expected: base.expected,
    readableByAlgorithm: false,
    shouldBeFlagged: false,
  })
}

// 17.3 — OCR-mangled time with a one-digit minute: "8:5 - 9:40".
{
  const table = [
    ['', 'SEG', 'TER'],
    ['7:25 - 8:10', 'MAT', 'POR'],
    ['8:10 - 8:55', 'GEO', 'HIS'],
    ['8:5 - 9:40', 'ART', 'EDF'], // "8:5" should read as "08:05" — truncated minute
  ]
  cases.push(
    testCase('time with a minute truncated by OCR ("8:5")', {
      table,
      expected: [
        { diaSemana: 1, inicio: '07:25', fim: '08:10', materia: 'MAT' },
        { diaSemana: 2, inicio: '07:25', fim: '08:10', materia: 'POR' },
        { diaSemana: 1, inicio: '08:10', fim: '08:55', materia: 'GEO' },
        { diaSemana: 2, inicio: '08:10', fim: '08:55', materia: 'HIS' },
        { diaSemana: 1, inicio: '08:05', fim: '09:40', materia: 'ART' },
        { diaSemana: 2, inicio: '08:05', fim: '09:40', materia: 'EDF' },
      ],
    }),
  )
}

// 17.4 — throw everything in: title, ordinal weekday, dotted time, break,
// and a blank row. This is the table that looks the most like an actual
// photo someone sends.
cases.push(
  testCase(
    'mix: title + ordinal weekday + dotted time + break + blank row',
    render(defaultWeek([1, 2, 3, 4, 5]), {
      titleRows: ['Model School — 9th grade schedule'],
      dayLabelStyle: 'ptOrdinalFeira',
      timeFormat: { mark: '.', separator: ' às ', leadingZero: false },
      breakAfter: { indice: 1, label: 'INTERVALO', durationMin: 15 },
      blankRowAfter: 2,
    }),
  ),
)

// 17.5 — mix 2: 6 days, Spanish, extra column, space noise, start-only time.
cases.push(
  testCase(
    'mix: 6 days + Spanish + extra column + space noise + start-only time',
    render(defaultWeek([1, 2, 3, 4, 5, 6]), {
      dayLabelStyle: 'spanish',
      extraColumn: 'Period',
      spaceNoise: true,
      schedulePosition: 'startOnly',
    }),
  ),
)

// 17.6 — mix 3, no time at all + 2 days: needs the model even with little
// text to confuse it.
cases.push(
  testCase(
    'mix: 2 days + only a period label, no time — needs the model',
    render(defaultWeek([3, 5]), { schedulePosition: 'none', titleRows: ['Technical course — module 2'] }),
    false,
  ),
)

// 17.7 — header in the MIDDLE of the table, because the school's real
// "schedule matrix" has a legend of abbreviations BEFORE it and a remark
// AFTER it.
{
  const base = render(defaultWeek())
  const table = [
    ['Legend: MAT=Math, POR=Portuguese, GEO=Geography'],
    ['', '', '', '', ''],
    ...base.table,
    ['', '', '', '', ''],
    ['Note: schedule subject to change'],
  ]
  cases.push(testCase('header in the middle: legend before, note after', { table, expected: base.expected }))
}

// ─── 18. A few more shapes, to close out the count ───────────────────────────

// 18.1 — header weekdays in UPPERCASE, subject in lowercase: the casing
// contrast between header and body is common in an exported spreadsheet.
cases.push(
  testCase(
    'weekday uppercase, subject lowercase — exported spreadsheet',
    render(defaultWeek(), { dayCasing: 'upper', subjectCasing: 'lower' }),
  ),
)

// 18.2 — schedule column at the end, 4-day week, weekday in Spanish.
cases.push(
  testCase(
    'schedule at the end + 4 days + Spanish',
    render(defaultWeek([1, 2, 4, 5]), { schedulePosition: 'end', dayLabelStyle: 'spanish' }),
  ),
)

// 18.3 — only 2 periods a day (short course), start-only time.
cases.push(
  testCase(
    '2 periods a day, start-only time',
    render({ dias: [1, 3, 5], periodos: PERIODS.slice(0, 2), materia: (dia, i) => ['MAT', 'POR'][i]! }, { schedulePosition: 'startOnly' }),
  ),
)

// 18.4 — 5 periods a day (full-time school).
cases.push(
  testCase(
    '5 periods a day, full-time school',
    render(
      {
        dias: [1, 2, 3, 4, 5],
        periodos: [
          { inicio: '07:00', fim: '07:50' },
          { inicio: '07:50', fim: '08:40' },
          { inicio: '08:40', fim: '09:30' },
          { inicio: '09:50', fim: '10:40' },
          { inicio: '10:40', fim: '11:30' },
        ],
        materia: (dia, i) => ['MAT', 'POR', 'GEO', 'HIS', 'CIE', 'ART', 'EDF', 'ING'][(dia + i) % 8]!,
      },
      {},
    ),
  ),
)

// 18.5 — lunch splitting the day, but with the schedule column at the end.
cases.push(
  testCase(
    'lunch splitting the day, schedule column at the end',
    render(
      { dias: [1, 2, 3], periodos: PERIODS, materia: (dia, i) => ['MAT', 'POR', 'GEO'][(dia + i) % 3]! },
      { schedulePosition: 'end', breakAfter: { indice: 1, label: 'ALMOÇO', durationMin: 60 } },
    ),
  ),
)

// 18.6 — "Break" in mixed case, more than once in the same week (morning and
// afternoon).
cases.push(
  testCase(
    'two breaks in the same week (morning and afternoon)',
    render(
      {
        dias: [1, 2, 3, 4, 5],
        periodos: [
          { inicio: '07:25', fim: '08:10' },
          { inicio: '08:10', fim: '08:55' },
          { inicio: '09:10', fim: '09:55' },
          { inicio: '09:55', fim: '10:40' },
        ],
        materia: (dia, i) => ['MAT', 'POR', 'GEO', 'HIS'][(dia + i) % 4]!,
      },
      { breakAfter: { indice: 1, label: 'Intervalo', durationMin: 15 } },
    ),
  ),
)

// 18.7 — two-letter subject names, to confirm "AR", "EF" don't trip the
// single-letter filter or the no-class filter.
cases.push(
  testCase(
    'two-letter subjects (AR, EF, ID)',
    render(withCustomSubject([1, 2, 3], (dia, i) => ['AR', 'EF', 'ID'][i % 3]!)),
  ),
)

// 18.8 — full weekday name with a hyphen built in ("Segunda-feira") and the
// schedule column at the end, at the same time — a combination not covered
// elsewhere.
cases.push(
  testCase(
    'full weekday name with hyphen, schedule at the end',
    render(withCustomSubject([1, 2, 3, 4, 5], (dia, i) => ['MAT', 'POR', 'GEO'][(dia + i) % 3]!), {
      dayLabelStyle: 'ptFull',
      schedulePosition: 'end',
    }),
  ),
)

// 18.9 — 3 non-consecutive days a week (Tuesday, Thursday, Saturday — an
// evening/weekend elective).
cases.push(testCase('3 non-consecutive days a week (Tuesday, Thursday, Saturday)', render(defaultWeek([2, 4, 6]))))

export const CORPUS: CorpusCase[] = cases
