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

const DIAS_DA_SEMANA = /^(dom|seg|ter|qua|qui|sex|sab|sun|mon|tue|wed|thu|fri|sat)\b/

/**
 * O mês, quando a linha COMEÇA por ele.
 *
 * Começar é o teste, e não "conter": no calendário de verdade o cabeçalho vem
 * como `FEVEREIRO - 18 (F2/EM) e 17 (F1) Dom Seg ...`, com sujeira depois — e
 * "Festa de julho" contém um mês sem ser cabeçalho de nada. Exigir a linha
 * inteira perderia o primeiro caso; aceitar em qualquer posição estragaria o
 * segundo, jogando o calendário inteiro para julho.
 */
function mesNoInicio(linha: string): number | null {
  const t = normal(linha).trimStart()
  for (const [nome, n] of Object.entries(MESES)) {
    if (t.startsWith(nome)) return n
  }
  return null
}

/**
 * O que vem DEPOIS da fila de dias da semana.
 *
 * Ela não aparece só no começo: o cabeçalho real é
 * `FEVEREIRO - 18 (F2/EM) e 17 (F1) Dom Seg Ter Qua Qui Sex Sáb 2 Início das
 * aulas…`, com a fila no meio e o evento depois dela. Cortar só o começo
 * deixaria "Dom Seg Ter…" no caminho e a linha inteira seria descartada.
 *
 * Corta no ÚLTIMO nome de dia da semana, porque é ele que fecha a fila.
 */
function depoisDosDiasDaSemana(resto: string): string {
  const partes = resto.split(/\s+/)
  let ultimo = -1
  for (let i = 0; i < partes.length; i++) {
    if (DIAS_DA_SEMANA.test(normal(partes[i] ?? ''))) ultimo = i
  }
  return ultimo === -1 ? resto.trim() : partes.slice(ultimo + 1).join(' ').trim()
}

type Prefixo = { dia: number; ate: number; descricao: string } | null

const CONECTIVO = /^(a|à|ate|até|e|-|–|—)$/i

/**
 * Separa o dia do texto, atravessando a grade do mês.
 *
 * Uma linha copiada do PDF vem assim:
 *
 *     4 5 6 7 8 9 10 12 13 14 15 16 17 11 18 25 7 Retorno zeladores
 *
 * Os números da frente são a gradinha do calendário, impressa ao lado na mesma
 * altura. O dia do evento é o ÚLTIMO número antes do texto — pegar o primeiro
 * daria 4, e o evento inteiro cairia no dia errado.
 *
 * Número com marcador ordinal encerra a contagem sem entrar nela: em
 * `16 a 18 98º Seminário`, o `98º` é parte do título, e o dia é o 18.
 */
function separarDia(linha: string): Prefixo {
  const partes = linha.trim().split(/\s+/)
  const numeros: number[] = []
  let i = 0

  for (; i < partes.length; i++) {
    const bruto = partes[i] ?? ''
    if (/^\d{1,2}$/.test(bruto)) {
      const n = Number(bruto)
      if (n < 1 || n > 31) break
      numeros.push(n)
      continue
    }
    // Conectivo só vale com número dos dois lados; senão é palavra do título.
    if (CONECTIVO.test(bruto) && numeros.length > 0 && /^\d{1,2}$/.test(partes[i + 1] ?? '')) continue
    break
  }

  const descricao = partes.slice(i).join(' ').trim()
  const dia = numeros[numeros.length - 1]
  if (dia === undefined || descricao.length < 3) return null

  // O intervalo só conta quando o conectivo está entre os DOIS ÚLTIMOS números:
  // em "9 a 13 16 Avaliação", o "9 a 13" é grade e o dia do evento é o 16.
  const penultimo = numeros[numeros.length - 2]
  const antesDoDia = partes[i - 2]
  const ehIntervalo =
    penultimo !== undefined && antesDoDia !== undefined && CONECTIVO.test(antesDoDia) && penultimo < dia

  return ehIntervalo ? { dia: penultimo, ate: dia, descricao } : { dia, ate: dia, descricao }
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
  let ultimoDia: { dia: number; ate: number } | null = null

  for (const bruta of texto.split(/\r?\n/)) {
    let linha = bruta.trim()
    if (linha.length < 3) continue

    const cabecalho = mesNoInicio(linha)
    if (cabecalho) {
      mes = cabecalho
      ultimoDia = null
      // O cabeçalho quase sempre traz um evento grudado; o que sobra depois do
      // nome do mês e da fila de dias da semana ainda pode ser uma linha.
      linha = depoisDosDiasDaSemana(linha.replace(/^\S+/, ''))
    } else {
      linha = depoisDosDiasDaSemana(linha)
    }
    // "19/02 Reunião": a linha traz a própria data e passa a mandar no mês.
    // Não aparece no calendário que motivou este arquivo, mas é como outras
    // escolas escrevem, e reconhecer custa quatro linhas.
    const propria = linha.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s+(.*)$/)
    if (propria) {
      mes = Number(propria[2])
      linha = `${propria[1]} ${propria[3]}`
    }

    if (linha.length < 3 || !mes) continue

    const p = separarDia(linha)
    if (p) {
      ultimoDia = { dia: p.dia, ate: p.ate }
      eventos.push({
        ...classificar(p.descricao),
        inicio: iso(ano, mes, p.dia),
        fim: iso(ano, mes, p.ate),
      })
      continue
    }

    // Linha sem dia é continuação da anterior: o PDF quebra eventos do mesmo dia
    // em várias linhas, e descartá-las perderia metade do calendário.
    if (ultimoDia && /\p{L}{3}/u.test(linha)) {
      eventos.push({
        ...classificar(linha),
        inicio: iso(ano, mes, ultimoDia.dia),
        fim: iso(ano, mes, ultimoDia.ate),
      })
    }
  }

  return eventos
}

/** Todos os dias que um evento ocupa. É o que vira feriado no período letivo. */
export function diasDoEvento(e: EventoLido): DataISO[] {
  const dias: DataISO[] = []
  const [a = 0, m = 1, d1 = 1] = e.inicio.split('-').map(Number)
  const d2 = Number(e.fim.split('-')[2] ?? d1)
  for (let d = d1; d <= d2; d++) dias.push(iso(a, m, d))
  return dias
}
