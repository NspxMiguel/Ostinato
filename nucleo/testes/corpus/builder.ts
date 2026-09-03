// The corpus's table factory.
//
// Every table in the corpus is born from ONE canonical specification (which
// days, which time slots, which subject in each cell) rendered in different
// ways — header on another line, weekday written in another style, a
// different hour separator, a schedule column with only the start time, and
// so on. Building the table AND the expected result from the SAME
// specification is what guarantees the two never drift apart: the expected
// list isn't typed by hand, it's derived.

export type ExpectedLesson = {
  diaSemana: number
  inicio: string
  fim: string
  materia: string
}

export type Period = { inicio: string; fim: string }

export type DayLabelStyle =
  | 'ptFull'
  | 'ptAbbr3'
  | 'ptAbbrDot'
  | 'ptOrdinal'
  | 'ptOrdinalFeira'
  | 'english'
  | 'englishAbbr'
  | 'spanish'
  | 'spanishAbbr'

export type Casing = 'asIs' | 'upper' | 'lower'

const DAY_LABELS: Record<DayLabelStyle, string[]> = {
  // index 0 = Sunday ... 6 = Saturday, same numbering as the rest of the app.
  ptFull: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  ptAbbr3: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  ptAbbrDot: ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'],
  ptOrdinal: ['', '2ª', '3ª', '4ª', '5ª', '6ª', ''],
  ptOrdinalFeira: ['', '2ª-feira', '3ª-feira', '4ª-feira', '5ª-feira', '6ª-feira', ''],
  english: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  englishAbbr: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  spanish: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  spanishAbbr: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
}

function applyCasing(texto: string, casing: Casing): string {
  if (casing === 'upper') return texto.toUpperCase()
  if (casing === 'lower') return texto.toLowerCase()
  return texto
}

function dayLabel(dia: number, style: DayLabelStyle, casing: Casing): string {
  return applyCasing(DAY_LABELS[style][dia]!, casing)
}

/** How a cell's two times are written. */
export type TimeFormat = {
  /** ":" (07:25), "h" (7h25) or "." (7.25). */
  mark: ':' | 'h' | '.'
  /** What separates start and end inside the cell. */
  separator: '-' | '–' | '—' | ' às ' | ' a ' | ' até '
  /** Leading zero on the hour ("07") or none ("7"). */
  leadingZero: boolean
}

const DEFAULT_TIME_FORMAT: TimeFormat = { mark: ':', separator: '-', leadingZero: true }

function timeAs(hhmm: string, format: TimeFormat): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const hour = format.leadingZero ? String(h).padStart(2, '0') : String(h)
  return `${hour}${format.mark}${String(m).padStart(2, '0')}`
}

function timeCell(p: Period, format: TimeFormat): string {
  return `${timeAs(p.inicio, format)}${format.separator}${timeAs(p.fim, format)}`
}

/** Where the schedule column sits, or whether it exists at all. */
export type SchedulePosition =
  | 'start'
  | 'end'
  /** Only the start of each period; the end is the next row's start. */
  | 'startOnly'
  /** No time at all — just the period label ("1st period"). This needs the model. */
  | 'none'

export type WeekSpec = {
  /** Days present, in column order. */
  dias: number[]
  periodos: Period[]
  /** The subject for each (day, period) — the exact text that must come back out. */
  materia: (dia: number, periodIdx: number) => string
}

export type RenderOptions = {
  dayLabelStyle?: DayLabelStyle
  dayCasing?: Casing
  subjectCasing?: Casing
  schedulePosition?: SchedulePosition
  timeFormat?: TimeFormat
  /** Title rows before the header, e.g. ["", "SCHEDULE: 9th grade A"]. */
  titleRows?: string[]
  /** Extra column with no day at all (room, teacher), always at the end. */
  extraColumn?: string
  /** Double space and trailing space inside cells. */
  spaceNoise?: boolean
  /** Inserts one fully blank row after this period index. */
  blankRowAfter?: number
  /** Inserts a break row (no subject, "BREAK" cell) after this period. */
  breakAfter?: { indice: number; label: string; durationMin: number }
  /**
   * Replaces the cell at this (period, day) with the given text — "-",
   * "VACANT", "free" — instead of whatever the spec would put there. Does
   * not count as a lesson: it disappears from the expected list too.
   */
  noClassCells?: { periodIdx: number; dia: number; texto: string }[]
}

const DEFAULTS: Required<
  Pick<RenderOptions, 'dayLabelStyle' | 'dayCasing' | 'subjectCasing' | 'schedulePosition' | 'timeFormat'>
> = {
  dayLabelStyle: 'ptAbbr3',
  dayCasing: 'asIs',
  subjectCasing: 'asIs',
  schedulePosition: 'start',
  timeFormat: DEFAULT_TIME_FORMAT,
}

function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const total = h * 60 + m + min
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Renders the specification into a table, and hands back the expected result too. */
export function render(spec: WeekSpec, options: RenderOptions = {}): { table: string[][]; expected: ExpectedLesson[] } {
  const o = { ...DEFAULTS, ...options }

  const hasScheduleColumn = o.schedulePosition !== 'none'
  const columns: ({ kind: 'schedule' } | { kind: 'day'; dia: number } | { kind: 'extra' })[] = []
  if (hasScheduleColumn && (o.schedulePosition === 'start' || o.schedulePosition === 'startOnly')) {
    columns.push({ kind: 'schedule' })
  }
  for (const d of spec.dias) columns.push({ kind: 'day', dia: d })
  if (hasScheduleColumn && o.schedulePosition === 'end') columns.push({ kind: 'schedule' })
  if (!hasScheduleColumn) columns.unshift({ kind: 'schedule' }) // period label, no clock time
  if (o.extraColumn) columns.push({ kind: 'extra' })

  const width = columns.length
  const blankRow = (): string[] => new Array(width).fill('')

  const table: string[][] = []
  for (const t of o.titleRows ?? []) {
    const row = blankRow()
    row[0] = t
    table.push(row)
  }

  const header = blankRow()
  columns.forEach((c, i) => {
    if (c.kind === 'day') header[i] = dayLabel(c.dia, o.dayLabelStyle, o.dayCasing)
    else if (c.kind === 'extra') header[i] = o.extraColumn!
    else header[i] = hasScheduleColumn ? 'Time' : 'Period'
  })
  table.push(header)

  const withNoise = (texto: string): string => (o.spaceNoise ? `  ${texto}  ` : texto)

  const expected: ExpectedLesson[] = []

  spec.periodos.forEach((p, periodIdx) => {
    const row = blankRow()
    columns.forEach((c, i) => {
      if (c.kind === 'schedule') {
        if (o.schedulePosition === 'none') {
          row[i] = `${periodIdx + 1}º tempo`
        } else if (o.schedulePosition === 'startOnly') {
          row[i] = timeAs(p.inicio, o.timeFormat)
        } else {
          row[i] = timeCell(p, o.timeFormat)
        }
      } else if (c.kind === 'day') {
        const override = o.noClassCells?.find((s) => s.periodIdx === periodIdx && s.dia === c.dia)
        if (override) {
          row[i] = withNoise(override.texto)
        } else {
          const texto = applyCasing(spec.materia(c.dia, periodIdx), o.subjectCasing)
          row[i] = withNoise(texto)
          expected.push({ diaSemana: c.dia, inicio: p.inicio, fim: p.fim, materia: texto })
        }
      } else {
        row[i] = 'Mr. Smith'
      }
    })
    table.push(row)

    if (o.blankRowAfter === periodIdx) table.push(blankRow())

    if (o.breakAfter?.indice === periodIdx) {
      const b = o.breakAfter
      const breakStart = p.fim
      const breakEnd = addMinutes(breakStart, b.durationMin)
      const breakRow = blankRow()
      columns.forEach((c, i) => {
        if (c.kind === 'schedule') {
          if (o.schedulePosition === 'none') breakRow[i] = 'Break'
          else if (o.schedulePosition === 'startOnly') breakRow[i] = timeAs(breakStart, o.timeFormat)
          else breakRow[i] = `${timeAs(breakStart, o.timeFormat)}${o.timeFormat.separator}${timeAs(breakEnd, o.timeFormat)}`
        } else if (c.kind === 'day') {
          breakRow[i] = b.label
        }
      })
      table.push(breakRow)
    }
  })

  // "Start only" schedule column: closes the last row with the final time,
  // no subject — that's the mark this style always leaves on paper.
  if (o.schedulePosition === 'startOnly') {
    const last = spec.periodos[spec.periodos.length - 1]!
    const row = blankRow()
    columns.forEach((c, i) => {
      if (c.kind === 'schedule') row[i] = timeAs(last.fim, o.timeFormat)
    })
    table.push(row)
  }

  return { table, expected }
}

/** Transposes: days become a row, time becomes a column — the classic case that needs the model. */
export function transpose(table: readonly (readonly string[])[]): string[][] {
  const rows = table.length
  const cols = table[0]?.length ?? 0
  const t: string[][] = []
  for (let c = 0; c < cols; c++) {
    const row: string[] = []
    for (let r = 0; r < rows; r++) row.push(table[r]![c] ?? '')
    t.push(row)
  }
  return t
}

/** A default week specification, ready to vary on top of. */
export function defaultWeek(dias: number[] = [1, 2, 3, 4, 5]): WeekSpec {
  const subjects = ['MAT', 'POR', 'GEO', 'HIS', 'CIE', 'ART', 'EDF', 'ING', 'FIS', 'INF', 'ESP', 'FIL']
  const periodos: Period[] = [
    { inicio: '07:25', fim: '08:10' },
    { inicio: '08:10', fim: '08:55' },
    { inicio: '08:55', fim: '09:40' },
  ]
  return {
    dias,
    periodos,
    materia: (dia, periodIdx) => subjects[(dia * 3 + periodIdx) % subjects.length]!,
  }
}
