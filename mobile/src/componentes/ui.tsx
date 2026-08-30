// O vocabulário visual do Giz.
//
// Existe para que telas escritas por pessoas (e agentes) diferentes não virem
// três apps dentro de um. Tela nova compõe estas peças; se faltar alguma, ela
// nasce AQUI, não solta dentro de uma tela.

import { useState, type ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { cores, espaco, fonte, raio } from '../tema.ts'

export function Tela({ children, titulo }: { children: ReactNode; titulo?: string }) {
  const margem = useSafeAreaInsets()
  return (
    <View style={[e.tela, { paddingTop: margem.top }]}>
      {titulo ? <Text style={[fonte.titulo, e.tituloTela]}>{titulo}</Text> : null}
      <ScrollView
        contentContainerStyle={{ padding: espaco.g, paddingBottom: margem.bottom + 96, gap: espaco.m }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  )
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={{ gap: espaco.s }}>
      <Text style={fonte.secao}>{titulo.toUpperCase()}</Text>
      {children}
    </View>
  )
}

/**
 * Toque com retorno visual, SEM `style` como função.
 *
 * O `Pressable` aceita `style={({ pressed }) => ...}`, e é assim que a
 * documentação do React Native ensina — mas com o transform de JSX do NativeWind
 * ligado esse formato faz o componente renderizar NADA. Sem erro, sem aviso: o
 * botão simplesmente não aparece na tela, e o resto da tela continua perfeito.
 *
 * Foi assim que o botão de criar período sumiu. Todo toque do app passa por
 * aqui para o defeito não voltar por outra porta.
 */
export function Toque({
  children,
  aoTocar,
  estilo,
}: {
  children: ReactNode
  aoTocar?: () => void
  estilo?: StyleProp<ViewStyle>
}) {
  const [pressionado, setPressionado] = useState(false)
  if (!aoTocar) return <View style={estilo}>{children}</View>
  return (
    <Pressable
      onPress={aoTocar}
      onPressIn={() => setPressionado(true)}
      onPressOut={() => setPressionado(false)}
      style={[estilo, pressionado ? e.pressionado : null]}
    >
      {children}
    </Pressable>
  )
}

export function Cartao({
  children,
  aoTocar,
  faixa,
}: {
  children: ReactNode
  aoTocar?: () => void
  /** Cor da tarja lateral — normalmente a cor da matéria. */
  faixa?: string
}) {
  const conteudo = (
    <View style={e.cartao}>
      {faixa ? <View style={[e.faixa, { backgroundColor: faixa }]} /> : null}
      <View style={{ flex: 1, gap: espaco.xs }}>{children}</View>
    </View>
  )
  return <Toque aoTocar={aoTocar}>{conteudo}</Toque>
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={[fonte.corpo, { fontWeight: '600' }]}>{children}</Text>
}

export function Apoio({ children, cor }: { children: ReactNode; cor?: string }) {
  return <Text style={[fonte.apoio, cor ? { color: cor } : undefined]}>{children}</Text>
}

export function Etiqueta({ texto, cor = cores.cartaoAlto }: { texto: string; cor?: string }) {
  return (
    <View style={[e.etiqueta, { backgroundColor: cor }]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: cores.texto }}>{texto}</Text>
    </View>
  )
}

export function Botao({
  texto,
  aoTocar,
  variante = 'cheio',
}: {
  texto: string
  aoTocar: () => void
  variante?: 'cheio' | 'vazado' | 'discreto'
}) {
  const estilo =
    variante === 'cheio' ? e.botaoCheio : variante === 'vazado' ? e.botaoVazado : e.botaoDiscreto
  const corTexto = variante === 'cheio' ? cores.fundo : cores.texto
  return (
    <Toque aoTocar={aoTocar} estilo={[e.botao, estilo]}>
      <Text style={{ fontWeight: '700', color: corTexto, textAlign: 'center' }}>{texto}</Text>
    </Toque>
  )
}

export function Vazio({ texto }: { texto: string }) {
  return (
    <View style={e.vazio}>
      <Text style={[fonte.apoio, { textAlign: 'center' }]}>{texto}</Text>
    </View>
  )
}

export function Linha({ children, entre }: { children: ReactNode; entre?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espaco.s,
        justifyContent: entre ? 'space-between' : 'flex-start',
      }}
    >
      {children}
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  tituloTela: { paddingHorizontal: espaco.g, paddingTop: espaco.m },
  cartao: {
    flexDirection: 'row',
    gap: espaco.m,
    backgroundColor: cores.cartao,
    borderRadius: raio.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
    padding: espaco.m,
  },
  faixa: { width: 4, borderRadius: raio.pilula, alignSelf: 'stretch' },
  pressionado: { opacity: 0.6 },
  etiqueta: {
    paddingHorizontal: espaco.s,
    paddingVertical: 2,
    borderRadius: raio.pilula,
    alignSelf: 'flex-start',
  },
  botao: { paddingHorizontal: espaco.g, paddingVertical: espaco.m, borderRadius: raio.m, alignItems: 'center' },
  botaoCheio: { backgroundColor: cores.giz },
  botaoVazado: { borderWidth: 1, borderColor: cores.borda },
  botaoDiscreto: { backgroundColor: 'transparent' },
  vazio: { paddingVertical: espaco.ggg, alignItems: 'center' },
})
