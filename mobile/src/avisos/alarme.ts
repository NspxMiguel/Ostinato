// O som do alarme com o app ABERTO. O de verdade não é este.
//
// Quem acorda a pessoa é o `AlarmKit` (ver `modules/alarme`): alarme de sistema,
// alto, em tela cheia, com o app fechado. Este arquivo cobre um caso menor — a
// pessoa tocou na notificação e chegou na tela do alarme dentro do app, e aí
// precisa de som até dispensar.
//
// Ele ignora o botão de silencioso (`playsInSilentMode`), e isso NÃO contradiz
// o pedido de não furar Foco e Modo Sono. O que aquele pedido proíbe é o app
// interromper alguém sem ser chamado; aqui a pessoa acabou de abrir a tela.
// Interromper é diferente de responder.
//
// O comentário anterior descrevia o mundo antes do iOS 26 — dizia que nenhum
// app toca com o telefone fechado sem Critical Alerts. Era verdade, e o
// AlarmKit deixou de ser.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

const SINO = require('../../assets/ostinato-sino.caf')

let tocador: AudioPlayer | null = null

export async function prepararAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    // Não continua em segundo plano: um alarme que toca sozinho depois de o
    // usuário sair do app seria um app que o iOS mata — e com razão.
    shouldPlayInBackground: false,
    interruptionMode: 'doNotMix',
  })
}

export async function tocarAlarme(): Promise<void> {
  await prepararAudio()
  if (!tocador) {
    tocador = createAudioPlayer(SINO)
    tocador.loop = true
  }
  tocador.volume = 1
  tocador.seekTo(0)
  tocador.play()
}

export function pararAlarme(): void {
  if (!tocador) return
  tocador.pause()
  tocador.seekTo(0)
}

export function alarmeTocando(): boolean {
  return tocador?.playing ?? false
}

export function soltarAlarme(): void {
  tocador?.remove()
  tocador = null
}
