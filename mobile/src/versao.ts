// A versão que aparece na tela.
//
// Pedido dele em 30/08/2026: *"coloca la no sobre a versao do app, coloca algo
// sla, 2.0A1 pra eu saber q foi atualizado"*.
//
// O que ele quer não é numeração semântica — é uma MARCA que muda. Ele instala
// pelo cabo várias vezes por noite, o ícone é o mesmo, a tela inicial é a mesma,
// e não havia como saber se o build que ele está olhando é o novo ou o de meia
// hora atrás. Isso já custou tempo nesta conversa: eu afirmei que algo estava
// corrigido enquanto ele testava a versão anterior.
//
// Então a letra é o que eu incremento a cada envio (A1, A2, A3…), e o número
// só muda quando a versão muda de verdade.

import Constants from 'expo-constants'

export const VERSAO: string = (() => {
  const v = Constants.expoConfig?.version ?? '?'
  const build = (Constants.expoConfig?.extra as { rotuloDeBuild?: string } | undefined)
    ?.rotuloDeBuild
  return build ? `${v}${build}` : v
})()
