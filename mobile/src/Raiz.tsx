// A casca: abas, folhas, e o laço que mantém os avisos armados.
//
// Navegação escrita à mão, sem react-navigation: são quatro abas e duas folhas,
// e uma biblioteca de navegação inteira custaria mais do que resolve.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Vidro, temLiquidGlass } from 'vidro'
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

const ABAS: { id: Aba; chave: 'abas.hoje' | 'abas.agenda' | 'abas.grade' | 'abas.ajustes' }[] = [
  { id: 'hoje', chave: 'abas.hoje' },
  { id: 'agenda', chave: 'abas.agenda' },
  { id: 'grade', chave: 'abas.grade' },
  { id: 'ajustes', chave: 'abas.ajustes' },
]

export function Raiz() {
  const t = usarT()
  const margem = useSafeAreaInsets()
  const [aba, setAba] = useState<Aba>('hoje')
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
      <View style={{ flex: 1 }}>
        {aba === 'hoje' ? <Hoje aoAbrirCompromisso={setCompromissoAberto} /> : null}
        {aba === 'agenda' ? <Agenda aoAbrirCompromisso={setCompromissoAberto} /> : null}
        {aba === 'grade' ? <Grade aoAbrirMateria={setMateriaAberta} /> : null}
        {aba === 'ajustes' ? <Ajustes /> : null}
      </View>

      <BarraDeAbas
        aba={aba}
        aoTrocar={setAba}
        aoCriar={() => setCapturando(true)}
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

function BarraDeAbas({
  aba,
  aoTrocar,
  aoCriar,
  rotulo,
  alturaSegura,
}: {
  aba: Aba
  aoTrocar: (a: Aba) => void
  aoCriar: () => void
  rotulo: (chave: 'abas.hoje' | 'abas.agenda' | 'abas.grade' | 'abas.ajustes') => string
  alturaSegura: number
}) {
  // No iOS 26 a barra é vidro de verdade; nos outros o `Vidro` vira View e a cor
  // de fundo abaixo é que aparece.
  const vidro = temLiquidGlass()
  return (
    <Vidro
      raio={raio.g}
      variante="regular"
      interativo
      style={[
        e.barra,
        { paddingBottom: alturaSegura + espaco.s },
        vidro ? null : { backgroundColor: cores.cartao },
      ]}
    >
      {ABAS.map((item) => (
        <Pressable key={item.id} style={e.aba} onPress={() => aoTrocar(item.id)}>
          <Text
            style={[
              fonte.apoio,
              { fontWeight: '600' },
              aba === item.id ? { color: cores.texto } : null,
            ]}
          >
            {rotulo(item.chave)}
          </Text>
        </Pressable>
      ))}
      <Pressable style={e.mais} onPress={aoCriar}>
        <Text style={{ color: cores.fundo, fontSize: 22, fontWeight: '700', marginTop: -2 }}>+</Text>
      </Pressable>
    </Vidro>
  )
}

const e = StyleSheet.create({
  barra: {
    position: 'absolute',
    left: espaco.m,
    right: espaco.m,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    paddingTop: espaco.m,
    paddingHorizontal: espaco.m,
    borderTopLeftRadius: raio.g,
    borderTopRightRadius: raio.g,
    overflow: 'hidden',
  },
  aba: { flex: 1, alignItems: 'center', paddingVertical: espaco.s },
  mais: {
    width: 40,
    height: 40,
    borderRadius: raio.pilula,
    backgroundColor: cores.marfim,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
