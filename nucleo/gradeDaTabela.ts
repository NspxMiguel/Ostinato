// A grade em tabela vira aulas, sem modelo nenhum.
//
// Isto existe por uma MEDIÇÃO, e não por palpite. Depois de errar três vezes no
// escuro, rodei o Vision na foto do horário dele e olhei a saída crua: as
// colunas saem limpas e bem separadas — SEG em x=0,29, TER em 0,43, QUA em
// 0,57, QUI em 0,72, SEX em 0,87 — e a reconstrução por coordenadas devolve a
// grade certa, linha por linha.
//
// Ou seja: o modelo estava compensando uma entrada que eu tinha quebrado. Com a
// grade correta, um horário escolar é a coisa mais determinística que existe —
// uma linha de cabeçalho com os dias, uma coluna de horários, e o resto são
// células. Regra fechada resolve, e resolve igual todas as vezes.
//
// O modelo continua existindo para a grade que não tem essa forma. Mas ele
// deixa de ser o caminho normal, porque para o caminho normal ele é pior: mais
// lento, e capaz de inventar.

import type { AulaCrua } from './importarGrade.ts'

/** Os dias da semana como as escolas escrevem, nos quatro idiomas do app. */
const DIAS: [RegExp, number][] = [
  [/^(dom|sun|domingo|sunday|dim)/i, 0],
  [/^(seg|mon|segunda|monday|lun)/i, 1],
  [/^(ter|tue|terca|terça|tuesday|mar)/i, 2],
  [/^(qua|wed|quarta|wednesday|mie|mié|mer)/i, 3],
  [/^(qui|thu|quinta|thursday|jue|jeu)/i, 4],
  [/^(sex|fri|sexta|friday|vie|ven)/i, 5],
  [/^(sab|sáb|sat|sabado|sábado|saturday|sam)/i, 6],
  // Ordinal weekday notation from the Brazilian school calendar ("2ª",
  // "2ª-feira" = Monday, … "6ª-feira" = Friday). It is not an abbreviation
  // of a name, so it needs its own pattern instead of joining the prefixes
  // above. Saturday and Sunday are not written this way, so they're absent.
  [/^2\s*[ªaº°]/i, 1],
  [/^3\s*[ªaº°]/i, 2],
  [/^4\s*[ªaº°]/i, 3],
  [/^5\s*[ªaº°]/i, 4],
  [/^6\s*[ªaº°]/i, 5],
]

function diaDe(texto: string): number | null {
  const t = texto.trim()
  if (t === '') return null
  for (const [re, n] of DIAS) if (re.test(t)) return n
  return null
}

/**
 * Duas horas numa célula: "07:25-08:00", "07:25 - 08:00", "7h25 às 8h",
 * "7.30 - 8.15".
 *
 * The mark between hour and minute is ":", "h"/"H" or "." — the dot is what
 * shows up when a spreadsheet exports the time as a decimal number, or when
 * someone writes it by hand the European way.
 *
 * The separator BETWEEN the two times is anything that isn't a digit or a
 * time mark — in OCR it comes as a hyphen, an em dash, "às", "até", or it
 * disappears along with a lost space.
 *
 * The minute accepts a single digit too ("8:0" → "08:00"), for the same
 * reason the hour was already zero-padded: a swallowed digit is the OCR's
 * most common bite, and a one-digit minute only makes sense read as
 * zero-padded.
 */
const TIME_PATTERN = /(\d{1,2})\s*[:hH.]\s*(\d{1,2})\b/g

export function horasDaCelula(texto: string): { inicio: string; fim: string } | null {
  const achadas = [...texto.matchAll(TIME_PATTERN)].map(
    (m) => `${String(Number(m[1])).padStart(2, '0')}:${String(Number(m[2])).padStart(2, '0')}`,
  )
  if (achadas.length < 2) return null
  return { inicio: achadas[0]!, fim: achadas[1]! }
}

/** A single time in the cell — for rows that only carry a start or an end. */
function umaHoraDaCelula(texto: string): string | null {
  const m = new RegExp(TIME_PATTERN.source).exec(texto)
  return m ? `${String(Number(m[1])).padStart(2, '0')}:${String(Number(m[2])).padStart(2, '0')}` : null
}

/**
 * A cell with no class in it: empty, punctuation standing in for a blank
 * line on paper, or one of the words a school uses to say "nothing happens
 * here" — break, recess, lunch, free, vacant. None of those is a subject,
 * and counting them as one invents a discipline that doesn't exist.
 */
const NO_CLASS_CELL = /^(?:[-–—.·]+|livre|vago|vaga|intervalo|recreio|almoco|almoço)$/i

function cellHasNoClass(texto: string): boolean {
  const t = texto.trim()
  return t === '' || NO_CLASS_CELL.test(t)
}

/** Onde estão os dias: a linha com mais nomes de dia da semana. */
function linhaDoCabecalho(tabela: readonly (readonly string[])[]): number {
  let melhor = -1
  let quantos = 0
  tabela.forEach((linha, i) => {
    const n = linha.filter((c) => diaDe(c) !== null).length
    if (n > quantos) {
      quantos = n
      melhor = i
    }
  })
  // Menos de dois dias não é cabeçalho: é uma célula que por acaso começa com
  // "seg" — "seguranca do trabalho" é matéria de verdade em escola técnica.
  return quantos >= 2 ? melhor : -1
}

/** A row's time signal: an explicit pair, or a lone time to complete later. */
type RowTime = { index: number; pair: { inicio: string; fim: string } | null; loose: string | null }

/**
 * Lê a grade. Devolve vazio quando ela não tem a forma de horário — e aí quem
 * chama passa a bola para o modelo.
 */
export function aulasDaTabela(tabela: readonly (readonly string[])[]): AulaCrua[] {
  const cabecalho = linhaDoCabecalho(tabela)
  if (cabecalho < 0) return []

  // Que coluna é que dia. A coluna do horário fica de fora naturalmente: ela
  // não casa com nenhum nome de dia.
  const diaDaColuna = new Map<number, number>()
  tabela[cabecalho]!.forEach((c, i) => {
    const d = diaDe(c)
    if (d !== null) diaDaColuna.set(i, d)
  })

  // First pass: what each data row HAS in the way of a time — an explicit
  // pair, or just a lone time. Resolving a lone time needs looking at a
  // neighboring row, which is why it waits for the second pass.
  const rowTimes: RowTime[] = []
  for (let i = cabecalho + 1; i < tabela.length; i++) {
    const linha = tabela[i]!
    const pair = linha.map(horasDaCelula).find((h) => h !== null) ?? null
    const loose = pair ? null : (linha.map(umaHoraDaCelula).find((h) => h !== null) ?? null)
    if (pair || loose) rowTimes.push({ index: i, pair, loose })
  }

  const saida: AulaCrua[] = []
  let ultimoFim: string | null = null
  for (let k = 0; k < rowTimes.length; k++) {
    const row = rowTimes[k]!
    let horas = row.pair

    if (!horas && row.loose) {
      // Two possible readings for a lone time, tried in this order:
      //
      // 1. It's the END of a row whose START the OCR ate — in the photo he
      //    sent, "08:00 - 08:45" arrived as ":00 - 08:45". Tried first
      //    because it's the measured real-world case, and because a lone
      //    time greater than the previous end is a strong signal: school
      //    periods are contiguous.
      if (ultimoFim && row.loose > ultimoFim) {
        horas = { inicio: ultimoFim, fim: row.loose }
      } else {
        // 2. It's the START, and the end is the START of the NEXT row —
        //    this is the schedule column that only ever prints "07:25",
        //    "08:10", "08:55", once per row, and the final row (with no
        //    subject cells) exists only to mark where the day ends.
        //    Without looking ahead, this whole column disappears silently:
        //    its first row never has an `ultimoFim` to inherit from.
        const nextRow = rowTimes[k + 1]
        const nextStart = nextRow ? (nextRow.pair?.inicio ?? nextRow.loose) : null
        if (nextStart && nextStart > row.loose) {
          horas = { inicio: row.loose, fim: nextStart }
        }
      }
    }
    if (!horas) continue
    ultimoFim = horas.fim

    const rowCells = tabela[row.index]!
    for (const [coluna, dia] of diaDaColuna) {
      const materia = (rowCells[coluna] ?? '').trim()
      if (cellHasNoClass(materia)) continue
      saida.push({
        diaSemana: dia as AulaCrua['diaSemana'],
        inicio: horas.inicio as AulaCrua['inicio'],
        fim: horas.fim as AulaCrua['fim'],
        materia,
        confianca: 1,
      })
    }
  }
  return saida
}
