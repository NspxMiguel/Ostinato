// Controle de faltas de uma matéria: quanto já perdeu, quanto ainda pode
// perder, e a que distância da reprovação está.

import type { Falta, Materia } from './modelo.ts'

export type SituacaoFaltas = {
  /** Aulas perdidas não justificadas — as que contam contra o limite. */
  perdidas: number
  /** Aulas perdidas com justificativa: contam aqui, não contra o limite. */
  justificadas: number
  /** Quantas aulas pode perder no período (limite fracionário desce pro inteiro). */
  limite: number
  /** Quantas ainda pode perder. Nunca fica negativo. */
  restantes: number
  /** 0..100 — quanto do limite já usou, estancado em 100. */
  percentual: number
  risco: 'tranquilo' | 'atencao' | 'critico' | 'reprovado'
}

/**
 * Situação de faltas de uma matéria. Devolve `null` quando `cargaHoraria` não
 * foi informada: sem o total de aulas do período não existe limite, e chutar
 * um número seria pior do que não responder.
 */
export function situacaoDeFaltas(materia: Materia, faltas: Falta[]): SituacaoFaltas | null {
  if (materia.cargaHoraria === undefined) return null

  const vivas = faltas.filter((falta) => !falta.removido)

  let perdidas = 0
  let justificadas = 0
  for (const falta of vivas) {
    if (falta.justificada) justificadas += falta.aulas
    else perdidas += falta.aulas
  }

  const limite = Math.floor((materia.cargaHoraria * materia.limiteFaltasPct) / 100)
  const restantes = Math.max(0, limite - perdidas)

  const usadoBruto =
    limite > 0 ? (perdidas / limite) * 100 : perdidas > 0 ? Number.POSITIVE_INFINITY : 0
  const percentual = Math.min(100, Math.round(usadoBruto))

  let risco: SituacaoFaltas['risco']
  if (usadoBruto > 100) risco = 'reprovado'
  else if (usadoBruto <= 50) risco = 'tranquilo'
  else if (usadoBruto <= 80) risco = 'atencao'
  else risco = 'critico'

  return { perdidas, justificadas, limite, restantes, percentual, risco }
}