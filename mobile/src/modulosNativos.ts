// Pegar um módulo nativo sem derrubar o app quando ele não está no binário.
//
// `requireNativeModule` lança na hora do import, e import que lança leva a tela
// branca antes de qualquer código nosso rodar. Isso acontece de verdade: um
// build de desenvolvimento feito antes de o módulo existir, um prebuild que não
// foi refeito, ou o Android, onde três dos quatro módulos não têm par.
//
// Todo módulo do Ostinato é opcional por natureza — vidro tem fallback, nuvem só liga
// com conta paga, atividade e leitura são enfeite e conveniência. Nenhum deles
// justifica derrubar o app.

import { requireNativeModule } from 'expo-modules-core'
import { Platform } from 'react-native'

export function moduloOpcional<T>(nome: string): T | null {
  if (Platform.OS !== 'ios') return null
  try {
    return requireNativeModule<T>(nome)
  } catch {
    return null
  }
}
