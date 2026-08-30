// A prova se conclui sozinha depois que o dia dela passa.
//
// Ninguém marca "fiz a prova" — você fez, e acabou. Deixar a prova pendente na
// lista depois de ter acontecido é o app cobrando uma coisa que não existe, e é
// exatamente o tipo de ruído que faz alguém desligar os avisos.
//
// Só prova. Tarefa, trabalho e entrega ficam: dessas dá para esquecer de
// entregar, e o app não tem como saber se foi entregue.

import type { Base, Compromisso } from './modelo.ts'
import { vivos } from './sync/registro.ts'
import { dataDe, diasDesdeEpoca } from './tempo.ts'
import { resolverVencimento } from './vencimento.ts'
import type { Periodo } from './modelo.ts'

/**
 * As provas que já aconteceram e ainda constam como pendentes.
 *
 * O corte é o DIA, e não a hora: uma prova das 7h da manhã não vira "feita" às
 * 7h01 — pode ter sido adiada, remarcada, ou a pessoa pode querer olhar o
 * lembrete no intervalo. Um dia inteiro é a margem que não gera surpresa.
 */
export function provasJaFeitas(
  base: Base,
  periodo: Periodo | undefined,
  agora: Date,
  inverterSemana = false,
): Compromisso[] {
  const hoje = diasDesdeEpoca(dataDe(agora))
  const saida: Compromisso[] = []

  for (const c of vivos(base.compromissos)) {
    if (c.concluido || c.tipo !== 'prova') continue
    const r = resolverVencimento(c, base, periodo, inverterSemana)
    if (!r.ok) continue
    if (diasDesdeEpoca(r.valor.data) < hoje) saida.push(c)
  }
  return saida
}
