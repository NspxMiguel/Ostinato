// A faixa de horas em que nada toca.
//
// Pedido dele em 30/08/2026: *"coloca pra nao furar modo sono, nao perturbe e
// etc. os focos em geral / nem alarme pode dar quando ta nesses modos"*.
//
// Para NOTIFICAÇÃO isso se resolve sozinho: basta não usar `timeSensitive`, e
// aí é o próprio iOS que segura conforme o Foco que a pessoa configurou. Ver
// `avisos/notificacoes.ts`.
//
// Para o ALARME não existe equivalente, e é honesto dizer por quê: o AlarmKit
// existe justamente para tocar apesar do Foco — é isso que separa alarme de
// aviso, e a Apple não oferece um botão de "respeite o Não Perturbe". Ler o
// Foco na hora também não serve: o alarme dispara com o app fechado, e o
// `INFocusStatusCenter` só responde com o app rodando.
//
// O que resta, e é determinístico, é uma FAIXA DE HORAS declarada no app. Ela
// cobre o caso que ele nomeou primeiro — modo sono — sem depender de o sistema
// contar nada para o app.
//
// Como em `silencioEmAula`, o aviso é EMPURRADO, nunca descartado: some com um
// aviso porque ele calhou numa hora ruim e a pessoa perde a prova.

import type { Hora } from './modelo.ts'

/** Minutos desde a meia-noite. */
function emMinutos(h: Hora): number {
  const [hh, mm] = h.split(':').map(Number)
  return (hh ?? 0) * 60 + (mm ?? 0)
}

/**
 * O instante está dentro da faixa de silêncio?
 *
 * A faixa quase sempre ATRAVESSA a meia-noite (22:00 às 07:00), e é por isso
 * que a comparação não pode ser um simples "entre de e até": às 23:00 o número
 * do minuto é maior que os dois extremos, e às 02:00 é menor que os dois.
 */
export function dentroDoSilencio(quando: Date, de: Hora, ate: Hora): boolean {
  const inicio = emMinutos(de)
  const fim = emMinutos(ate)
  if (inicio === fim) return false // faixa vazia: nada é silenciado
  const agora = quando.getHours() * 60 + quando.getMinutes()
  return inicio < fim ? agora >= inicio && agora < fim : agora >= inicio || agora < fim
}

/**
 * Empurra o aviso para o fim da faixa de silêncio.
 *
 * Para o fim, e não para o começo do dia seguinte: quem dorme quer ser avisado
 * ao acordar, e não vinte e quatro horas depois.
 */
export function foraDoSilencio(quando: Date, de: Hora, ate: Hora): Date {
  if (!dentroDoSilencio(quando, de, ate)) return quando

  const [hh, mm] = ate.split(':').map(Number)
  const alvo = new Date(quando)
  alvo.setHours(hh ?? 7, mm ?? 0, 0, 0)
  // Faixa que atravessa a meia-noite: às 23:00 o fim (07:00) é do dia seguinte.
  if (alvo.getTime() <= quando.getTime()) alvo.setDate(alvo.getDate() + 1)
  return alvo
}
