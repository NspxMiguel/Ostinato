// A tela que aparece quando um aviso em modo alarme dispara com o app à mão.
//
// Tela cheia e dois botões grandes de propósito: quem está sendo acordado por um
// alarme não procura menu.
//
// Os anéis pulsando são a ÚNICA aparição literal do nome do app — ostinato é a
// figura que se repete até você notar, e é exatamente o que um alarme faz. Fora
// daqui o motivo não aparece: um app de escola que vira tema de música cansa na
// segunda semana.
//
// Esta tela é sempre escura, mesmo quando o resto do app estiver claro. Alarme
// toca de manhã cedo e de madrugada, e branco pleno na cara de quem acabou de
// acordar é agressão, não interface.

import { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { usarLoja } from '../estado/loja.ts'
import { usarT } from '../i18n.ts'
import { paletaEscura as cores, espaco, fonte, raio } from '../tema.ts'

/** Um anel que cresce e some, em laço. `atraso` é o que escalona os três. */
function Anel({ atraso, cor }: { atraso: number; cor: string }) {
  const p = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.delay(atraso),
        Animated.timing(p, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          // O driver nativo tira a animação da thread de JS: ela continua lisa
          // mesmo com o app ocupado tocando o som e recalculando avisos.
          useNativeDriver: true,
        }),
      ]),
      { resetBeforeIteration: true },
    )
    laco.start()
    return () => laco.stop()
  }, [atraso, p])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        e.anel,
        {
          borderColor: cor,
          opacity: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1.55] }) }],
        },
      ]}
    />
  )
}

export function TelaDeAlarme({
  compromissoId,
  aoDispensar,
  aoConcluir,
}: {
  compromissoId: string
  aoDispensar: () => void
  aoConcluir: () => void
}) {
  const t = usarT()
  const base = usarLoja((e) => e.base)
  const c = base.compromissos[compromissoId]
  const materia = c?.materiaId ? base.materias[c.materiaId] : undefined

  return (
    <View style={e.fundo}>
      <View style={e.palco}>
        <Anel atraso={0} cor={cores.destaque} />
        <Anel atraso={730} cor={cores.destaque} />
        <Anel atraso={1460} cor={cores.destaque} />
        <View style={e.miolo}>
          <Text style={[fonte.secao, { color: cores.destaque }]}>
            {t(`compromisso.tipo.singular.${c?.tipo ?? 'outro'}` as never)}
          </Text>
        </View>
      </View>

      <View style={{ gap: espaco.s, alignItems: 'center', paddingHorizontal: espaco.g }}>
        <Text style={[fonte.titulo, { textAlign: 'center' }]}>{c?.titulo ?? ''}</Text>
        {materia ? (
          <View style={e.materia}>
            <View style={[e.bolinha, { backgroundColor: materia.cor }]} />
            <Text style={fonte.apoio}>{materia.nome}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: espaco.m, alignSelf: 'stretch' }}>
        <Pressable style={[e.botao, e.principal]} onPress={aoConcluir} accessibilityRole="button">
          <Text style={{ color: cores.sobreDestaque, fontWeight: '600', fontSize: 17 }}>
            {t('notificacao.acao.feito')}
          </Text>
        </Pressable>
        <Pressable style={[e.botao, e.secundario]} onPress={aoDispensar} accessibilityRole="button">
          <Text style={{ color: cores.texto, fontWeight: '600', fontSize: 17 }}>
            {t('alarme.dispensar')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const TAMANHO = 168

const e = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: cores.fundo,
    padding: espaco.gg,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 96,
    paddingBottom: 56,
  },
  palco: { width: TAMANHO, height: TAMANHO, alignItems: 'center', justifyContent: 'center' },
  anel: {
    position: 'absolute',
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: TAMANHO / 2,
    borderWidth: 2,
  },
  miolo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaco.s,
    backgroundColor: 'rgba(255,214,10,0.12)',
  },
  materia: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  bolinha: { width: 8, height: 8, borderRadius: 4 },
  botao: { paddingVertical: espaco.g + 2, borderRadius: raio.pilula, alignItems: 'center' },
  principal: { backgroundColor: cores.destaque },
  secundario: { borderWidth: 1, borderColor: cores.borda },
})
