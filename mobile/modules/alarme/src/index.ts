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

/** `id` precisa ser UUID — é a chave que o sistema usa para cancelar depois. */
export async function agendarAlarme(id: string, titulo: string, quando: Date): Promise<boolean> {
  if (!modulo) return false
  try {
    return (await modulo.agendar(id, titulo, quando.getTime() / 1000)) as boolean
  } catch {
    return false
  }
}

/** Marcar a tarefa como feita tem que desarmar o despertador. */
export function cancelarAlarme(id: string): boolean {
  if (!modulo) return false
  try {
    return modulo.cancelar(id) as boolean
  } catch {
    return false
  }
}

export function alarmesAgendados(): string[] {
  if (!modulo) return []
  try {
    return (modulo.agendados() as string[]) ?? []
  } catch {
    return []
  }
}
