// O alarme de verdade — e o limite dele, dito sem enfeite.
//
// Com o app RODANDO, isto toca o sino em laço e ignora o botão de silencioso:
// `playsInSilentMode: true` é o que o iOS permite a qualquer app, sem pedir nada
// a ninguém.
//
// Com o app FECHADO, nenhum app de iOS toca som por cima do silencioso sem o
// entitlement de Critical Alerts, que a Apple concede caso a caso e que não foi
// pedido. Nesse cenário sobra a insistência: notificação Time Sensitive, que
// fura Foco e Não Perturbe, com vibração e repetição até você responder. Isso
// está escrito na tela de configuração do alarme, e não só aqui.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

const SINO = require('../../assets/giz-sino.caf')

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
