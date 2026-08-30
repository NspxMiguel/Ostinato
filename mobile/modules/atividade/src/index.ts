import { requireNativeModule } from 'expo-modules-core'
import { Platform } from 'react-native'

const modulo = Platform.OS === 'ios' ? requireNativeModule('Atividade') : null

export function temAtividade(): boolean {
  try {
    return modulo?.disponivel?.() ?? false
  } catch {
    return false
  }
}

export type Proxima = {
  /** O tipo já traduzido: "Prova", "Entrega". */
  tipo: string
  titulo: string
  materia: string
  /** Instante do vencimento. A contagem regressiva é feita pelo sistema. */
  venceEm: Date
  cor: string
}

/** Liga (ou atualiza) a Live Activity da próxima entrega. */
export async function mostrarProxima(p: Proxima): Promise<string | null> {
  if (!modulo) return null
  try {
    return (await modulo.mostrar(
      p.tipo,
      p.titulo,
      p.materia,
      p.venceEm.getTime() / 1000,
      p.cor,
    )) as string
  } catch {
    // Atividade recusada (usuário desligou, ou versão antiga do iOS) não é motivo
    // para derrubar nada: é um enfeite em cima do aviso, não o aviso.
    return null
  }
}

export async function esconderAtividade(): Promise<number> {
  if (!modulo) return 0
  try {
    return (await modulo.esconder()) as number
  } catch {
    return 0
  }
}
