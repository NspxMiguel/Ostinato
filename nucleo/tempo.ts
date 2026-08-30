// Datas, sem armadilha de fuso.
//
// A regra deste arquivo: TODA conta de calendário é feita em data civil
// ("2026-09-03"), com aritmética de dias inteiros, sem passar por `Date`. Só na
// hora de virar um instante de verdade — para agendar uma notificação — é que a
// data civil vira `Date`, no fuso do aparelho.
//
// O motivo é horário de verão: somar 24h a um `Date` no dia da virada dá 23h ou
// 25h, e a tarefa aparece no dia errado. Somar 1 a um número de dias nunca erra.

import type { DataISO, DiaSemana, Hora } from './modelo.ts'

/** Dias desde 1970-01-01, pelo algoritmo de calendário proléptico gregoriano. */
export function diasDesdeEpoca(iso: DataISO): number {
  const [a, m, d] = partes(iso)
  const y = m <= 2 ? a - 1 : a
  const era = Math.floor(y / 400)
  const anoDaEra = y - era * 400
  const diaDoAno = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const diaDaEra = anoDaEra * 365 + Math.floor(anoDaEra / 4) - Math.floor(anoDaEra / 100) + diaDoAno
  return era * 146097 + diaDaEra - 719468
}

/** O caminho de volta. */
export function dataDeDias(dias: number): DataISO {
  let z = dias + 719468
  const era = Math.floor(z / 146097)
  const diaDaEra = z - era * 146097
  const anoDaEra = Math.floor(
    (diaDaEra - Math.floor(diaDaEra / 1460) + Math.floor(diaDaEra / 36524) - Math.floor(diaDaEra / 146096)) / 365,
  )
  const y = anoDaEra + era * 400
  const diaDoAno = diaDaEra - (365 * anoDaEra + Math.floor(anoDaEra / 4) - Math.floor(anoDaEra / 100))
  const mp = Math.floor((5 * diaDoAno + 2) / 153)
  const d = diaDoAno - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp + (mp < 10 ? 3 : -9)
  return montar(m <= 2 ? y + 1 : y, m, d)
}

function partes(iso: DataISO): [number, number, number] {
  const a = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  return [a, m, d]
}

function doisDigitos(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function montar(a: number, m: number, d: number): DataISO {
  return `${a}-${doisDigitos(m)}-${doisDigitos(d)}`
}

/** A data civil de um instante, no fuso do aparelho. */
export function dataDe(d: Date): DataISO {
  return montar(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** A hora "HH:MM" de um instante, no fuso do aparelho. */
export function horaDe(d: Date): Hora {
  return `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`
}

export function somarDias(iso: DataISO, n: number): DataISO {
  return dataDeDias(diasDesdeEpoca(iso) + n)
}

export function diferencaEmDias(de: DataISO, ate: DataISO): number {
  return diasDesdeEpoca(ate) - diasDesdeEpoca(de)
}

/** 0 = domingo. 1970-01-01 foi quinta (4), daí o deslocamento. */
export function diaSemanaDe(iso: DataISO): DiaSemana {
  const n = (((diasDesdeEpoca(iso) + 4) % 7) + 7) % 7
  return n as DiaSemana
}

/** Minutos desde a meia-noite. Aceita "7:00", "07:00", "07h00", "7h" e "0700". */
export function minutosDaHora(h: Hora): number {
  const limpo = h.trim().toLowerCase().replace(/\s/g, '')
  const m = limpo.match(/^(\d{1,2})(?::|h|)(\d{2})?/)
  if (!m) return 0
  const hh = Number(m[1] ?? 0)
  const mm = Number(m[2] ?? 0)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  return Math.min(23, hh) * 60 + Math.min(59, mm)
}

export function horaDeMinutos(min: number): Hora {
  const m = ((min % 1440) + 1440) % 1440
  return `${doisDigitos(Math.floor(m / 60))}:${doisDigitos(m % 60)}`
}

/**
 * Data civil + hora -> instante, no fuso do aparelho.
 *
 * No dia em que o relógio adianta, a hora escolhida pode não existir (no Brasil,
 * quando havia horário de verão, a meia-noite virava 1h). O JS normaliza para a
 * hora seguinte, que é o comportamento certo aqui: o aviso dispara assim que
 * aquele instante passa a existir, em vez de sumir.
 */
export function instante(iso: DataISO, hora: Hora = '00:00'): Date {
  const [a, m, d] = partes(iso)
  const min = minutosDaHora(hora)
  return new Date(a, m - 1, d, Math.floor(min / 60), min % 60, 0, 0)
}

export function entre(iso: DataISO, de: DataISO, ate: DataISO): boolean {
  const n = diasDesdeEpoca(iso)
  return n >= diasDesdeEpoca(de) && n <= diasDesdeEpoca(ate)
}
