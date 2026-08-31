// A casca: abas, folhas, e o laço que mantém os avisos armados.
//
// Navegação escrita à mão, sem react-navigation: são quatro abas e duas folhas,
// e uma biblioteca de navegação inteira custaria mais do que resolve.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BarraNativa } from 'barra'
import { dataDe } from '../../nucleo/tempo.ts'
import { periodoAtivo } from '../../nucleo/grade.ts'
import { usarLoja } from './estado/loja.ts'
import { usarT } from './i18n.ts'
import { cores, espaco, fonte, raio } from './tema.ts'
import {
  ACAO_ADIAR,
  ACAO_FEITO,
  calarCompromisso,
  pedirPermissao,
  registrarCategoria,
  sincronizarAvisos,
} from './avisos/notificacoes.ts'
import { pararAlarme, tocarAlarme } from './avisos/alarme.ts'
import { registrarTarefaDeFundo } from './avisos/tarefaDeFundo.ts'
import { atualizarAtividadeViva } from './avisos/atividadeViva.ts'
import { atualizarWidget } from './avisos/widget.ts'
import { Hoje } from './telas/Hoje.tsx'
import { Agenda } from './telas/Agenda.tsx'
import { Grade } from './telas/Grade.tsx'
import { Ajustes } from './telas/Ajustes.tsx'
import { Materia } from './telas/Materia.tsx'
import { NovoCompromisso } from './telas/NovoCompromisso.tsx'
import { Captura } from './telas/Captura.tsx'
import { ouvirAtalhos } from './atalhos.ts'
import { itensParaBusca } from '../../nucleo/busca.ts'
import { provasJaFeitas } from '../../nucleo/autoConcluir.ts'
import { indexar } from '../modules/busca/src/index.ts'
import { TelaDeAlarme } from './componentes/TelaDeAlarme.tsx'

type Aba = 'hoje' | 'agenda' | 'grade' | 'ajustes'

const ABAS: {
  id: Aba
  chave: 'abas.hoje' | 'abas.agenda' | 'abas.grade' | 'abas.ajustes'
  /** O SF Symbol da aba. Anda junto dela, porque a Grade pode estar desligada. */
  icone: string
}[] = [
  { id: 'hoje', chave: 'abas.hoje', icone: 'sun.max' },
  { id: 'agenda', chave: 'abas.agenda', icone: 'list.bullet' },
  { id: 'grade', chave: 'abas.grade', icone: 'calendar' },
  { id: 'ajustes', chave: 'abas.ajustes', icone: 'slider.horizontal.3' },
]

export function Raiz() {
  const t = usarT()
  const margem = useSafeAreaInsets()
  const [aba, setAba] = useState<Aba>('hoje')
  const recursos = usarLoja((s) => s.ajustes.recursos)
  // A barra mostra só o que a pessoa usa. Aba que abre um muro é pior que aba
  // que não existe.
  const abasVisiveis = ABAS.filter((a) => a.id !== 'grade' || recursos.grade)

  // Desligar a grade estando NELA deixava a tela aberta sem aba correspondente:
  // a barra some com o botão e o indicador volta para a primeira, mas o conteúdo
  // continuava sendo a grade. Quem perde a aba volta para o começo.
  useEffect(() => {
    if (!abasVisiveis.some((a) => a.id === aba)) setAba('hoje')
  }, [abasVisiveis, aba])
  const [compromissoAberto, setCompromissoAberto] = useState<string | null>(null)
  // O + abre a CAPTURA, não o formulário: escrever "prova de mat sexta" é o
  // caminho normal, e o formulário é o ajuste de quem quer mexer em detalhe.
  const [capturando, setCapturando] = useState(false)
  /** Texto que chegou de fora (Siri, Atalhos), já escrito na captura. */
  const [textoDeFora, setTextoDeFora] = useState<string | undefined>(undefined)
  const [criando, setCriando] = useState(false)
  const [materiaAberta, setMateriaAberta] = useState<string | null>(null)
  const [alarmeDe, setAlarmeDe] = useState<string | null>(null)

  const base = usarLoja((e) => e.base)
  const ajustes = usarLoja((e) => e.ajustes)
  const guardar = usarLoja((e) => e.guardar)

  // O plano é recalculado a cada mudança na base ou nos ajustes, e de novo
  // quando o app volta para a frente: o tempo passou, e a janela dos 60 avisos
  // mais próximos não é a mesma de ontem.
  const rearmar = useCallback(() => {
    const periodo = periodoAtivo(base, dataDe(new Date()))

    // Prova que já aconteceu se conclui sozinha. Ninguém marca "fiz a prova" —
    // fez, e acabou. Deixá-la pendente é o app cobrando o que não existe.
    for (const p of provasJaFeitas(base, periodo, new Date(), ajustes.inverterSemanaAlternada)) {
      guardar('compromissos', { id: p.id, concluido: true, concluidoEm: Date.now() })
    }

    void sincronizarAvisos(base, ajustes, periodo, t).then((r) => {
      // Em desenvolvimento, o resultado do rearme vai para o console: e o unico
      // jeito de conferir de fora quantos avisos o iOS realmente guardou.
      if (__DEV__) {
        console.log(
          `[ostinato] avisos: ${r.agendadas} armados (+${r.criadas} -${r.canceladas}), ` +
            `${r.cortados} fora da janela, ${r.semData.length} sem data`,
        )
      }
    })
    void atualizarAtividadeViva(base, ajustes, periodo, t)
    // O widget de tela de inicio le de um container compartilhado, entao ele
    // so muda quando alguem escreve la — este e o unico lugar que escreve.
    atualizarWidget(base, ajustes, periodo, t)
    // A busca do iPhone entra no mesmo laço: quem procura "trigonometria" na
    // tela de início acha a prova, e tocar abre ela pela mesma URL da Siri.
    void indexar(itensParaBusca(base, periodo, t, ajustes.inverterSemanaAlternada))
  }, [base, ajustes, t, guardar])

  const primeiraVez = useRef(true)
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false
      void (async () => {
        await pedirPermissao()
        await registrarCategoria(t)
        await registrarTarefaDeFundo()
        rearmar()
      })()
      return
    }
    rearmar()
  }, [rearmar, t])

  useEffect(() => {
    const inscricao = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') rearmar()
    })
    return () => inscricao.remove()
  }, [rearmar])

  // Siri, Atalhos, Spotlight: tudo o que vem de fora entra por uma URL.
  useEffect(
    () =>
      ouvirAtalhos((a) => {
        if (a.tipo === 'anotar') {
          setTextoDeFora(a.texto)
          setCapturando(true)
        } else {
          setCompromissoAberto(a.id)
        }
      }),
    [],
  )

  // Resposta à notificação: "Feito" conclui, "Adiar" silencia por 10 minutos, e
  // tocar no corpo abre o compromisso — ou a tela de alarme, quando era alarme.
  useEffect(() => {
    const inscricao = Notifications.addNotificationResponseReceivedListener((resposta) => {
      const dados = resposta.notification.request.content.data as {
        compromissoId?: string
        alarme?: boolean
      }
      const id = dados.compromissoId
      if (!id) return

      if (resposta.actionIdentifier === ACAO_FEITO) {
        guardar('compromissos', { id, concluido: true, concluidoEm: Date.now() })
        void calarCompromisso(id)
        return
      }
      if (resposta.actionIdentifier === ACAO_ADIAR) return

      if (dados.alarme) {
        setAlarmeDe(id)
        void tocarAlarme()
      } else {
        setCompromissoAberto(id)
      }
    })
    return () => inscricao.remove()
  }, [guardar])

  // Alarme com o app aberto na hora do disparo: aqui o som toca mesmo com o
  // telefone no silencioso, que é o mais longe que dá sem Critical Alerts.
  useEffect(() => {
    const inscricao = Notifications.addNotificationReceivedListener((n) => {
      const dados = n.request.content.data as { compromissoId?: string; alarme?: boolean }
      if (dados.alarme && dados.compromissoId) {
        setAlarmeDe(dados.compromissoId)
        void tocarAlarme()
      }
    })
    return () => inscricao.remove()
  }, [])

  const fecharAlarme = useCallback(() => {
    pararAlarme()
    setAlarmeDe(null)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      {/* A aba inteira reaparece a cada troca; a chave faz o React remontar e a
          `Entrada` de cada item rodar de novo, o que dá a transição. */}
      <View style={{ flex: 1 }} key={aba}>
        {aba === 'hoje' ? <Hoje aoAbrirCompromisso={setCompromissoAberto} aoIrParaGrade={() => setAba('grade')} /> : null}
        {aba === 'agenda' ? <Agenda aoAbrirCompromisso={setCompromissoAberto} /> : null}
        {aba === 'grade' ? <Grade aoAbrirMateria={setMateriaAberta} /> : null}
        {aba === 'ajustes' ? <Ajustes /> : null}
      </View>

      <BarraDeAbas
        abas={abasVisiveis}
        aba={aba}
        aoTrocar={setAba}
        aoCriar={aba === 'ajustes' ? undefined : () => setCapturando(true)}
        rotulo={(chave) => t(chave)}
        alturaSegura={margem.bottom}
      />

      <Modal
        visible={capturando}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCapturando(false)}
      >
        <Captura
          textoInicial={textoDeFora}
          aoFechar={() => {
            setCapturando(false)
            setTextoDeFora(undefined)
          }}
          aoAjustar={() => {
            setCapturando(false)
            setTextoDeFora(undefined)
            setCriando(true)
          }}
        />
      </Modal>

      <Modal
        visible={criando || compromissoAberto !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setCriando(false)
          setCompromissoAberto(null)
        }}
      >
        <NovoCompromisso
          id={compromissoAberto ?? undefined}
          aoFechar={() => {
            setCriando(false)
            setCompromissoAberto(null)
          }}
        />
      </Modal>

      <Modal
        visible={materiaAberta !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMateriaAberta(null)}
      >
        {materiaAberta ? (
          <Materia id={materiaAberta} aoFechar={() => setMateriaAberta(null)} />
        ) : null}
      </Modal>

      <Modal visible={alarmeDe !== null} animationType="fade" transparent={false}>
        {alarmeDe ? (
          <TelaDeAlarme
            compromissoId={alarmeDe}
            aoDispensar={fecharAlarme}
            aoConcluir={() => {
              guardar('compromissos', { id: alarmeDe, concluido: true, concluidoEm: Date.now() })
              void calarCompromisso(alarmeDe)
              fecharAlarme()
            }}
          />
        ) : null}
      </Modal>
    </View>
  )
}

/**
 * Os ícones das abas, desenhados em formas geométricas.
 *
 * Sem biblioteca de ícones de propósito: Lucide em tudo é um dos sinais mais
 * confiáveis de interface gerada, e quatro formas simples não justificam uma
 * dependência. Ativo é BRANCO PLENO, não a cor de destaque — destaque é ação, e
 * navegação não é ação.
 */
function IconeDaAba({ id, ativo }: { id: Aba; ativo: boolean }) {
  const cor = ativo ? cores.texto : cores.texto3
  if (id === 'hoje') {
    return <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: cor }} />
  }
  if (id === 'agenda') {
    return (
      <View style={{ width: 22, height: 22, justifyContent: 'space-evenly', paddingVertical: 2 }}>
        {[14, 22, 18].map((l, i) => (
          <View key={i} style={{ height: 2.5, width: l, borderRadius: 1.5, backgroundColor: cor }} />
        ))}
      </View>
    )
  }
  if (id === 'grade') {
    return (
      <View style={{ width: 22, height: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: cor }} />
        ))}
      </View>
    )
  }
  return (
    <View style={{ width: 22, height: 22, justifyContent: 'space-evenly', paddingVertical: 2 }}>
      {[4, 13, 8].map((x, i) => (
        <View key={i} style={{ height: 2.5, width: 22, borderRadius: 1.5, backgroundColor: cor, opacity: 0.45 }}>
          <View
            style={{
              position: 'absolute',
              left: x,
              top: -2,
              width: 6.5,
              height: 6.5,
              borderRadius: 3.25,
              backgroundColor: cor,
            }}
          />
        </View>
      ))}
    </View>
  )
}

function BarraDeAbas({
  abas,
  aba,
  aoTrocar,
  aoCriar,
  rotulo,
  alturaSegura,
}: {
  abas: typeof ABAS
  aba: Aba
  aoTrocar: (a: Aba) => void
  aoCriar?: () => void
  rotulo: (chave: 'abas.hoje' | 'abas.agenda' | 'abas.grade' | 'abas.ajustes') => string
  alturaSegura: number
}) {
  // No iOS 26 a barra é vidro de verdade; nos outros o `Vidro` vira View e a cor
  // de fundo abaixo é que aparece.
  // A barra inteira é nativa. Montar Liquid Glass do lado do JavaScript não
  // funciona: o `UIGlassContainerEffect` exige as peças de vidro como IRMÃS no
  // `contentView` dele, e uma árvore React aninha — arranjo em que o `spacing`
  // não funde nada e o arrasto não existe. Ver `modules/barra/ios`.
  return (
    <View style={[e.ancora, { paddingBottom: Math.max(alturaSegura, espaco.m) }]} pointerEvents="box-none">
      {aoCriar ? (
        <Pressable style={e.mais} onPress={aoCriar} accessibilityRole="button">
          <Text style={{ color: cores.sobreDestaque, fontSize: 28, fontWeight: '400', marginTop: -3 }}>
            +
          </Text>
        </Pressable>
      ) : null}

      <BarraNativa
        style={e.barra}
        rotulos={abas.map((a) => rotulo(a.chave))}
        icones={abas.map((a) => a.icone)}
        ativa={Math.max(0, abas.findIndex((a) => a.id === aba))}
        aoTrocar={(ev: { nativeEvent: { indice: number } }) => {
          const alvo = abas[ev.nativeEvent.indice]
          if (alvo) aoTrocar(alvo.id)
        }}
      />
    </View>
  )
}

const e = StyleSheet.create({
  // O FAB fica ACIMA da barra e alinhado à direita dela, não solto no canto: o
  // botão flutuando sozinho passava por cima do texto da lista.
  ancora: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: espaco.m },
  barra: { height: 60, marginHorizontal: espaco.m },
  mais: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginRight: espaco.m,
  },
})

