import { moduloOpcional } from '../../../src/modulosNativos.ts'

const modulo = moduloOpcional<any>('Busca')

export type ItemDeBusca = {
  id: string
  titulo: string
  detalhe?: string
  /** Matéria e tipo: as palavras pelas quais alguém procuraria. */
  palavras: string[]
  /** Epoch em segundos. */
  venceEm?: number
}

export function temBusca(): boolean {
  try {
    return modulo?.disponivel?.() ?? false
  } catch {
    return false
  }
}

/** Reescreve o índice inteiro. Falhar aqui não é motivo para o app reclamar. */
export async function indexar(itens: ItemDeBusca[]): Promise<boolean> {
  if (!modulo) return false
  try {
    return (await modulo.indexar(itens)) as boolean
  } catch {
    return false
  }
}
