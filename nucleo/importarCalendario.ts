// O calendário da escola, do texto cru às linhas com data.
//
// A entrada é o que sai de um PDF colado ou de uma foto lida por OCR: linhas
// soltas, quase sempre no formato "<dia> <descrição>", agrupadas debaixo de um
// nome de mês. Nem o dia nem o mês vêm juntos na mesma linha, e é por isso que
// este arquivo existe: o mês é ESTADO, carregado de cima para baixo enquanto se
// lê.
//
// O que ele NÃO faz: decidir o que entra. Isso é do `calendarioEscolar.ts`, e a
// separação é de propósito — aqui é leitura, lá é julgamento, e misturar os dois
// faria cada erro de OCR virar uma decisão errada em vez de uma linha estranha.

import { classificar, type LinhaClassificada } from './calendarioEscolar.ts'
import type { DataISO } from './modelo.ts'

export type EventoLido = LinhaClassificada & {
  /** O primeiro dia. */
  inicio: DataISO
  /** O último, quando a linha diz "21 a 24". Igual a `inicio` quando é um dia só. */
  fim: DataISO
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

function normal(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')

function iso(ano: number, mes: number, dia: number): DataISO {
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}` as DataISO
}

/** O mês citado sozinho numa linha — o cabeçalho de um bloco. */
function mesDaLinha(linha: string): number | null {
  const t = normal(linha).trim()
  for (const [nome, n] of Object.entries(MESES)) {
    // Precisa ser o mês E POUCO MAIS: "julho" é cabeçalho, "Festa de julho" não.
    if (new RegExp(`^${nome}\\b[\\s\\/.,-]*\\d{0,4}$`).test(t)) return n
  }
  return null
}

/**
 * Lê o calendário colado ou fotografado.
 *
 * `ano` vem de fora porque a folha quase nunca repete o ano em cada linha, e
 * adivinhar pelo relógio erraria em dezembro, quando a escola já publicou o
 * calendário do ano seguinte.
 */
export function lerCalendario(texto: string, ano: number): EventoLido[] {
  const eventos: EventoLido[] = []
  let mes: number | null = null

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim()
    if (linha.length < 2) continue

    const cabecalho = mesDaLinha(linha)
    if (cabecalho) {
      mes = cabecalho
      continue
    }

    // "21 a 24 Curso de Estudos" · "7 Retorno zeladores" · "19/02 Reunião"
    const m = linha.match(/^(\d{1,2})(?:\s*(?:a|à|até|-|–|—)\s*(\d{1,2}))?(?:\s*\/\s*(\d{1,2}))?[\s.:)-]+(.{3,})$/)
    if (!m) continue

    const dia = Number(m[1])
    const diaFim = m[2] ? Number(m[2]) : dia
    // "19/02": o segundo número é o mês, e ele manda no estado corrente.
    const mesDaPropriaLinha = m[3] ? Number(m[3]) : null
    const mesValendo = mesDaPropriaLinha ?? mes
    if (!mesValendo || dia < 1 || dia > 31 || diaFim < dia || diaFim > 31) continue
    // Linha com data própria também move o estado: numa folha que mistura
    // "19/02" com dias soltos, o que vem depois pertence a fevereiro.
    mes = mesValendo

    const descricao = m[4].trim()
    eventos.push({
      ...classificar(descricao),
      inicio: iso(ano, mesValendo, dia),
      fim: iso(ano, mesValendo, diaFim),
    })
  }

  return eventos
}

/** Todos os dias que um evento ocupa. É o que vira feriado no período letivo. */
export function diasDoEvento(e: EventoLido): DataISO[] {
  const dias: DataISO[] = []
  const [a, m, d1] = e.inicio.split('-').map(Number)
  const d2 = Number(e.fim.split('-')[2])
  for (let d = d1; d <= d2; d++) dias.push(iso(a, m, d))
  return dias
}
