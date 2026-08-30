// O idioma do app: o do sistema por padrão, trocável em Ajustes, forçável por
// variável de ambiente na hora de conferir a tradução.

import { getLocales } from 'expo-localization'
import type { Idioma } from '../../nucleo/modelo.ts'
import { criarT } from '../../nucleo/i18n.ts'
import { usarLoja } from './estado/loja.ts'

export function idiomaDoSistema(): Idioma {
  const forcado = process.env.EXPO_PUBLIC_OSTINATO_LANG
  if (forcado === 'pt' || forcado === 'en') return forcado
  const primeiro = getLocales()[0]?.languageCode
  return primeiro === 'pt' ? 'pt' : 'en'
}

/** O idioma que vale agora: a escolha dele, ou o do sistema. */
export function usarIdioma(): Idioma {
  const escolhido = usarLoja((e) => e.ajustes.idioma)
  return escolhido ?? idiomaDoSistema()
}

export function usarT(): ReturnType<typeof criarT> {
  return criarT(usarIdioma())
}
