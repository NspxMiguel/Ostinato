import { moduloOpcional } from '../../../src/modulosNativos.ts'

export type TextoLido = {
  /** As linhas remontadas, com TAB separando colunas — o formato de tabela. */
  texto: string
  linhas: number
  pedacos: number
  /**
   * A confiança média do Vision, de 0 a 1, ponderada pelo tamanho do pedaço.
   *
   * É o que separa print de computador (alta) de letra de mão e rasura (baixa),
   * e é com ela que `nucleo/resgate.ts` decide chamar a IA do aparelho.
   */
  confianca: number
  /**
   * A grade reconstruída das posições: uma linha por linha do quadro, uma
   * célula por coluna, vazia quando não há nada ali.
   *
   * Isto é o que vai para o modelo. O `texto` acima é a mesma leitura achatada,
   * e serve só para a pessoa conferir e corrigir à mão.
   */
  grade: string[][]
}

const modulo = moduloOpcional<any>('Leitura')

export function temLeitura(): boolean {
  try {
    return modulo?.disponivel?.() ?? false
  } catch {
    return false
  }
}

/** Lê o texto de uma imagem local (`file://…`). Roda no aparelho, sem rede. */
export async function lerTexto(uri: string): Promise<TextoLido> {
  if (!modulo) throw new Error('leitura indisponível nesta plataforma')
  return (await modulo.lerTexto(uri)) as TextoLido
}

/**
 * Lê a imagem como TABELA: linhas de células, como o Vision as viu.
 *
 * Vazio quando o iPhone é anterior ao iOS 26 ou quando não há tabela nenhuma na
 * foto — e aí quem chama volta para `lerTexto`, que continua existindo.
 *
 * A diferença em relação a `lerTexto` é a que ele apontou: aqui a grade vem de
 * quem OLHOU a imagem, e não de uma heurística minha reagrupando pedaços de
 * texto por posição vertical. Ver `ios/LeituraModule.swift`.
 */
export async function lerTabela(uri: string): Promise<string[][]> {
  if (!modulo) return []
  try {
    const r = (await modulo.lerTabela(uri)) as string[][]
    return Array.isArray(r) ? r : []
  } catch {
    return []
  }
}
