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

import { Children, useEffect, useRef, type ReactNode } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { cores, espaco, fonte, raio } from '../tema.ts'

export function Tela({ children, titulo }: { children: ReactNode; titulo?: string }) {
  const margem = useSafeAreaInsets()
  return (
    <View style={[e.tela, { paddingTop: margem.top }]}>
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
        {/* O título rola COM o conteúdo, como o título grande do iOS.
            Fixo — que era como estava — ele ficava por cima do primeiro item e
            cortava o texto pela metade, porque não há fundo por baixo dele. */}
        {titulo ? <Text style={[fonte.titulo, e.tituloTela]}>{titulo}</Text> : null}
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
  // A escala usa `Animated` do próprio React Native, e não Reanimated: este é o
  // componente mais usado do app inteiro, e o custo de ele depender do plugin de
  // babel é alto demais para o ganho.
  const escala = useRef(new Animated.Value(1)).current

  const animar = (para: number) =>
    Animated.spring(escala, {
      toValue: para,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start()

  if (!aoTocar) return <View style={estilo}>{children}</View>
  return (
    <Pressable
      onPress={aoTocar}
      onPressIn={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        animar(0.96)
      }}
      onPressOut={() => animar(1)}
    >
      <Animated.View style={[estilo, { transform: [{ scale: escala }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

/**
 * Entrada de item de lista: sobe um pouco e aparece.
 *
 * O `atraso` escalona os itens, e é ele que faz a lista parecer que se monta em
 * vez de piscar pronta. Acima de ~8 itens o escalonamento para de crescer: uma
 * lista de trinta tarefas levaria quase um segundo para terminar de aparecer, e
 * aí a animação vira espera.
 */
export function Entrada({ children, indice = 0 }: { children: ReactNode; indice?: number }) {
  const p = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: 260,
      delay: Math.min(indice, 8) * 35,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [indice, p])
  return (
    <Animated.View
      style={{
        opacity: p,
        transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
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
 * Um cartão. Raio grande, um fio de borda, e um degradê de branco quase
 * invisível por dentro.
 *
 * É a forma do LootFlow, e ela existe por um motivo que eu tinha ignorado:
 * cartão CHAPADO sobre preto puro vira mancha cinza, e lista SEM cartão nenhum
 * vira texto solto no vazio. O degradê dá volume sem virar cinza — o topo tem
 * 5,5% de branco e a base 1,2%, e a diferença entre os dois é o que o olho lê
 * como superfície.
 *
 * O padding mora DENTRO do degradê, então ele é propriedade e não estilo de
 * fora: um `padding` no invólucro deixaria uma moldura sem preenchimento.
 */
export function Cartao({
  children,
  aoTocar,
  faixa,
  padding = 16,
}: {
  children: ReactNode
  aoTocar?: () => void
  /** Cor da matéria. Vira bolinha, não tarja lateral. */
  faixa?: string
  padding?: number
}) {
  return (
    <Toque aoTocar={aoTocar} estilo={e.cartao}>
      <LinearGradient
        colors={[cores.cartaoDe, cores.cartaoAte]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={{ padding, flexDirection: 'row', gap: espaco.m }}
      >
        {faixa ? (
          <View style={{ paddingTop: 5 }}>
            <Bolinha cor={faixa} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 3 }}>{children}</View>
      </LinearGradient>
    </Toque>
  )
}

/**
 * Um grupo: um cartão que guarda linhas separadas por fio.
 *
 * É o que dá ordem a uma tela de ajustes. Seis seções soltas sobre preto não
 * têm onde começar nem terminar; dentro de um grupo, o fio entre as linhas faz
 * o trabalho que o espaço sozinho não faz.
 */
export function Grupo({ children }: { children: ReactNode }) {
  const filhos = Children.toArray(children)
  return (
    <View style={e.cartao}>
      <LinearGradient
        colors={[cores.cartaoDe, cores.cartaoAte]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
      >
        {filhos.map((filho, i) => (
          <View key={i} style={i === 0 ? undefined : e.comFio}>
            {filho}
          </View>
        ))}
      </LinearGradient>
    </View>
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

/**
 * Chip que liga e desliga: filtro, tipo, matéria, modo de aviso.
 *
 * É vidro de verdade quando o aparelho tem (iOS 26), no mesmo molde que o
 * LootFlow usa: `Vidro` com `overflow: hidden`, contorno fino, e tonalidade só
 * quando a pílula está ativa. Abaixo do iOS 26 vira View com cor sólida — o
 * `Vidro` não desenha nada por si, e sem o fallback a pílula sumiria.
 */
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
  const comVidro = isLiquidGlassAvailable()
  const conteudo = (
    <>
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
    </>
  )

  if (!comVidro) {
    return (
      <Toque aoTocar={aoTocar} estilo={[e.pilula, ativa ? e.pilulaAtiva : null]}>
        {conteudo}
      </Toque>
    )
  }

  return (
    <Toque aoTocar={aoTocar}>
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        // Alfa baixo, e NÃO `cores.texto`: tingir vidro de branco pleno devolve
        // uma pílula branca opaca com texto branco em cima — ilegível. A seleção
        // é uma diferença de luz, não uma troca de cor.
        tintColor={ativa ? 'rgba(255,255,255,0.20)' : undefined}
        style={e.pilulaVidro}
      >
        {conteudo}
      </GlassView>
    </Toque>
  )
}

/**
 * Botão. Vidro no iOS 26, no mesmo molde do LootFlow.
 *
 * `cheio` é o botão de AÇÃO e leva a cor de destaque como tonalidade do vidro —
 * é assim que a Apple faz o botão proeminente do iOS 26: vidro tingido, não um
 * retângulo chapado. `vazado` é o mesmo material sem tinta, e `discreto` não é
 * vidro nenhum, porque um terceiro material na mesma tela vira ruído.
 */
export function Botao({
  texto,
  aoTocar,
  variante = 'cheio',
}: {
  texto: string
  aoTocar: () => void
  variante?: 'cheio' | 'vazado' | 'discreto'
}) {
  const comVidro = isLiquidGlassAvailable()
  const corTexto =
    variante === 'cheio' ? cores.texto : variante === 'vazado' ? cores.texto : cores.textoFraco
  const rotulo = (
    <Text style={{ fontSize: 16, fontWeight: '600', color: corTexto, textAlign: 'center' }}>
      {texto}
    </Text>
  )

  if (variante === 'discreto') {
    return (
      <Toque aoTocar={aoTocar} estilo={[e.botao, e.botaoDiscreto]}>
        {rotulo}
      </Toque>
    )
  }

  if (!comVidro) {
    // Sem Liquid Glass o cheio volta a ser sólido, e aí o texto precisa ser
    // preto: amarelo com texto branco em cima não tem contraste.
    return (
      <Toque
        aoTocar={aoTocar}
        estilo={[e.botao, variante === 'cheio' ? e.botaoCheio : e.botaoVazado]}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: variante === 'cheio' ? cores.sobreDestaque : cores.texto,
            textAlign: 'center',
          }}
        >
          {texto}
        </Text>
      </Toque>
    )
  }

  return (
    <Toque aoTocar={aoTocar}>
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        tintColor={variante === 'cheio' ? cores.destaque : undefined}
        style={e.botaoVidro}
      >
        {rotulo}
      </GlassView>
    </Toque>
  )
}

/**
 * Estado vazio.
 *
 * Antes era uma frase cinza centrada no meio de uma tela preta, e é isso que
 * fazia o app parecer não terminado: a primeira coisa que TODO usuário novo vê
 * era um vazio com uma legenda.
 *
 * Um estado vazio da Apple tem três partes — uma forma, um título, e uma AÇÃO.
 * A ação é a que muda tudo: "cadastre sua grade na aba Grade" é um beco sem
 * saída que manda a pessoa procurar; um botão leva ela lá.
 */
export function Vazio({
  texto,
  titulo,
  acao,
  aoAgir,
}: {
  texto: string
  titulo?: string
  acao?: string
  aoAgir?: () => void
}) {
  return (
    <View style={e.vazio}>
      {/* Um anel, não um ícone de biblioteca: é a mesma forma da aba Hoje e do
          alarme, e é o mais perto de uma marca que este app tem. */}
      <View style={e.anelVazio} />
      {titulo ? <Text style={[fonte.tituloItem, { textAlign: 'center' }]}>{titulo}</Text> : null}
      <Text style={[fonte.apoio, { textAlign: 'center', color: cores.texto3, maxWidth: 280 }]}>
        {texto}
      </Text>
      {acao && aoAgir ? <Botao texto={acao} variante="vazado" aoTocar={aoAgir} /> : null}
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

/**
 * Linha de menu: título, um resumo à direita, e a seta.
 *
 * É o que troca o Ajustes de "tudo aberto ao mesmo tempo" por "escolha o que
 * abrir". Uma tela de ajustes que mostra as regras dos seis tipos de compromisso
 * de uma vez não é completa, é ilegível.
 */
export function LinhaDeMenu({
  titulo,
  valor,
  aoTocar,
}: {
  titulo: string
  valor?: string
  aoTocar: () => void
}) {
  return (
    <Toque aoTocar={aoTocar} estilo={e.linhaDeMenu}>
      <Text style={[fonte.corpo, { flex: 1 }]}>{titulo}</Text>
      {valor ? (
        <Text style={[fonte.apoio, { color: cores.texto3 }]} numberOfLines={1}>
          {valor}
        </Text>
      ) : null}
      <Text style={{ color: cores.texto4, fontSize: 20, marginTop: -2 }}>›</Text>
    </Toque>
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
  tituloTela: { paddingTop: espaco.xs, marginBottom: -espaco.s },
  cartao: {
    borderRadius: raio.cartao,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
    overflow: 'hidden',
  },
  comFio: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cores.borda },
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
  botaoVidro: {
    paddingHorizontal: espaco.gg,
    paddingVertical: espaco.m + 2,
    borderRadius: raio.pilula,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pilulaVidro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: espaco.m + 2,
    paddingVertical: espaco.s + 1,
    borderRadius: raio.pilula,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
  botaoCheio: { backgroundColor: cores.destaque },
  botaoVazado: { borderWidth: 1, borderColor: cores.borda },
  botaoDiscreto: { backgroundColor: 'transparent' },
  linhaDeMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.g,
    // 44pt é o alvo mínimo da Apple, e linha de menu é o alvo mais tocado de
    // uma tela de ajustes.
    minHeight: 44,
    paddingVertical: espaco.s,
  },
  vazio: {
    // Altura mínima com centralização: encostado no topo, o estado vazio deixa
    // um vazio enorme embaixo e a tela parece que não terminou de carregar.
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
    gap: espaco.m,
  },
  anelVazio: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: cores.texto4,
    marginBottom: espaco.xs,
  },
})
