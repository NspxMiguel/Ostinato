// A grade horária: dado o horário semanal, em que dias a aula realmente acontece.
//
// "Realmente" faz o trabalho todo nesta frase: a aula só vale se o dia cai dentro
// do período letivo, não é feriado, e — na escola que alterna semana A/B — a
// paridade da semana bate.

import type { Aula, Base, DataISO, Materia, Periodo } from './modelo.ts'
import { vivos } from './sync/registro.ts'
import { diaSemanaDe, diasDesdeEpoca, entre, instante, minutosDaHora, somarDias } from './tempo.ts'

/**
 * Em que semana do período aquela data cai. A semana do primeiro dia do período é
 * a 1. Semanas começam no domingo, para que "semana par" seja a mesma coisa para
 * a aula de segunda e a de sexta.
 */
export function semanaDoPeriodo(periodo: Periodo, iso: DataISO): number {
  const domingoDoInicio = somarDias(periodo.inicio, -diaSemanaDe(periodo.inicio))
  const domingoDaData = somarDias(iso, -diaSemanaDe(iso))
  return Math.floor((diasDesdeEpoca(domingoDaData) - diasDesdeEpoca(domingoDoInicio)) / 7) + 1
}

/** A aula acontece nesse dia? */
export function aulaValeNaData(
  aula: Aula,
  periodo: Periodo,
  iso: DataISO,
  inverterSemana = false,
): boolean {
  if (aula.removido) return false
  if (diaSemanaDe(iso) !== aula.diaSemana) return false
  if (!entre(iso, periodo.inicio, periodo.fim)) return false
  if (periodo.feriados.includes(iso)) return false
  if (aula.semana === 'toda') return true

  const ehPar = semanaDoPeriodo(periodo, iso) % 2 === 0
  const querPar = inverterSemana ? aula.semana === 'impar' : aula.semana === 'par'
  return ehPar === querPar
}

/** Todos os dias, no intervalo, em que essa aula acontece. */
export function ocorrenciasDeAula(
  aula: Aula,
  periodo: Periodo,
  de: DataISO,
  ate: DataISO,
  inverterSemana = false,
): DataISO[] {
  const saida: DataISO[] = []
  // Começa no primeiro dia do intervalo que cai no dia da semana da aula.
  const salto = (aula.diaSemana - diaSemanaDe(de) + 7) % 7
  let iso = somarDias(de, salto)
  const limite = diasDesdeEpoca(ate)
  while (diasDesdeEpoca(iso) <= limite) {
    if (aulaValeNaData(aula, periodo, iso, inverterSemana)) saida.push(iso)
    iso = somarDias(iso, 7)
  }
  return saida
}

export type AulaNoDia = { aula: Aula; materia: Materia | undefined; data: DataISO; quando: Date }

function ordenarPorHorario(a: AulaNoDia, b: AulaNoDia): number {
  const d = a.quando.getTime() - b.quando.getTime()
  return d !== 0 ? d : (a.materia?.nome ?? '').localeCompare(b.materia?.nome ?? '')
}

/** As aulas de um dia, na ordem do relógio. É o que a tela "Hoje" mostra. */
export function aulasDoDia(
  base: Base,
  periodo: Periodo,
  iso: DataISO,
  inverterSemana = false,
): AulaNoDia[] {
  return vivos(base.aulas)
    .filter((a) => aulaValeNaData(a, periodo, iso, inverterSemana))
    .map((aula) => ({
      aula,
      materia: base.materias[aula.materiaId],
      data: iso,
      quando: instante(iso, aula.inicio),
    }))
    .filter((x) => x.materia !== undefined && !x.materia.removido)
    .sort(ordenarPorHorario)
}

/**
 * As próximas `quantas` aulas de uma matéria, a partir de um instante.
 *
 * "A partir de um instante", e não "a partir de um dia": a aula de matemática das
 * 7h de hoje já passou às 10h, e contar ela como "a próxima" faria a tarefa vencer
 * no passado.
 */
export function proximasAulasDaMateria(
  materiaId: string,
  base: Base,
  periodo: Periodo,
  apartirDe: Date,
  quantas: number,
  inverterSemana = false,
): AulaNoDia[] {
  const aulas = vivos(base.aulas).filter((a) => a.materiaId === materiaId)
  if (aulas.length === 0 || quantas <= 0) return []

  const materia = base.materias[materiaId]
  const de = maiorData(dataCivilDe(apartirDe), periodo.inicio)
  const encontradas: AulaNoDia[] = []

  // Varre semana a semana em vez de dia a dia: no pior caso (uma aula por semana,
  // período de um ano) são ~52 voltas, e não 365.
  let janelaDe = de
  while (diasDesdeEpoca(janelaDe) <= diasDesdeEpoca(periodo.fim) && encontradas.length < quantas) {
    const janelaAte = menorData(somarDias(janelaDe, 27), periodo.fim)
    const naJanela: AulaNoDia[] = []
    for (const aula of aulas) {
      for (const iso of ocorrenciasDeAula(aula, periodo, janelaDe, janelaAte, inverterSemana)) {
        const quando = instante(iso, aula.inicio)
        if (quando.getTime() > apartirDe.getTime()) {
          naJanela.push({ aula, materia, data: iso, quando })
        }
      }
    }
    naJanela.sort(ordenarPorHorario)
    encontradas.push(...naJanela)
    janelaDe = somarDias(janelaAte, 1)
  }
  return encontradas.slice(0, quantas)
}

function dataCivilDe(d: Date): DataISO {
  const a = d.getFullYear()
  const m = d.getMonth() + 1
  const dia = d.getDate()
  return `${a}-${m < 10 ? '0' : ''}${m}-${dia < 10 ? '0' : ''}${dia}`
}

function maiorData(a: DataISO, b: DataISO): DataISO {
  return diasDesdeEpoca(a) >= diasDesdeEpoca(b) ? a : b
}

function menorData(a: DataISO, b: DataISO): DataISO {
  return diasDesdeEpoca(a) <= diasDesdeEpoca(b) ? a : b
}

/** Quantas aulas dessa matéria o período inteiro tem. Alimenta o cálculo de faltas. */
export function totalDeAulasNoPeriodo(
  materiaId: string,
  base: Base,
  periodo: Periodo,
  inverterSemana = false,
): number {
  return vivos(base.aulas)
    .filter((a) => a.materiaId === materiaId)
    .reduce(
      (soma, aula) =>
        soma + ocorrenciasDeAula(aula, periodo, periodo.inicio, periodo.fim, inverterSemana).length,
      0,
    )
}

/** O período letivo em vigor. Sem ele, "próxima aula" não tem onde acontecer. */
export function periodoAtivo(base: Base, hoje?: DataISO): Periodo | undefined {
  const lista = vivos(base.periodos)
  if (hoje) {
    const emVigor = lista.find((p) => entre(hoje, p.inicio, p.fim))
    if (emVigor) return emVigor
  }
  return lista.find((p) => p.ativo) ?? lista[0]
}

/** Duração da aula em minutos. Usada quando o horário só traz o começo. */
export function duracaoEmMinutos(aula: Aula): number {
  return Math.max(0, minutosDaHora(aula.fim) - minutosDaHora(aula.inicio))
}
