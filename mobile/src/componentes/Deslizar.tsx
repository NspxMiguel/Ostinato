// Arrastar a linha para o lado: feito de um lado, apagar do outro.
//
// É o gesto que o iPhone inteiro usa — Mail, Lembretes, Mensagens — e por isso
// ninguém precisa aprender. O que ele pede em troca é comportamento igual ao
// deles, e são três coisas que costumam faltar:
//
//   1. o gesto tem que passar o dedo além de um limite, senão volta. Ação que
//      dispara com um arrasto de dois pixels apaga tarefa sem querer;
//   2. arrastar bastante EXECUTA sem precisar tocar no botão, que é o atalho de
//      quem já sabe o que quer;
//   3. o toque tátil marca o instante em que o gesto "engatou", e sem ele o
//      dedo não sabe que passou do ponto.
//
// Apagar é remoção lógica no `guardar`, então o item vira tombstone e o sync
// leva a remoção junto — não é `delete` no armazenamento.

import { useRef, type ReactNode } from 'react'
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { cores, espaco, raio } from '../tema.ts'

/** Onde a ação passa a valer. Abaixo disto o gesto volta sozinho. */
const LIMITE = 72
/** A partir daqui, soltar já executa — sem precisar acertar o botão. */
const EXECUTA = 150

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
  const x = useRef(new Animated.Value(0)).current
  const engatou = useRef(false)

  const voltar = () =>
    Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 6 }).start()

  const responder = useRef(
    PanResponder.create({
      // Só assume o gesto quando ele é claramente HORIZONTAL. Sem esta razão de
      // 2:1 a lista para de rolar, porque cada linha rouba o arrasto vertical.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_e, g) => {
        x.setValue(g.dx)
        const passou = Math.abs(g.dx) > LIMITE
        if (passou !== engatou.current) {
          engatou.current = passou
          if (passou) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
      },
      onPanResponderRelease: (_e, g) => {
        engatou.current = false
        if (g.dx > EXECUTA) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          aoConcluir()
        } else if (g.dx < -EXECUTA) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          aoRemover()
        }
        voltar()
      },
      onPanResponderTerminate: voltar,
    }),
  ).current

  return (
    <View>
      {/* Os dois fundos ficam atrás e aparecem conforme o lado do arrasto. O
          verde à esquerda porque o dedo vai PARA a direita ao concluir. */}
      <View style={e.fundo} pointerEvents="none">
        <Animated.View
          style={[
            e.acao,
            { backgroundColor: concluido ? cores.textoFraco : cores.ok, alignItems: 'flex-start' },
            { opacity: x.interpolate({ inputRange: [0, LIMITE], outputRange: [0, 1], extrapolate: 'clamp' }) },
          ]}
        >
          <Text style={e.rotulo}>{rotuloConcluir}</Text>
        </Animated.View>
        <Animated.View
          style={[
            e.acao,
            { backgroundColor: cores.atrasado, alignItems: 'flex-end' },
            { opacity: x.interpolate({ inputRange: [-LIMITE, 0], outputRange: [1, 0], extrapolate: 'clamp' }) },
          ]}
        >
          <Text style={e.rotulo}>{rotuloRemover}</Text>
        </Animated.View>
      </View>

      <Animated.View style={{ transform: [{ translateX: x }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  )
}

const e = StyleSheet.create({
  fundo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    borderRadius: raio.cartao,
  },
  acao: { flex: 1, justifyContent: 'center', paddingHorizontal: espaco.g, borderRadius: raio.cartao },
  rotulo: { color: cores.fundo, fontWeight: '600', fontSize: 15 },
})
