// O vocabulário visual do Ostinato.
//
// Existe para que telas escritas por pessoas (e agentes) diferentes não virem
// três apps dentro de um. Tela nova compõe estas peças; se faltar alguma, ela
// nasce AQUI, não solta dentro de uma tela.
//
// A regra que governa este arquivo desde o redesenho de 30/08/2026:
//
//   LISTA NÃO TEM CARTÃO E NÃO TEM BORDA. A separação entre itens é ESPAÇO.
//
// Cartão com contorno em cima de preto puro devolve a "grade de caixinhas" que
// todo gerador produz. Sem contorno, o que separa os itens é o vazio — e o vazio
// é parte do desenho, não sobra.
//
// Sombra em caixa não existe aqui. Elevação, quando precisa existir, é feita com
// branco em alfa (`cartao`, `cartaoAlto`), que é o que o iOS faz.

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
        contentContainerStyle={{
          padding: espaco.g,
          // A barra de abas flutua por cima: o conteúdo precisa poder passar
          // por baixo dela sem que o último item fique inalcançável.
          paddingBottom: margem.bottom + 112,
          gap: espaco.gg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  )
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={{ gap: espaco.m }}>
      {/* Sentence case. Caixa alta em rótulo de seção é maneirismo de painel
          administrativo, e o iOS parou de fazer isso faz anos. */}
      <Text style={fonte.secao}>{titulo}</Text>
      <View style={{ gap: espaco.m }}>{children}</View>
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

/** A bolinha de cor da matéria. É identidade de item, não decoração. */
export function Bolinha({ cor, tamanho = 9 }: { cor: string; tamanho?: number }) {
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: cor,
      }}
    />
  )
}

/**
 * Uma linha de lista. Sem fundo, sem contorno, sem sombra.
 *
 * Mantém o nome `Cartao` porque as sete telas já o chamam assim — mas ele deixou
 * de desenhar um cartão em 30/08/2026, e o nome é o único resto disso.
 */
export function Cartao({
  children,
  aoTocar,
  faixa,
}: {
  children: ReactNode
  aoTocar?: () => void
  /** Cor da matéria. Vira bolinha, não mais tarja lateral. */
  faixa?: string
}) {
  return (
    <Toque aoTocar={aoTocar} estilo={e.linhaDeLista}>
      {faixa ? <View style={{ paddingTop: 6 }}><Bolinha cor={faixa} /></View> : null}
      <View style={{ flex: 1, gap: 3 }}>{children}</View>
    </Toque>
  )
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={fonte.tituloItem}>{children}</Text>
}

export function Apoio({ children, cor }: { children: ReactNode; cor?: string }) {
  return <Text style={[fonte.apoio, cor ? { color: cor } : undefined]}>{children}</Text>
}

export function Etiqueta({ texto, cor }: { texto: string; cor?: string }) {
  // Sem `cor`, a etiqueta é neutra. Com `cor`, ela é ESTADO — e aí o texto herda
  // a cor e o fundo fica translúcido, para não virar um bloco chapado.
  return (
    <View style={[e.etiqueta, cor ? { borderColor: cor } : null]}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: cor ?? cores.textoFraco }}>
        {texto}
      </Text>
    </View>
  )
}

/** Chip que liga e desliga: filtro, tipo, matéria, modo de aviso. */
export function Pilula({
  texto,
  ativa,
  aoTocar,
  cor,
}: {
  texto: string
  ativa?: boolean
  aoTocar?: () => void
  /** Bolinha à esquerda — usada quando a pílula representa uma matéria. */
  cor?: string
}) {
  return (
    <Toque aoTocar={aoTocar} estilo={[e.pilula, ativa ? e.pilulaAtiva : null]}>
      {cor ? <Bolinha cor={cor} tamanho={7} /> : null}
      <Text
        style={{
          fontSize: 14,
          fontWeight: ativa ? '600' : '400',
          color: ativa ? cores.texto : cores.textoFraco,
        }}
      >
        {texto}
      </Text>
    </Toque>
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
  // Cheio usa a cor de destaque, e só ele: destaque é AÇÃO. Botão secundário é
  // vazado; se dois botões da mesma tela forem amarelos, nenhum é o principal.
  const corTexto =
    variante === 'cheio' ? cores.sobreDestaque : variante === 'vazado' ? cores.texto : cores.textoFraco
  return (
    <Toque aoTocar={aoTocar} estilo={[e.botao, estilo]}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: corTexto, textAlign: 'center' }}>
        {texto}
      </Text>
    </Toque>
  )
}

export function Vazio({ texto }: { texto: string }) {
  return (
    <View style={e.vazio}>
      <Text style={[fonte.apoio, { textAlign: 'center', color: cores.texto3 }]}>{texto}</Text>
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

/** Fileira de pílulas que quebra linha. PT e FR correm ~30% mais longos que EN. */
export function Fileira({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>{children}</View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  tituloTela: { paddingHorizontal: espaco.g, paddingTop: espaco.s, paddingBottom: espaco.xs },
  linhaDeLista: { flexDirection: 'row', gap: espaco.m, alignItems: 'flex-start' },
  pressionado: { opacity: 0.55 },
  etiqueta: {
    paddingHorizontal: espaco.s,
    paddingVertical: 2,
    borderRadius: raio.pilula,
    borderWidth: 1,
    borderColor: cores.borda,
    alignSelf: 'flex-start',
  },
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: espaco.m + 2,
    paddingVertical: espaco.s + 1,
    borderRadius: raio.pilula,
    backgroundColor: cores.cartao,
  },
  pilulaAtiva: { backgroundColor: cores.cartaoAlto },
  botao: {
    paddingHorizontal: espaco.gg,
    paddingVertical: espaco.m + 2,
    borderRadius: raio.pilula,
    alignItems: 'center',
  },
  botaoCheio: { backgroundColor: cores.destaque },
  botaoVazado: { borderWidth: 1, borderColor: cores.borda },
  botaoDiscreto: { backgroundColor: 'transparent' },
  vazio: { paddingVertical: espaco.ggg, alignItems: 'center' },
})
