import { requireNativeModule } from 'expo-modules-core'
import { Platform } from 'react-native'

export type TextoLido = {
  /** As linhas remontadas, com TAB separando colunas — o formato de tabela. */
  texto: string
  linhas: number
  pedacos: number
}

const modulo = Platform.OS === 'ios' ? requireNativeModule('Leitura') : null

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
