// A próxima entrega na tela de bloqueio.
//
// Só entra quando falta pouco. Uma Live Activity que fica dias na tela de bloqueio
// deixa de ser aviso e vira mobília — e o iOS encerra sozinho depois de 8 horas,
// então mantê-la ligada com uma semana de antecedência nem funcionaria.

import type { Ajustes, Base, Periodo } from '../../../nucleo/modelo.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { resolverVencimento } from '../../../nucleo/vencimento.ts'
import type { criarT } from '../../../nucleo/i18n.ts'
import { esconderAtividade, mostrarProxima, temAtividade } from '../../modules/atividade/src/index.ts'

/** A partir de quanto tempo antes a atividade aparece. */
export const HORAS_DE_ANTECEDENCIA = 8

export async function atualizarAtividadeViva(
  base: Base,
  ajustes: Ajustes,
  periodo: Periodo | undefined,
  t: ReturnType<typeof criarT>,
  agora = new Date(),
): Promise<boolean> {
  if (!temAtividade()) return false

  const limite = agora.getTime() + HORAS_DE_ANTECEDENCIA * 3_600_000
  let proxima: { quando: Date; titulo: string; tipo: string; materia: string; cor: string } | null =
    null

  for (const c of vivos(base.compromissos)) {
    if (c.concluido) continue
    const r = resolverVencimento(c, base, periodo, ajustes.inverterSemanaAlternada)
    if (!r.ok) continue
    const quando = r.valor.quando
    if (quando.getTime() <= agora.getTime() || quando.getTime() > limite) continue
    if (proxima && proxima.quando.getTime() <= quando.getTime()) continue

    const materia = c.materiaId ? base.materias[c.materiaId] : undefined
    proxima = {
      quando,
      titulo: c.titulo,
      tipo: t(`compromisso.tipo.singular.${c.tipo}` as never),
      materia: materia?.nome ?? '',
      cor: materia?.cor ?? '#F4EFE9',
    }
  }

  if (!proxima) {
    await esconderAtividade()
    return false
  }

  const id = await mostrarProxima({
    tipo: proxima.tipo,
    titulo: proxima.titulo,
    materia: proxima.materia,
    venceEm: proxima.quando,
    cor: proxima.cor,
  })
  return id !== null
}
