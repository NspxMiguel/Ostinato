// A porta de entrada das matérias.
//
// A tela de matéria (notas, média, faltas) precisava de um caminho, e enfiar uma
// quinta aba por causa dela deixaria a barra cheia para uma tela que se visita
// de vez em quando. Como matéria e grade são o mesmo assunto, ela mora aqui.
//
// Era uma tira que ROLAVA na horizontal; virou lista vertical em 03/09/2026 para
// caber o deslizar-para-apagar. Deslizar dentro de um ScrollView horizontal
// disputa o mesmo eixo do gesto de rolagem, e o resultado é uma lista que às
// vezes rola e às vezes abre o botão vermelho — a ambiguidade que faz a pessoa
// achar que o app travou.

import { Alert, StyleSheet, Text, View } from 'react-native'
// O `Pressable` é o do gesture-handler, NÃO o do React Native.
//
// O do RN disputa o toque com o `Swipeable` que envolve a linha, e vence: ele
// vira o responder assim que o dedo encosta, e o arrastar nunca começa. Medido
// em 03/09/2026 — o mesmo deslizar funcionava na Agenda, onde o filho direto do
// `Swipeable` é uma View e o toque mora em elementos menores lá dentro; aqui o
// tocável ocupa a linha inteira, então não sobra lugar por onde puxar. O do
// gesture-handler participa da mesma árvore de gestos e cede o pan.
import { Pressable } from 'react-native-gesture-handler'
import type { Materia } from '../../../nucleo/modelo.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { apagarMateria, oQueVaiJunto } from '../apagarMateria.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarT } from '../i18n.ts'
import { cores, espaco, fonte, raio } from '../tema.ts'
import { Deslizar } from './Deslizar.tsx'

export function TiraDeMaterias({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const t = usarT()
  const base = usarLoja((e) => e.base)
  const remover = usarLoja((e) => e.remover)
  const materias = vivos(base.materias)
  if (materias.length === 0) return null

  // Apagar matéria leva aula, nota e falta junto. Deslizar é um gesto de um dedo
  // e sem desfazer — então ele PERGUNTA, e a pergunta diz o que vai junto em
  // número, não em "tem certeza?".
  function confirmarRemocao(m: Materia) {
    const { aulas, notas, faltas } = oQueVaiJunto(base, m.id)
    Alert.alert(
      t('materia.apagar_titulo', { nome: m.nome }),
      t('materia.apagar_texto', {
        aulas: aulas.length,
        notas: notas.length,
        faltas: faltas.length,
      }),
      [
        { text: t('acao.cancelar'), style: 'cancel' },
        {
          text: t('materias.remover'),
          style: 'destructive',
          onPress: () => apagarMateria(base, m.id, remover),
        },
      ],
    )
  }

  return (
    <View style={{ gap: espaco.s }}>
      <Text style={fonte.secao}>{t('materias.titulo')}</Text>
      <View style={{ gap: espaco.s }}>
        {materias
          .slice()
          .sort((a: Materia, b: Materia) => a.nome.localeCompare(b.nome))
          .map((m: Materia) => (
            <Deslizar
              key={m.id}
              aoRemover={() => confirmarRemocao(m)}
              rotuloRemover={t('materias.remover')}
            >
              <Pressable
                onPress={() => aoAbrir(m.id)}
                // Segurar também apaga.
                //
                // O deslizar é o gesto pedido, e ele funciona na Agenda com este
                // mesmo componente — mas nesta linha não abre, e eu ainda não sei
                // por quê (quatro hipóteses medidas e descartadas em 03/09/2026:
                // o Pressable do RN roubando o toque, a distância do arrasto, o
                // limite da esquerda, e o painel esquerdo ausente). Enquanto isso
                // não fecha, segurar é o caminho que funciona — e é o mesmo gesto
                // que o app já usa para apagar som importado, então não é
                // vocabulário novo.
                onLongPress={() => confirmarRemocao(m)}
                delayLongPress={500}
                style={({ pressed }) => [e.linha, pressed ? e.pressionada : null]}
              >
                <View style={[e.ponto, { backgroundColor: m.cor }]} />
                <Text style={fonte.corpo}>{m.nome}</Text>
              </Pressable>
            </Deslizar>
          ))}
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  // Opaco de propósito: é o conteúdo que desliza por cima do painel vermelho.
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.m,
    borderRadius: raio.cartao,
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  // O `Toque` do app dá o retorno de toque encolhendo a linha; aqui ele não
  // serve (ver o comentário do import), então o retorno é a própria linha
  // clareando — que é o que o iOS faz numa lista.
  pressionada: { backgroundColor: cores.fundoElevado },
  ponto: { width: 8, height: 8, borderRadius: 4 },
})
