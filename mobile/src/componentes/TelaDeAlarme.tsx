// A tela que aparece quando um aviso em modo alarme dispara com o app à mão.
//
// Tela cheia e um botão grande de propósito: quem está sendo acordado por um
// alarme não procura menu.

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { usarLoja } from '../estado/loja.ts'
import { usarT } from '../i18n.ts'
import { cores, espaco, fonte, raio } from '../tema.ts'

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
      <View style={{ gap: espaco.s, alignItems: 'center' }}>
        <Text style={fonte.secao}>
          {t(`compromisso.tipo.singular.${c?.tipo ?? 'outro'}` as never).toUpperCase()}
        </Text>
        <Text style={[fonte.titulo, { textAlign: 'center' }]}>{c?.titulo ?? ''}</Text>
        {materia ? <Text style={[fonte.apoio, { color: materia.cor }]}>{materia.nome}</Text> : null}
      </View>

      <View style={{ gap: espaco.m, alignSelf: 'stretch' }}>
        <Pressable style={[e.botao, e.principal]} onPress={aoConcluir}>
          <Text style={{ color: cores.fundo, fontWeight: '700', fontSize: 17 }}>
            {t('notificacao.acao.feito')}
          </Text>
        </Pressable>
        <Pressable style={[e.botao, e.secundario]} onPress={aoDispensar}>
          <Text style={{ color: cores.texto, fontWeight: '600', fontSize: 17 }}>
            {t('alarme.dispensar')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: cores.fundo,
    padding: espaco.gg,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 64,
  },
  botao: { paddingVertical: espaco.g, borderRadius: raio.m, alignItems: 'center' },
  principal: { backgroundColor: cores.giz },
  secundario: { borderWidth: 1, borderColor: cores.borda },
})
