// O idioma do app: SEMPRE o do celular.
//
// A escolha manual saiu de Ajustes em 30/08/2026 a pedido dele. O motivo é que
// ninguém troca o idioma de um app: quem quer o telefone em espanhol já pôs o
// telefone em espanhol, e um seletor com cinco pílulas ocupava um grupo inteiro
// da tela para uma decisão que o sistema já tomou.
//
// A variável de ambiente continua, porque é como eu confiro as quatro traduções
// sem mexer no idioma da máquina dele.

import { getLocales } from 'expo-localization'
import type { Idioma } from '../../nucleo/modelo.ts'
import { criarT } from '../../nucleo/i18n.ts'

export function idiomaDoSistema(): Idioma {
  const forcado = process.env.EXPO_PUBLIC_OSTINATO_LANG
  if (ehIdioma(forcado)) return forcado

  // Os QUATRO idiomas, não dois. Isto reconhecia só `pt` e `en`, então um
  // iPhone em francês recebia inglês — com a tradução francesa inteira dentro
  // do binário, sem ninguém alcançar.
  const primeiro = getLocales()[0]?.languageCode
  return ehIdioma(primeiro) ? primeiro : 'en'
}

function ehIdioma(v: string | null | undefined): v is Idioma {
  return v === 'pt' || v === 'en' || v === 'es' || v === 'fr'
}

/** O idioma que vale agora. Vem do celular, e só dele. */
export function usarIdioma(): Idioma {
  return idiomaDoSistema()
}

export function usarT(): ReturnType<typeof criarT> {
  return criarT(usarIdioma())
}
