// Resolver "quando isso vence" — inclusive quando a resposta está na grade horária.
//
// É a função que realiza o pedido: em vez de o estudante abrir o calendário e
// procurar que dia é a próxima aula de matemática, ele diz "na próxima aula de
// matemática" e o app faz a conta.

import type { Base, Compromisso, DataISO, Hora, Periodo } from './modelo.ts'
import { proximasAulasDaMateria, type AulaNoDia } from './grade.ts'
import { dataDe, horaDe, instante } from './tempo.ts'

/** Hora padrão de quem marcou só o dia: o fim do dia, não o começo. */
export const HORA_FIM_DO_DIA: Hora = '23:59'

export type VencimentoResolvido = {
  quando: Date
  data: DataISO
  hora: Hora
  /** Preenchido quando o vencimento estava ancorado numa aula. */
  aula?: AulaNoDia
}

/** Por que não deu para resolver — a tela precisa saber para explicar. */
export type FalhaVencimento =
  | 'sem-periodo'
  | 'materia-sem-aula'
  | 'periodo-acabou'

export type ResultadoVencimento =
  | { ok: true; valor: VencimentoResolvido }
  | { ok: false; motivo: FalhaVencimento }

/**
 * A âncora de "próxima aula" é `criadoEm`, e não o relógio de agora.
 *
 * Se fosse "agora", a tarefa que você anotou na segunda para a próxima aula de
 * matemática viraria a aula da semana seguinte assim que a de terça passasse, e
 * depois a da outra semana, para sempre. O prazo escorregaria e nunca venceria.
 */
export function resolverVencimento(
  c: Compromisso,
  base: Base,
  periodo: Periodo | undefined,
  inverterSemana = false,
): ResultadoVencimento {
  if (c.vencimento.tipo === 'data') {
    const hora = c.vencimento.hora ?? HORA_FIM_DO_DIA
    const quando = instante(c.vencimento.data, hora)
    return { ok: true, valor: { quando, data: c.vencimento.data, hora } }
  }

  if (!periodo) return { ok: false, motivo: 'sem-periodo' }

  const ocorrencia = Math.max(1, Math.floor(c.vencimento.ocorrencia))
  const encontradas = proximasAulasDaMateria(
    c.vencimento.materiaId,
    base,
    periodo,
    new Date(c.criadoEm),
    ocorrencia,
    inverterSemana,
  )

  const alvo = encontradas[ocorrencia - 1]
  if (!alvo) {
    // Duas falhas diferentes, e a tela precisa distinguir: matéria sem nenhuma aula
    // cadastrada pede "cadastre o horário"; matéria com aula mas sem ocorrência à
    // frente quer dizer que o período letivo acabou.
    const alvoId = c.vencimento.materiaId
    const materiaTemAula = Object.values(base.aulas).some(
      (a) => !a.removido && a.materiaId === alvoId,
    )
    return { ok: false, motivo: materiaTemAula ? 'periodo-acabou' : 'materia-sem-aula' }
  }

  return {
    ok: true,
    valor: { quando: alvo.quando, data: alvo.data, hora: alvo.aula.inicio, aula: alvo },
  }
}

/** Atalho para quem só quer o instante e trata `null` como "não dá". */
export function instanteDeVencimento(
  c: Compromisso,
  base: Base,
  periodo: Periodo | undefined,
  inverterSemana = false,
): Date | null {
  const r = resolverVencimento(c, base, periodo, inverterSemana)
  return r.ok ? r.valor.quando : null
}

/** O que a tela de "novo compromisso" mostra em tempo real, enquanto ele escolhe. */
export function previaDeVencimento(
  materiaId: string,
  ocorrencia: number,
  base: Base,
  periodo: Periodo | undefined,
  agora: Date,
  inverterSemana = false,
): VencimentoResolvido | null {
  if (!periodo) return null
  const n = Math.max(1, Math.floor(ocorrencia))
  const alvo = proximasAulasDaMateria(materiaId, base, periodo, agora, n, inverterSemana)[n - 1]
  if (!alvo) return null
  return { quando: alvo.quando, data: alvo.data, hora: alvo.aula.inicio, aula: alvo }
}

export { dataDe, horaDe }
