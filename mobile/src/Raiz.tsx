// A casca: abas, folhas, e o laço que mantém os avisos armados.
//
// Navegação escrita à mão, sem react-navigation: são quatro abas e duas folhas,
// e uma biblioteca de navegação inteira custaria mais do que resolve.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Tabs } from 'react-native-screens'
import { dataDe } from '../../nucleo/tempo.ts'
import { periodoAtivo } from '../../nucleo/grade.ts'
import { usarLoja } from './estado/loja.ts'
import { usarT } from './i18n.ts'
import { cores, espaco, fonte, raio } from './tema.ts'
import {
  ACAO_ADIAR,
  adiarAviso,
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
  /** A procedência do último estado que o controlador nativo confirmou. */
  const procedencia = useRef(0)
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
  const mudarAjustes = usarLoja((e) => e.mudarAjustes)

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
      if (resposta.actionIdentifier === ACAO_ADIAR) {
        // Adiar de verdade. O botão existia e não fazia nada.
        void adiarAviso(resposta.notification.request, ajustes.adiarMinutos || 10)
        return
      }

      if (dados.alarme) {
        setAlarmeDe(id)
        void tocarAlarme()
      } else {
        setCompromissoAberto(id)
      }
    })
    return () => inscricao.remove()
  }, [guardar, ajustes.adiarMinutos])

  // Alarme com o app ABERTO na hora do disparo. Quem acorda a pessoa com o app
  // fechado é o AlarmKit; isto é o som da tela do alarme dentro do app.
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
      {/* A barra de abas é a do PRÓPRIO iOS — `UITabBarController`, através do
          `react-native-screens`.
          
          Isto substitui uma barra que eu desenhava à mão com `UIGlassEffect`
          dentro. O material aparecia, e todo o resto era imitação: a bolha não
          refratava o que estava embaixo dela, não virava lente ao arrastar, a
          barra não encolhia ao rolar, e o recuo do conteúdo era chute meu.
          
          Nada disso se reproduz por fora — são comportamentos do controlador da
          Apple, e é por isso que a barra do LootFlow parece de verdade: ela É a
          de verdade. Eu já tinha aprendido isso lá e refiz o erro aqui. */}
      <Tabs.Host
        // Os ajustes de iOS vão DENTRO de `ios`. Soltos no topo são ignorados
        // em silêncio — foi o que fez os ícones sumirem no LootFlow.
        ios={{
          tabBarTintColor: cores.destaque,
          // Encolher ao rolar é comportamento do iOS 26, não animação minha.
          tabBarMinimizeBehavior: 'onScrollDown',
        }}
        // Trocar de aba por código passa por AQUI, e não por `setAba`.
        //
        // Quem guarda o estado agora é o controlador nativo, não o React. O
        // `navStateRequest` é um PEDIDO: ele carrega a procedência do último
        // estado que o nativo confirmou, e é isso que deixa o iOS recusar um
        // pedido velho — o caso real é a pessoa tocar numa aba enquanto um
        // `setAba` nosso ainda está no caminho.
        navStateRequest={{
          // Nunca pedir uma aba que não está na barra.
          //
          // A Grade some quando o recurso está desligado, e o botão "Escanear"
          // dos Ajustes liga o recurso e troca de aba no MESMO render. Pedir uma
          // tela que o controlador ainda não recebeu é convite para o pedido ser
          // recusado — ou pior, aceito contra um índice que não existe.
          selectedScreenKey: abasVisiveis.some((a) => a.id === aba) ? aba : 'hoje',
          baseProvenance: procedencia.current,
        }}
        onTabSelected={({ nativeEvent }: {
          nativeEvent: { selectedScreenKey?: string; provenance?: number }
        }) => {
          procedencia.current = nativeEvent.provenance ?? procedencia.current
          const id = nativeEvent.selectedScreenKey as Aba | undefined
          if (id) setAba(id)
        }}
        style={{ flex: 1 }}
      >
        {abasVisiveis.map((a) => (
          <Tabs.Screen
            key={a.id}
            tabKey={a.id}
            screenKey={a.id}
            title={t(a.chave)}
            ios={{ icon: { type: 'sfSymbol', name: a.icone } }}
          >
            <View style={{ flex: 1, backgroundColor: cores.fundo }}>
              {a.id === 'hoje' ? (
                <Hoje aoAbrirCompromisso={setCompromissoAberto} aoIrParaGrade={() => setAba('grade')} />
              ) : null}
              {a.id === 'agenda' ? <Agenda aoAbrirCompromisso={setCompromissoAberto} /> : null}
              {a.id === 'grade' ? <Grade aoAbrirMateria={setMateriaAberta} /> : null}
              {a.id === 'ajustes' ? (
                <Ajustes
                  aoEscanearHorario={() => {
                    mudarAjustes({ recursos: { ...recursos, grade: true } })
                    setAba('grade')
                  }}
                />
              ) : null}
            </View>
          </Tabs.Screen>
        ))}
      </Tabs.Host>

      {/* O + flutua ACIMA da barra nativa. Ele não pode entrar na `Tabs.Host`:
          lá dentro ele viraria conteúdo de uma aba e sumiria nas outras. */}
      {aba === 'ajustes' ? null : (
        <Pressable
          style={[e.mais, { bottom: margem.bottom + 96 }]}
          onPress={() => setCapturando(true)}
          accessibilityRole="button"
        >
          <Text style={{ color: cores.sobreDestaque, fontSize: 28, fontWeight: '400', marginTop: -3 }}>
            +
          </Text>
        </Pressable>
      )}

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

const e = StyleSheet.create({
  // O + flutua sobre o conteúdo, acima da barra nativa. `bottom` é calculado no
  // uso, a partir da margem segura: a barra do iOS 26 muda de altura sozinha
  // quando encolhe ao rolar, e cravar um número aqui erraria nos dois estados.
  mais: {
    position: 'absolute',
    right: espaco.m,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

