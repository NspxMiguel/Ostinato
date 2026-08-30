// A porta de entrada das matérias.
//
// A tela de matéria (notas, média, faltas) precisava de um caminho, e enfiar uma
// quinta aba por causa dela deixaria a barra cheia para uma tela que se visita
// de vez em quando. Como matéria e grade são o mesmo assunto, ela mora aqui.

import { Pressable, ScrollView, Text, View } from 'react-native'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarT } from '../i18n.ts'
import { cores, espaco, fonte, raio } from '../tema.ts'

export function TiraDeMaterias({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const t = usarT()
  const materias = vivos(usarLoja((e) => e.base.materias))
  if (materias.length === 0) return null

  return (
    <View style={{ gap: espaco.s, paddingTop: espaco.s }}>
      <Text style={[fonte.secao, { paddingHorizontal: espaco.g }]}>
        {t('materias.titulo').toUpperCase()}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: espaco.g, gap: espaco.s }}
      >
        {materias
          .slice()
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map((m) => (
            <Pressable
              key={m.id}
              onPress={() => aoAbrir(m.id)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: espaco.s,
                  paddingHorizontal: espaco.m,
                  paddingVertical: espaco.s,
                  borderRadius: raio.pilula,
                  backgroundColor: cores.cartao,
                  borderWidth: 1,
                  borderColor: cores.borda,
                },
                pressed ? { opacity: 0.6 } : null,
              ]}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.cor }} />
              <Text style={fonte.corpo}>{m.nome}</Text>
            </Pressable>
          ))}
      </ScrollView>
    </View>
  )
}
