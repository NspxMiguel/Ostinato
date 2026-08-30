// O que entra na busca do iPhone, e com que palavras.
//
// Fica no núcleo porque é decisão de produto, não de plataforma: quando o
// Android entrar, o mesmo conjunto alimenta o índice de lá.

import type { Base, Compromisso, Materia, Periodo } from './modelo.ts'
import { vivos } from './sync/registro.ts'
import { resolverVencimento } from './vencimento.ts'
import type { criarT } from './i18n.ts'

export type ItemDeBusca = {
  id: string
  titulo: string
  detalhe?: string
  palavras: string[]
  venceEm?: number
}

/**
 * Os compromissos que valem estar na busca.
 *
 * Concluído fica de fora: quem procura "prova de biologia" quer a que vem, não a
 * que já passou — e o resultado antigo empurraria o novo para baixo.
 */
export function itensParaBusca(
  base: Base,
  periodo: Periodo | undefined,
  t: ReturnType<typeof criarT>,
  inverterSemana = false,
): ItemDeBusca[] {
  const saida: ItemDeBusca[] = []
  for (const c of vivos(base.compromissos)) {
    if (c.concluido) continue
    const materia: Materia | undefined = c.materiaId ? base.materias[c.materiaId] : undefined
    const r = resolverVencimento(c, base, periodo, inverterSemana)

    // As palavras pelas quais alguém procuraria: o nome da matéria, os outros
    // nomes dela, e o tipo escrito por extenso ("prova", "trabalho").
    const palavras = [
      materia?.nome,
      ...(materia?.apelidos ?? []),
      t(`compromisso.tipo.singular.${c.tipo}` as never),
    ].filter((p): p is string => typeof p === 'string' && p.length > 0)

    const item: ItemDeBusca = { id: c.id, titulo: c.titulo, palavras }
    if (c.detalhe) item.detalhe = c.detalhe
    if (r.ok) item.venceEm = r.valor.quando.getTime() / 1000
    saida.push(item)
  }
  return saida
}
