// O alarme de sistema (AlarmKit, iOS 26+).
//
// A diferença que motivou isto: notificação CHAMA e espera você tocar; alarme
// TOCA. Ele marcou tarefa para as 7h13, passou da hora, e só chegou notificação
// — o som vinha depois de tocar nela, porque quem tocava era o app, e app
// fechado não toca nada.
import { moduloOpcional } from '../../../src/modulosNativos.ts'

const modulo = moduloOpcional<any>('AlarmeDoSistema')

/** iOS 26+ com AlarmKit. Abaixo disso o app cai no aviso insistente. */
export function temAlarmeDeSistema(): boolean {
  try {
    return modulo?.disponivel?.() ?? false
  } catch {
    return false
  }
}

/** Permissão própria: quem autorizou aviso não autorizou acordar. */
export async function pedirPermissaoDeAlarme(): Promise<boolean> {
  if (!modulo) return false
  try {
    return (await modulo.permissao()) as boolean
  } catch {
    return false
  }
}

/**
 * `id` precisa ser UUID — é a chave que o sistema usa para cancelar depois.
 *
 * `som` é o nome de um arquivo em `Library/Sounds`, ou `null` para o padrão do
 * sistema. `adiarMinutos` em 0 tira o botão de adiar: botão que aparece e não
 * adia nada é pior do que não ter botão.
 */
export async function agendarAlarme(
  id: string,
  titulo: string,
  quando: Date,
  opcoes: { som?: string | null; adiarMinutos?: number; rotuloAdiar?: string } = {},
): Promise<boolean> {
  if (!modulo) return false
  try {
    return (await modulo.agendar(
      id,
      titulo,
      quando.getTime() / 1000,
      opcoes.som ?? null,
      opcoes.adiarMinutos ?? 0,
      opcoes.rotuloAdiar ?? 'Snooze',
    )) as boolean
  } catch {
    return false
  }
}

/** Marcar a tarefa como feita tem que desarmar o despertador. */
export async function cancelarAlarme(id: string): Promise<boolean> {
  if (!modulo) return false
  try {
    return (await modulo.cancelar(id)) as boolean
  } catch {
    return false
  }
}

export type EstadoDoAlarme = 'autorizado' | 'negado' | 'nao-perguntado' | 'sem-suporte'

/**
 * O estado da permissão de alarme.
 *
 * A tela precisa disto para dizer "negado nos Ajustes do iPhone" em vez de
 * simplesmente não tocar — que foi o defeito: o alarme falhava calado e só
 * chegava a notificação, sem nada indicando que faltava uma permissão.
 */
export async function estadoDoAlarme(): Promise<EstadoDoAlarme> {
  if (!modulo) return 'sem-suporte'
  try {
    return ((await modulo.estadoDaPermissao()) as EstadoDoAlarme) ?? 'sem-suporte'
  } catch {
    return 'sem-suporte'
  }
}

export async function alarmesAgendados(): Promise<string[]> {
  if (!modulo) return []
  try {
    return ((await modulo.agendados()) as string[]) ?? []
  } catch {
    return []
  }
}
