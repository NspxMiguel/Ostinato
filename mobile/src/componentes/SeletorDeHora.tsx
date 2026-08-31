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
import { Pressable, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { cores, espaco, fonte, raio } from '../tema.ts'
import { horaDeTexto } from '../formato.ts'

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

      {aberto ? (
        <View
          style={{
            borderRadius: raio.g,
            backgroundColor: cores.cartao,
            borderWidth: 1,
            borderColor: cores.borda,
          }}
        >
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
        </View>
      ) : null}
    </View>
  )
}
