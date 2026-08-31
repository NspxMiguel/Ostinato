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
