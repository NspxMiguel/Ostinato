// A camada que fala com o iOS.
//
// Ela não decide nada: quem decide quais avisos existem é o `planejador` do
// núcleo, que é puro e testado. Aqui só se aplica a diferença entre o que o
// sistema tem agendado e o que o plano diz que deveria ter.

import * as Notifications from 'expo-notifications'
import { agendarAlarme, cancelarAlarme, temAlarmeDeSistema } from 'alarme-do-sistema'
import { Platform } from 'react-native'
import type { Ajustes, Base, Periodo } from '../../../nucleo/modelo.ts'
import type { AvisoAgendado } from '../../../nucleo/planejador.ts'
import { diferenca, planejar } from '../../../nucleo/planejador.ts'
import { textoDoAviso } from '../../../nucleo/textoAviso.ts'
import type { criarT } from '../../../nucleo/i18n.ts'

export const CATEGORIA = 'ostinato.compromisso'
export const ACAO_FEITO = 'ostinato.feito'
export const ACAO_ADIAR = 'ostinato.adiar'
export const MINUTOS_DE_ADIAMENTO = 10

/** O nome do arquivo de som que vai no bundle do app. */
const SOM_INSISTENTE = 'ostinato-sino.caf'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function pedirPermissao(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync()
  if (atual.granted) return true
  const pedido = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
      // Time Sensitive é o que fura Foco e Não Perturbe, e não precisa de
      // aprovação da Apple. Critical Alerts precisaria, e não é pedido.
      allowProvisional: false,
    },
  })
  return pedido.granted
}

/** As ações que aparecem ao segurar a notificação. */
export async function registrarCategoria(t: ReturnType<typeof criarT>): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORIA, [
    {
      identifier: ACAO_FEITO,
      buttonTitle: t('notificacao.acao.feito'),
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACAO_ADIAR,
      buttonTitle: t('notificacao.acao.adiar'),
      options: { opensAppToForeground: false },
    },
  ])
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ostinato-insistente', {
      name: 'Avisos insistentes',
      importance: Notifications.AndroidImportance.MAX,
      sound: SOM_INSISTENTE,
      vibrationPattern: [0, 400, 200, 400],
    })
  }
}

function nivelDeInterrupcao(modo: AvisoAgendado['modo']): 'active' | 'timeSensitive' {
  return modo === 'normal' ? 'active' : 'timeSensitive'
}

async function agendar(
  aviso: AvisoAgendado,
  base: Base,
  t: ReturnType<typeof criarT>,
): Promise<void> {
  const c = base.compromissos[aviso.compromissoId]
  if (!c) return
  const materia = c.materiaId ? base.materias[c.materiaId] : undefined
  const texto = textoDoAviso(aviso, c, materia, t)

  // Modo alarme vira ALARME DE SISTEMA, não notificação.
  //
  // A diferença é a que ele descreveu: notificação chama e espera você tocar;
  // alarme toca. Com o app fechado, quem tocava o som era o app — e app fechado
  // não toca nada, então passava da hora e só chegava um aviso mudo.
  //
  // O AlarmKit do iOS 26 agenda o alarme do SISTEMA: soa alto, com tela cheia,
  // no silencioso e com Foco ligado, sem o app estar aberto e sem precisar do
  // entitlement de Critical Alerts que ele decidiu não pedir.
  if (aviso.modo === 'alarme' && temAlarmeDeSistema()) {
    // Os DOIS, e não um ou outro. Pedido dele em 30/08/2026: "ele tem q toca
    // alarme e manda msg".
    //
    // Antes o alarme dava `return` e cancelava a notificação, o que parecia
    // limpo e não era: a tela cheia do alarme não diz QUAL tarefa é sem a
    // pessoa entrar no app, e não deixa rastro na Central de Notificações —
    // quem dispensa o alarme meio dormindo fica sem nada para reencontrar
    // depois. A notificação é o registro; o alarme é o que acorda.
    await agendarAlarme(uuidDaChave(aviso.chave), texto.titulo, aviso.quando)
  }

  await Notifications.scheduleNotificationAsync({
    identifier: aviso.chave,
    content: {
      title: texto.titulo,
      body: texto.corpo,
      sound: aviso.modo === 'normal' ? true : SOM_INSISTENTE,
      interruptionLevel: nivelDeInterrupcao(aviso.modo),
      categoryIdentifier: CATEGORIA,
      data: {
        compromissoId: aviso.compromissoId,
        regraId: aviso.regraId,
        modo: aviso.modo,
        chave: aviso.chave,
        // O alarme só faz barulho contínuo com o app na frente; o restante é a
        // insistência. Este campo é o que a tela lê ao abrir pela notificação.
        alarme: aviso.modo === 'alarme',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: aviso.quando,
    },
  })
}

export type ResultadoSincronizacao = {
  agendadas: number
  criadas: number
  canceladas: number
  cortados: number
  semData: string[]
}

/**
 * Alinha o iOS com o plano. Só mexe no que mudou.
 *
 * Cancelar tudo e reagendar seria menos código, e é o que faz o aviso "piscar":
 * entre o cancelamento e o novo agendamento existe uma janela em que nada está
 * armado. Se o app for morto exatamente ali, o aviso some sem ninguém saber.
 */
export async function sincronizarAvisos(
  base: Base,
  ajustes: Ajustes,
  periodo: Periodo | undefined,
  t: ReturnType<typeof criarT>,
  agora = new Date(),
): Promise<ResultadoSincronizacao> {
  const plano = planejar(base, ajustes, agora, periodo)
  const existentes = await Notifications.getAllScheduledNotificationsAsync()

  // Só as nossas: o adiamento cria notificações com outro prefixo, e apagá-las
  // aqui desfaria justamente o que o usuário acabou de pedir.
  const nossas = existentes.map((n) => n.identifier).filter((id) => id.includes('|'))
  const d = diferenca(nossas, plano.agendar)

  for (const chave of d.cancelar) {
    await Notifications.cancelScheduledNotificationAsync(chave)
    // O alarme de sistema vive fora da fila de notificações: cancelar só a
    // notificação deixaria o despertador armado para uma tarefa já feita.
    cancelarAlarmeDoAviso(chave)
  }
  for (const aviso of d.criar) await agendar(aviso, base, t)

  return {
    agendadas: plano.agendar.length,
    criadas: d.criar.length,
    canceladas: d.cancelar.length,
    cortados: plano.cortados,
    semData: plano.semData,
  }
}

/** Cancela as repetições que ainda estão armadas para um compromisso. */
export async function calarCompromisso(compromissoId: string): Promise<number> {
  const existentes = await Notifications.getAllScheduledNotificationsAsync()
  const alvos = existentes.filter((n) => n.identifier.startsWith(`${compromissoId}|`))
  for (const n of alvos) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier)
    cancelarAlarmeDoAviso(n.identifier)
  }
  return alvos.length
}

export async function adiar(
  compromissoId: string,
  titulo: string,
  corpo: string,
  minutos = MINUTOS_DE_ADIAMENTO,
): Promise<void> {
  await calarCompromisso(compromissoId)
  await Notifications.scheduleNotificationAsync({
    identifier: `adiado.${compromissoId}.${Date.now()}`,
    content: {
      title: titulo,
      body: corpo,
      sound: SOM_INSISTENTE,
      interruptionLevel: 'timeSensitive',
      categoryIdentifier: CATEGORIA,
      data: { compromissoId, adiado: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutos * 60,
      repeats: false,
    },
  })
}

export async function quantasAgendadas(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length
}


/**
 * A chave do aviso como UUID.
 *
 * O AlarmKit exige UUID; as chaves do planejador são legíveis
 * (`compromisso:regra:repetição`) e precisam continuar assim, porque é por elas
 * que a diferença incremental funciona. Derivar em vez de sortear mantém a
 * propriedade que importa: a mesma chave dá sempre o mesmo id, então recalcular
 * o plano não duplica alarme.
 */
export function uuidDaChave(chave: string): string {
  let h1 = 0x9e3779b9
  let h2 = 0x85ebca6b
  for (let i = 0; i < chave.length; i++) {
    h1 = Math.imul(h1 ^ chave.charCodeAt(i), 0x01000193) >>> 0
    h2 = Math.imul(h2 + chave.charCodeAt(i), 0x85ebca6b) >>> 0
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0')
  const bruto = (hex(h1) + hex(h2) + hex(h1 ^ h2) + hex((h1 + h2) >>> 0)).slice(0, 32)
  return `${bruto.slice(0, 8)}-${bruto.slice(8, 12)}-4${bruto.slice(13, 16)}-a${bruto.slice(17, 20)}-${bruto.slice(20, 32)}`
}

/** Desarma o despertador junto com o aviso. */
export function cancelarAlarmeDoAviso(chave: string): void {
  void cancelarAlarme(uuidDaChave(chave))
}
