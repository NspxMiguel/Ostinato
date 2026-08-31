// O que é assunto de HOJE.
//
// Esta regra já esteve errada três vezes, e por isso ela saiu da tela e veio
// para cá: aqui ela tem teste, e a tela só desenha o que esta função decidir.
//
// A frase que define tudo é dele, em 30/08/2026: *"tipo, é para amanha, mas
// tenho q fazer hoje a tarefa / era para aparecer em hoje"*.
//
// É a premissa do app inteiro. Tarefa "para amanhã" é tarefa que se faz HOJE à
// noite — ninguém acorda no dia da entrega para fazer a lição da primeira aula.
// O mesmo vale para prova: prova amanhã é estudo hoje. Filtrar por data de
// vencimento escondia exatamente o que a pessoa tem para fazer agora.
//
// O que NÃO entra: o que vence de depois de amanhã em diante. Aí sim é a Agenda,
// que mostra tudo — e sem esse corte o Hoje vira uma segunda Agenda.

import type { DataISO } from './modelo.ts'
import { dataDe, somarDias } from './tempo.ts'

export type Candidato = {
  /** Quando vence. `null` quando o app não conseguiu resolver a data. */
  quando: Date | null
  /** O próximo aviso ainda por disparar, se houver. */
  proximoAviso?: Date | null
}

/**
 * Este compromisso é assunto de hoje?
 *
 * Quatro portas, e qualquer uma basta:
 *
 *  1. **atrasado** — passou da hora, é a coisa mais de hoje que existe;
 *  2. **vence hoje** — óbvio, e era a única regra na primeira versão;
 *  3. **vence amanhã** — é o pedido dele, e a razão de o app existir;
 *  4. **avisa hoje** — se o app vai cobrar hoje, é assunto de hoje. Cobre o caso
 *     de uma prova de sexta com alarme marcado para esta noite.
 */
export function ehAssuntoDeHoje(c: Candidato, agora: Date): boolean {
  if (!c.quando) return false
  if (c.quando.getTime() < agora.getTime()) return true

  const hoje: DataISO = dataDe(agora)
  const dia = dataDe(c.quando)
  if (dia === hoje || dia === somarDias(hoje, 1)) return true

  return !!c.proximoAviso && dataDe(c.proximoAviso) === hoje
}
