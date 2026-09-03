// Arrastar a linha para o lado: feito de um lado, apagar do outro.
//
// Isto era um `PanResponder` escrito à mão, com dois fundos absolutos atrás da
// linha. Ele reclamou em 31/08/2026, com print: *"feiao o deslizar pae, dava pra
// dar uma melhorada"* e *"bem bugado o deslizar tbm, deixa suave, sla, pega um
// na net mais facil"*.
//
// Ele tem razão nas duas coisas, e a segunda é a lição. O gesto de deslizar
// linha tem uma quantidade absurda de detalhe que não aparece na descrição:
// atrito ao arrastar, a ação crescendo junto do dedo, o limite de abertura, o
// fechar quando outra linha abre, o encaixe elástico, e a interação com a
// rolagem vertical da lista. Eu tinha acertado dois desses e errado o resto —
// e o resultado é o que a print mostra: um retângulo vermelho flutuando por
// cima do cartão, com o texto no lugar errado.
//
// O `ReanimatedSwipeable` do `react-native-gesture-handler` já estava instalado
// no projeto. Ele roda na thread de UI (Reanimated), então o movimento não
// engasga quando o JavaScript está ocupado — que é metade do "bugado".
//
// O que sobra para mim é o que é DESTE app: o que a ação diz, a cor dela, e a
// decisão de que apagar exige o gesto inteiro.

import type { ReactNode } from 'react'
import { useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { cores, espaco, raio } from '../tema.ts'

/** Onde a ação passa a valer. Abaixo disto a linha volta sozinha. */
const LIMITE = 72

/**
 * O painel que aparece atrás da linha.
 *
 * Ele CRESCE com o dedo em vez de estar pronto embaixo, e é isso que faz o
 * gesto parecer que a mão está puxando a ação para fora — o Mail e os Lembretes
 * fazem assim. O painel pronto e estático, que era o meu, parece um cartão
 * escondido que a linha revela.
 */
function Acao({
  progresso,
  texto,
  cor,
  lado,
}: {
  progresso: SharedValue<number>
  texto: string
  cor: string
  lado: 'esquerda' | 'direita'
}) {
  const estilo = useAnimatedStyle(() => ({
    opacity: Math.min(1, progresso.value),
    transform: [{ scale: 0.85 + Math.min(1, progresso.value) * 0.15 }],
  }))

  return (
    <View
      style={[
        e.acao,
        { backgroundColor: cor, alignItems: lado === 'esquerda' ? 'flex-start' : 'flex-end' },
      ]}
    >
      <Animated.View style={estilo}>
        <Text style={e.rotulo}>{texto}</Text>
      </Animated.View>
    </View>
  )
}

export function Deslizar({
  children,
  aoConcluir,
  aoRemover,
  concluido,
  rotuloConcluir,
  rotuloRemover,
}: {
  children: ReactNode
  aoConcluir: () => void
  aoRemover: () => void
  concluido?: boolean
  rotuloConcluir: string
  rotuloRemover: string
}) {
  const linha = useRef<SwipeableMethods>(null)

  return (
    <ReanimatedSwipeable
      ref={linha}
      // Sem atrito o cartão dispara com o dedo e o gesto fica nervoso; 2 é o
      // valor que o próprio componente usa nos exemplos e é o que se sente no
      // Mail.
      friction={2}
      // A ação começa a valer no mesmo ponto dos dois lados: assimetria aqui é
      // o tipo de coisa que a mão nota e ninguém sabe nomear.
      leftThreshold={LIMITE}
      rightThreshold={LIMITE}
      // Sem elástico além do painel. Deixar a linha ir embora da tela sugere
      // que soltar ali faz alguma coisa, e não faz.
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(progresso) => (
        <Acao
          progresso={progresso}
          texto={rotuloConcluir}
          cor={concluido ? cores.textoFraco : cores.ok}
          lado="esquerda"
        />
      )}
      renderRightActions={(progresso) => (
        <Acao progresso={progresso} texto={rotuloRemover} cor={cores.atrasado} lado="direita" />
      )}
      onSwipeableWillOpen={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onSwipeableOpen={(direcao) => {
        // A linha FECHA antes de agir. Sem isto ela fica aberta enquanto o item
        // some da lista por baixo, e o painel vermelho sobra sobre o vizinho.
        linha.current?.close()
        if (direcao === 'left') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          aoConcluir()
        } else {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          aoRemover()
        }
      }}
      containerStyle={e.recipiente}
    >
      {children}
    </ReanimatedSwipeable>
  )
}

const e = StyleSheet.create({
  // O recorte é do RECIPIENTE, e é ele que resolve o defeito da print: sem
  // isso o painel da ação é um retângulo vermelho com cantos próprios,
  // flutuando por cima do cartão em vez de viver dentro da linha.
  recipiente: { borderRadius: raio.cartao, overflow: 'hidden' },
  acao: { flex: 1, justifyContent: 'center', paddingHorizontal: espaco.g },
  rotulo: { color: cores.fundo, fontWeight: '600', fontSize: 15 },
})
