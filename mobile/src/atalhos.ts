// Escutar as URLs que chegam de fora. Quem entende delas é `nucleo/atalhos.ts`.

import { Linking } from 'react-native'
import type { Atalho } from '../../nucleo/atalhos.ts'
import { lerAtalho } from '../../nucleo/atalhos.ts'

/**
 * As duas formas de chegar: o app ABERTO pela URL (frio) e a URL chegando com o
 * app já rodando (quente).
 *
 * Esquecer a primeira é o erro clássico: o atalho funciona quando o app está
 * aberto e não faz nada quando está fechado — que é justamente quando alguém usa
 * um atalho.
 */
export function ouvirAtalhos(aoChegar: (a: Atalho) => void): () => void {
  void Linking.getInitialURL().then((url) => {
    const a = lerAtalho(url)
    if (a) aoChegar(a)
  })
  const inscricao = Linking.addEventListener('url', ({ url }) => {
    const a = lerAtalho(url)
    if (a) aoChegar(a)
  })
  return () => inscricao.remove()
}

export type { Atalho }
