// O que o widget de tela de início mostra.
//
// Diferente da Live Activity, que só aparece quando falta pouco (ver
// `atividadeViva.ts`), o widget está sempre na tela — então ele mostra a lista,
// não um item só, e inclui o que já está atrasado. O que ficou para trás é
// exatamente o que a pessoa precisa ver ao desbloquear o telefone.
//
// O widget roda em outro processo e não enxerga o MMKV do app. O único canal é o
// container do App Group, e quem escreve nele é `salvarResumo`.

import type { Ajustes, Base, Periodo } from '../../../nucleo/modelo.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { resolverVencimento } from '../../../nucleo/vencimento.ts'
import { estaAtrasado } from '../../../nucleo/hoje.ts'
import type { criarT } from '../../../nucleo/i18n.ts'
import { salvarResumo, type ItemDoResumo } from '../../modules/atividade/src/index.ts'

/** Quantos itens o resumo carrega. O médio mostra 4; a folga cobre a virada do dia. */
const QUANTOS = 6

/** Quanto tempo para trás um item atrasado ainda aparece: uma semana. */
const JANELA_DE_ATRASO_MS = 7 * 24 * 3_600_000

export function atualizarWidget(
  base: Base,
  ajustes: Ajustes,
  periodo: Periodo | undefined,
  t: ReturnType<typeof criarT>,
  agora = new Date(),
): boolean {
  const agoraMs = agora.getTime()
  const piso = agoraMs - JANELA_DE_ATRASO_MS
  const candidatos: (ItemDoResumo & { ordem: number })[] = []

  for (const c of vivos(base.compromissos)) {
    if (c.concluido) continue
    const r = resolverVencimento(c, base, periodo, ajustes.inverterSemanaAlternada)
    if (!r.ok) continue

    const quandoMs = r.valor.quando.getTime()
    if (quandoMs < piso) continue

    const materia = c.materiaId ? base.materias[c.materiaId] : undefined
    candidatos.push({
      id: c.id,
      titulo: c.titulo,
      materia: materia?.nome ?? '',
      tipo: t(`compromisso.tipo.singular.${c.tipo}` as never),
      venceEm: quandoMs / 1000,
      cor: materia?.cor ?? '#F4EFE9',
      // A MESMA regra do app, e não `quando < agora`: o dia da entrega chegou
      // basta. Uma terceira definição de "atrasado" faria a tarefa aparecer
      // vermelha no app e normal na tela de início.
      atrasado: estaAtrasado(r.valor.quando, agora),
      ordem: quandoMs,
    })
  }

  // Atrasado vem primeiro, e dentro de cada grupo o mais próximo primeiro. Um
  // atrasado de ontem importa mais que uma prova de sexta, mesmo a prova sendo
  // "mais urgente" pelo relógio.
  candidatos.sort((a, b) => {
    if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1
    return a.ordem - b.ordem
  })

  return salvarResumo(
    candidatos.slice(0, QUANTOS).map(({ ordem: _ordem, ...item }) => item),
  )
}
