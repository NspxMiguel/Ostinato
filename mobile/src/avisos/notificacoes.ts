// A camada que fala com o iOS.
//
// Ela não decide nada: quem decide quais avisos existem é o `planejador` do
// núcleo, que é puro e testado. Aqui só se aplica a diferença entre o que o
// sistema tem agendado e o que o plano diz que deveria ter.

import * as Notifications from 'expo-notifications'
import {
  agendarAlarme,
  alarmesAgendados,
  cancelarAlarme,
  temAlarmeDeSistema,
} from 'alarme-do-sistema'
import { SONS_DO_APP, somDoApp } from './sons.ts'
import { sonsImportados } from 'som-do-alarme'
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
/**
 * O sino que vem no pacote do app.
 *
 * Exportado porque os Ajustes o oferecem como escolha de som do alarme: ele já
 * estava aqui, tocando nos avisos insistentes, e não aparecia em lugar nenhum
 * para ser escolhido.
 */
export const SOM_DO_APP = SONS_DO_APP[0]!.arquivo
const SOM_INSISTENTE = SOM_DO_APP

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
      // Nem Time Sensitive nem Critical Alerts: quem decide se o aviso passa
      // pelo Foco é o telefone da pessoa, não este app. Ver `nivelDeInterrupcao`.
      allowProvisional: false,
    },
  })
  return pedido.granted
}

/**
 * As ações que aparecem ao segurar a notificação.
 *
 * `adiarMinutos` entra no RÓTULO porque ele é configurável: "Adiar 10 min" num
 * botão que adia 5 é o app mentindo sobre o que o próprio botão faz.
 */
export async function registrarCategoria(
  t: ReturnType<typeof criarT>,
  adiarMinutos = 10,
): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORIA, [
    {
      identifier: ACAO_FEITO,
      buttonTitle: t('notificacao.acao.feito'),
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACAO_ADIAR,
      buttonTitle: t('notificacao.acao.adiar', { n: adiarMinutos }),
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

/**
 * O nível de interrupção — hoje sempre `active`, e isso é uma decisão dele.
 *
 * Pedido em 30/08/2026: *"coloca pra nao furar modo sono, nao perturbe e etc.
 * os focos em geral / nem alarme pode dar quando ta nesses modos"*.
 *
 * `timeSensitive` é exatamente o crachá que FURA Foco, Não Perturbe e Modo
 * Sono — era o que os modos insistente e alarme usavam. Tirando ele, quem
 * silencia passa a ser o iOS, com a regra que a pessoa configurou no próprio
 * telefone: o aviso espera e chega no resumo.
 *
 * E é o mecanismo certo, não um remendo: um app não consegue LER o Foco na hora
 * do disparo — a notificação é entregue pelo sistema com o app fechado, e o
 * `INFocusStatusCenter` só responde com o app rodando. Deixar o nível correto e
 * o iOS decidir é a única forma que funciona sempre.
 */
function nivelDeInterrupcao(_modo: AvisoAgendado['modo']): 'active' {
  return 'active'
}

async function agendar(
  aviso: AvisoAgendado,
  base: Base,
  ajustes: Ajustes,
  t: ReturnType<typeof criarT>,
): Promise<void> {
  const c = base.compromissos[aviso.compromissoId]
  if (!c) return
  const materia = c.materiaId ? base.materias[c.materiaId] : undefined
  const texto = textoDoAviso(aviso, c, materia, t)

  // O som escolhido vale para o alarme E para a notificação: ele pediu para
  // trocar "o som do alarme", e o modo insistente também faz barulho — dois
  // sons diferentes para a mesma tarefa é o app falando com duas vozes.
  //
  // E só vai se o arquivo AINDA existir. Nome apagado não dá erro: o iOS cai no
  // som padrão calado, e quem apagou acharia que a escolha foi ignorada.
  // Os sons do app valem sempre: moram na BUNDLE, não em `Library/Sounds`, e
  // por isso não aparecem em `sonsImportados`. Sem esta checagem, escolher um
  // deles caía no som padrão em silêncio — o mesmo defeito que a linha abaixo
  // existe para evitar.
  const som = somDoApp(ajustes.somAlarme)
    ? ajustes.somAlarme
    : ajustes.somAlarme && sonsImportados().includes(ajustes.somAlarme)
      ? ajustes.somAlarme
      : null

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
    await agendarAlarme(uuidDaChave(aviso.chave), texto.titulo, aviso.quando, {
      som,
      adiarMinutos: ajustes.adiarMinutos,
      rotuloAdiar: t('notificacao.acao.adiar', { n: ajustes.adiarMinutos }),
    })
  }

  await Notifications.scheduleNotificationAsync({
    identifier: aviso.chave,
    content: {
      title: texto.titulo,
      body: texto.corpo,
      sound: som ?? (aviso.modo === 'normal' ? true : SOM_INSISTENTE),
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
 * A fila que impede duas sincronizações de rodarem ao mesmo tempo.
 *
 * `rearmar` dispara a cada mudança de ajustes — e trocar o som do alarme,
 * ajustar a janela de silêncio e mudar o minuto de adiar em sequência rápida
 * chama `sincronizarAvisos` várias vezes antes da primeira terminar. Cada
 * chamada lê o AlarmKit, decide o que sobra e o que falta, e escreve de volta:
 * sem fila, a mais nova podia ler o AlarmKit ANTES de a mais velha (ainda em
 * voo) escrever o alarme que acabou de agendar — e aí a varredura de órfãos da
 * mais nova cancelava um alarme que, do ponto de vista dela, nunca existiu.
 *
 * Medido em 03/09/2026: uma prova com alarme às 22:59, três ajustes trocados em
 * sequência, terminou em "No events due to fire" — o alarme nunca tocou.
 *
 * A fila resolve encadeando: cada chamada espera a anterior acabar antes de
 * começar a sua própria leitura. Perde-se paralelismo que ninguém precisa;
 * ganha-se a garantia de que nenhuma sincronização lê um estado que outra,
 * mais nova, já decidiu mudar.
 */
let filaDeSincronizacao: Promise<unknown> = Promise.resolve()

/**
 * Alinha o iOS com o plano. Só mexe no que mudou.
 *
 * Cancelar tudo e reagendar seria menos código, e é o que faz o aviso "piscar":
 * entre o cancelamento e o novo agendamento existe uma janela em que nada está
 * armado. Se o app for morto exatamente ali, o aviso some sem ninguém saber.
 */
export function sincronizarAvisos(
  base: Base,
  ajustes: Ajustes,
  periodo: Periodo | undefined,
  t: ReturnType<typeof criarT>,
  agora = new Date(),
): Promise<ResultadoSincronizacao> {
  // Encadeia na fila em vez de rodar direto: a próxima chamada espera esta
  // terminar (com sucesso ou erro — `.catch` aqui existe só para a fila não
  // travar para sempre se uma rodada falhar) antes de começar a sua.
  const minhaVez = filaDeSincronizacao
    .catch(() => undefined)
    .then(() => sincronizarAvisosAgora(base, ajustes, periodo, t, agora))
  filaDeSincronizacao = minhaVez
  return minhaVez
}

async function sincronizarAvisosAgora(
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
  for (const aviso of d.criar) await agendar(aviso, base, ajustes, t)

  // Varre os alarmes ÓRFÃOS.
  //
  // A conta acima compara o plano com a fila de NOTIFICAÇÕES, e o alarme de
  // sistema não vive nela: ele é do iOS, sobrevive a reinstalação do app e não
  // aparece em `getAllScheduledNotificationsAsync`. Basta uma notificação já
  // entregue, ou o app reinstalado, para sobrar um despertador armado para uma
  // tarefa que não existe mais — e um alarme tocando de madrugada por causa de
  // uma tarefa apagada é o tipo de defeito que faz a pessoa desinstalar.
  //
  // Então a fonte da verdade aqui é o próprio AlarmKit: o que ele tem e o plano
  // não pede, cai.
  if (temAlarmeDeSistema()) {
    const desejados = new Set(
      plano.agendar.filter((a) => a.modo === 'alarme').map((a) => uuidDaChave(a.chave)),
    )
    for (const id of await alarmesAgendados()) {
      if (!desejados.has(id)) void cancelarAlarme(id)
    }
  }

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
      interruptionLevel: 'active',
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

/**
 * Adia um aviso: repete a mesma mensagem daqui a `minutos`.
 *
 * O botão "Adiar" existia na notificação e NÃO FAZIA NADA — o tratador só
 * devolvia. Botão que aparece e não age é pior que botão ausente: a pessoa
 * confia que adiou, larga o telefone e não é avisada de novo.
 *
 * O identificador novo NÃO leva `|`, e isso é de propósito: a sincronização
 * cancela tudo o que tem `|` e não está no plano, e o adiado não está no plano
 * — ele é uma decisão que a pessoa acabou de tomar. Sem o prefixo próprio, o
 * próximo rearme apagaria o adiamento no mesmo segundo.
 */
export async function adiarAviso(
  notificacao: Notifications.NotificationRequest,
  minutos: number,
): Promise<void> {
  const c = notificacao.content
  await Notifications.scheduleNotificationAsync({
    identifier: `adiado.${notificacao.identifier.replace(/\|/g, '.')}.${Date.now()}`,
    content: {
      title: c.title ?? '',
      body: c.body ?? '',
      sound: c.sound ?? true,
      interruptionLevel: 'active',
      categoryIdentifier: CATEGORIA,
      data: c.data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, minutos * 60),
      repeats: false,
    },
  })
}

/** Desarma o despertador junto com o aviso. */
export function cancelarAlarmeDoAviso(chave: string): void {
  void cancelarAlarme(uuidDaChave(chave))
}
