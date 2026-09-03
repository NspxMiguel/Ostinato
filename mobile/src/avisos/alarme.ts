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

import { SONS_DO_APP, somDoApp } from './sons.ts'

const SINO = SONS_DO_APP[0]!.fonte

let tocador: AudioPlayer | null = null
/** Qual arquivo o tocador atual carregou — trocar de som exige recriá-lo. */
let carregado: string | null = null

export async function prepararAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    // Não continua em segundo plano: um alarme que toca sozinho depois de o
    // usuário sair do app seria um app que o iOS mata — e com razão.
    shouldPlayInBackground: false,
    interruptionMode: 'doNotMix',
  })
}

export async function tocarAlarme(escolhido?: string | null): Promise<void> {
  await prepararAudio()
  const som = somDoApp(escolhido)
  const fonte = som?.fonte ?? SINO
  const arquivo = som?.arquivo ?? SONS_DO_APP[0]!.arquivo
  // Um `AudioPlayer` carrega o arquivo na criação. Reusar o de ontem depois de
  // a pessoa trocar de som toca o som antigo — e ela só descobre de madrugada.
  if (!tocador || carregado !== arquivo) {
    soltarAlarme()
    tocador = createAudioPlayer(fonte)
    tocador.loop = true
    carregado = arquivo
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
  carregado = null
}

/**
 * Toca um som da bundle UMA vez, para ouvir antes de escolher.
 *
 * `tocarAlarme` toca em LAÇO, porque ele é o alarme: parar é decisão de quem
 * acorda. Aqui é prévia, e prévia que não acaba é defeito — ele reclamou em
 * 31/08/2026: *"ao clicar em som padrao do app, ele n para de tocar ate fechar
 * o app"*.
 *
 * O motivo de a limpeza de tela não ter resolvido: com a barra de abas nativa
 * as quatro abas ficam MONTADAS o tempo todo, então sair dos Ajustes não
 * desmonta nada e o `return` do efeito nunca roda. O conserto certo não é
 * caçar o momento de parar — é não começar um som infinito.
 */
export async function ouvirSomDoAppUmaVez(arquivo: string): Promise<void> {
  await prepararAudio()
  pararAlarme()
  soltarAlarme()
  tocador = createAudioPlayer(somDoApp(arquivo)?.fonte ?? SINO)
  carregado = arquivo
  tocador.loop = false
  tocador.volume = 1
  tocador.play()
}
