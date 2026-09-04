// Escolher dia e hora tocando, não digitando.
//
// Antes disto o vencimento era um `TextInput` com placeholder `AAAA-MM-DD`. Além
// de lento, digitar data no iPhone é onde a correção automática estraga o texto
// em silêncio — foi o que já aconteceu aqui com "Seg" virando "Set".
//
// O calendário é o do sistema (`display="inline"`), não um desenhado por nós, e a
// razão não é preguiça: ele já vem com os quatro idiomas, com o primeiro dia da
// semana certo em cada região, com Dynamic Type e com VoiceOver. Um calendário de
// brinquedo teria que reimplementar tudo isso para ficar pior.

import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { criarFonte, espaco, raio, usarCores } from '../tema.ts'
import { horaDoAparelho } from '../formato.ts'

type Props = {
  /** "AAAA-MM-DD" */
  data: string
  /** "HH:MM" */
  hora: string
  aoMudar: (data: string, hora: string) => void
  /**
   * Locale do CALENDÁRIO: vem do idioma escolhido no app, não do aparelho —
   * assim o nome do mês acompanha a interface.
   *
   * A HORA é o oposto, e essa distinção custou um defeito. Passar este locale
   * para o seletor de hora sobrescreve o ajuste "Hora de 24 horas" do iPhone:
   * `pt-BR` força 24h, e quem tem o telefone em 12h escolhe 10:08 pensando em
   * 22:08 — foi exatamente o que aconteceu. Formato de relógio é ajuste do
   * APARELHO, não do app, e por isso o seletor de hora não recebe locale nenhum.
   */
  locale?: string
  rotuloData: string
  rotuloHora: string
}

/** "AAAA-MM-DD" + "HH:MM" -> Date local. Entrada inválida vira hoje às 23:59. */
function paraDate(data: string, hora: string): Date {
  const [a, m, d] = data.split('-').map(Number)
  const [h, min] = (hora || '23:59').split(':').map(Number)
  const feita = new Date(
    a || 0,
    (m || 1) - 1,
    d || 1,
    Number.isFinite(h) ? h : 23,
    Number.isFinite(min) ? min : 59,
  )
  if (Number.isNaN(feita.getTime())) {
    const agora = new Date()
    agora.setHours(23, 59, 0, 0)
    return agora
  }
  return feita
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')

function paraTexto(d: Date): { data: string; hora: string } {
  return {
    data: `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`,
    hora: `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`,
  }
}

export function SeletorDeData({ data, hora, aoMudar, locale, rotuloData, rotuloHora }: Props) {
  const cores = usarCores()
  const fonte = criarFonte(cores)
  const [aberto, setAberto] = useState(false)
  const [horaAberta, setHoraAberta] = useState(false)
  const valor = paraDate(data, hora)
  // Formatada pelo aparelho: "22:08" num iPhone em 24h, "10:08 PM" num em 12h.
  const horaPorExtenso = horaDoAparelho(valor)

  // O texto da pílula é formatado pelo Intl, então "3 de set." em pt e "Sep 3" em
  // en saem sozinhos — sem tabela de meses nossa em quatro idiomas.
  const porExtenso = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(valor)

  function mudar(d: Date) {
    const { data: nd, hora: nh } = paraTexto(d)
    aoMudar(nd, nh)
  }

  return (
    <View style={{ gap: espaco.s }}>
      <View style={{ flexDirection: 'row', gap: espaco.s }}>
        <Pressable
          onPress={() => {
            setAberto((v) => !v)
            setHoraAberta(false)
          }}
          style={{
            flex: 1,
            gap: 2,
            paddingVertical: espaco.m,
            paddingHorizontal: espaco.g,
            borderRadius: raio.m,
            backgroundColor: aberto ? cores.cartaoAlto : cores.cartao,
            borderWidth: 1,
            borderColor: aberto ? cores.destaque : cores.borda,
          }}
          accessibilityRole="button"
          accessibilityLabel={`${rotuloData}: ${porExtenso}`}
        >
          <Text style={fonte.secao}>{rotuloData}</Text>
          <Text style={[fonte.corpo, { fontWeight: '600' }]}>{porExtenso}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setHoraAberta((v) => !v)
            setAberto(false)
          }}
          style={{
            gap: 2,
            paddingVertical: espaco.m,
            paddingHorizontal: espaco.g,
            borderRadius: raio.m,
            backgroundColor: horaAberta ? cores.cartaoAlto : cores.cartao,
            borderWidth: 1,
            borderColor: horaAberta ? cores.destaque : cores.borda,
            justifyContent: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel={`${rotuloHora}: ${horaPorExtenso}`}
        >
          <Text style={fonte.secao}>{rotuloHora}</Text>
          <Text style={[fonte.corpo, { fontWeight: '600' }]}>{horaPorExtenso}</Text>
        </Pressable>
      </View>

      {horaAberta ? (
        <View
          style={{
            borderRadius: raio.g,
            backgroundColor: cores.cartao,
            borderWidth: 1,
            borderColor: cores.borda,
          }}
        >
          {/* A roda do app Relógio, e não o campo compacto: é o gesto que todo
              mundo já conhece de pôr despertador. E SEM `locale`, para o 12h/24h
              sair do ajuste do iPhone. */}
          <DateTimePicker
            value={valor}
            mode="time"
            display="spinner"
            themeVariant="dark"
            onChange={(_evento, escolhida) => escolhida && mudar(escolhida)}
            accessibilityLabel={rotuloHora}
          />
        </View>
      ) : null}

      {aberto ? (
        <View
          style={{
            borderRadius: raio.g,
            backgroundColor: cores.cartao,
            borderWidth: 1,
            borderColor: cores.borda,
            paddingHorizontal: espaco.s,
          }}
        >
          <DateTimePicker
            value={valor}
            mode="date"
            display="inline"
            locale={locale}
            onChange={(_evento, escolhida) => escolhida && mudar(escolhida)}
          />
        </View>
      ) : null}
    </View>
  )
}
