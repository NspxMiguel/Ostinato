// O modelo de linguagem do aparelho. É RESGATE, não o caminho normal.
//
// O algoritmo continua lendo; isto entra quando a leitura falha — letra de mão,
// texto rasurado, tabela que não fechou. Para texto de computador e print o
// Vision já acerta, e um modelo em cima só adiciona chance de inventar.
import { moduloOpcional } from '../../../src/modulosNativos.ts'

const modulo = moduloOpcional<any>('ModeloLocal')

export type EstadoDoModelo =
  | 'pronto'
  | 'baixando'
  | 'apple-intelligence-desligada'
  | 'aparelho-nao-suporta'
  | 'ios-antigo'
  | 'indisponivel'

/** Um MOTIVO, não um sim/não: a tela precisa distinguir "não tem" de "baixando". */
export function estadoDoModelo(): EstadoDoModelo {
  try {
    return (modulo?.estado?.() as EstadoDoModelo) ?? 'indisponivel'
  } catch {
    return 'indisponivel'
  }
}

/** `null` quando não deu — quem chama volta para o que o algoritmo já leu. */
export async function perguntar(instrucoes: string, entrada: string): Promise<string | null> {
  if (!modulo) return null
  try {
    return (await modulo.perguntar(instrucoes, entrada)) as string
  } catch {
    return null
  }
}
