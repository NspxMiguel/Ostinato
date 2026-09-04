// A roda de horas do app Relógio, e não um campo para digitar.
//
// Pedido dele em 30/08/2026: *"ao invez de colocar o horario manualmente, faz q
// nem o app relogio, q tem aql scroll de horarios sabe?"*
//
// O ganho não é só de conforto. Digitar hora tem três defeitos que a roda não
// tem: o teclado do iPhone corrige o que foi escrito, "9:5" passa por uma
// validação frouxa, e — o que estragou de verdade aqui — o campo era 24h fixo
// enquanto o telefone dele estava em 12h. Ele escreveu 10:08 querendo 22:08 e o
// alarme foi armado doze horas fora do lugar, sem erro nenhum na tela.
//
// A roda resolve isso na origem: ela é o seletor do sistema, então mostra AM/PM
// ou 0–23 conforme o ajuste "Hora de 24 horas" do próprio iPhone, e devolve
// sempre "HH:MM" em 24h para o app guardar. O que a pessoa vê e o que o app
// guarda deixam de ser a mesma coisa — e é isso que estava errado antes.

import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { criarFonte, espaco, raio, usarCores } from '../tema.ts'
import { horaDeTexto } from '../formato.ts'
import { usarT } from '../i18n.ts'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const doisDigitos = (n: number) => String(n).padStart(2, '0')

/** "HH:MM" -> Date de hoje nessa hora. Entrada torta vira meio-dia. */
function paraDate(hhmm: string): Date {
  const [h, m] = (hhmm || '12:00').split(':').map(Number)
  const d = new Date()
  d.setHours(Number.isFinite(h) ? (h as number) : 12, Number.isFinite(m) ? (m as number) : 0, 0, 0)
  return d
}

export function SeletorDeHora({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string
  /** "HH:MM", sempre em 24h — é o formato que o núcleo guarda. */
  valor: string
  aoMudar: (hhmm: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const t = usarT()
  const margem = useSafeAreaInsets()
  const cores = usarCores()
  const fonte = criarFonte(cores)

  return (
    <View style={{ gap: espaco.s, flex: 1 }}>
      <Pressable
        onPress={() => setAberto((v) => !v)}
        style={{
          gap: 2,
          paddingVertical: espaco.m,
          paddingHorizontal: espaco.g,
          borderRadius: raio.m,
          backgroundColor: aberto ? cores.cartaoAlto : cores.cartao,
          borderWidth: 1,
          borderColor: aberto ? cores.destaque : cores.borda,
        }}
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: ${horaDeTexto(valor)}`}
      >
        <Text style={fonte.secao}>{rotulo}</Text>
        <Text style={[fonte.corpo, { fontWeight: '600' }]}>{horaDeTexto(valor)}</Text>
      </Pressable>

      {/* A roda vem numa FOLHA de baixo, e não embutida na linha.
          
          Embutida ela herda a largura de quem a contém — e aqui o campo divide a
          linha com "Dias antes", então a roda saía espremida em metade da tela,
          com a coluna de AM/PM cortada. Folha é também o que o iPhone faz quando
          o seletor não cabe: a roda ganha a largura inteira e nada mais disputa
          o toque com ela. */}
      <Modal
        visible={aberto}
        transparent
        animationType="slide"
        onRequestClose={() => setAberto(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setAberto(false)} />
        <View
          style={{
            // OPACO, e não `cores.cartaoAlto`.
            //
            // Aquela cor é branco com 11% de alfa — feita para se apoiar sobre o
            // fundo preto de uma tela. Aqui ela flutua num `Modal` transparente,
            // e o que apareceu foi a tela de trás inteira ATRAVÉS da roda:
            // "Allow the alarm" escrito por cima dos números. Folha precisa de
            // fundo próprio.
            backgroundColor: cores.fundoElevado,
            borderTopLeftRadius: raio.g,
            borderTopRightRadius: raio.g,
            paddingHorizontal: espaco.g,
            // A margem segura ENTRA na conta: 32pt fixos deixavam o botão de
            // fechar por baixo da barra de gestos do iPhone. No simulador passa
            // raspando, num aparelho com barra alta não passa.
            paddingBottom: Math.max(margem.bottom, espaco.m) + espaco.m,
            paddingTop: espaco.m,
            gap: espaco.s,
          }}
        >
          <Text style={[fonte.secao, { textAlign: 'center' }]}>{rotulo}</Text>
          {/* Sem `locale`: passar um sobrescreve o ajuste de 12h/24h do iPhone,
              que é justamente o defeito que este componente veio consertar. */}
          <DateTimePicker
            value={paraDate(valor)}
            mode="time"
            display="spinner"
            themeVariant="dark"
            onChange={(_e, d) => {
              if (d) aoMudar(`${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`)
            }}
            accessibilityLabel={rotulo}
          />
          <Pressable
            onPress={() => setAberto(false)}
            style={{
              backgroundColor: cores.destaque,
              borderRadius: raio.m,
              paddingVertical: espaco.m,
              alignItems: 'center',
            }}
            accessibilityRole="button"
          >
            <Text style={[fonte.corpo, { color: cores.sobreDestaque, fontWeight: '600' }]}>
              {t('acao.fechar')}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}
