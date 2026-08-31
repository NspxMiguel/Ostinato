// Quais avisos o iOS vai realmente guardar — e quais não cabem.
//
// O detalhe que quebra esse tipo de app em silêncio: o iOS guarda no máximo 64
// notificações locais pendentes por app. Passou disso, ele descarta as mais
// distantes SEM erro nenhum. Um app com 5 avisos por tarefa estoura com 13
// tarefas e passa a falhar calado, que é o pior jeito de falhar.
//
// A saída é não deixar o iOS escolher: o planejador ordena todos os avisos por
// data, corta nos 60 mais próximos (4 de reserva), e reabastece a janela sempre
// que o app abre ou algo muda. O que ficou de fora é contado e mostrado na tela.

import type { Ajustes, Base, Compromisso, Hora, ModoAviso, Periodo, RegraAviso } from './modelo.ts'
import { avisosDe } from './modelo.ts'
import { resolverVencimento } from './vencimento.ts'
import { respeitarAula } from './silencioEmAula.ts'
import { foraDoSilencio } from './silencioNoturno.ts'
import { primeiraAulaDoDia } from './grade.ts'
import { vivos } from './sync/registro.ts'
import { instante, somarDias } from './tempo.ts'

/** O teto do iOS. Não é configurável: é o sistema. */
export const LIMITE_IOS = 64
/** Reserva para o que o app agenda fora do planejador (adiar, por exemplo). */
export const RESERVA = 4
export const JANELA = LIMITE_IOS - RESERVA

/**
 * Um único compromisso não pode comer a janela inteira. Sem este teto, uma prova
 * com "repetir a cada 2 minutos" apagaria os avisos de todas as outras matérias.
 */
export const MAX_POR_COMPROMISSO = 8

export type AvisoAgendado = {
  /** Determinística: o mesmo aviso sempre gera a mesma chave, em qualquer ordem. */
  chave: string
  compromissoId: string
  regraId: string
  /** 0 é o primeiro disparo; 1+ são as repetições da insistência. */
  repeticao: number
  quando: Date
  modo: ModoAviso
  vencimentoEm: Date
}

export type Plano = {
  agendar: AvisoAgendado[]
  /** Quantos avisos válidos não couberam na janela. A tela de Ajustes mostra. */
  cortados: number
  /** Compromissos cujo vencimento não resolveu (matéria sem aula, período acabou). */
  semData: string[]
  /** Compromissos que perderam avisos pelo teto por compromisso. */
  limitados: string[]
}

function chaveDe(compromissoId: string, regraId: string, repeticao: number): string {
  return `${compromissoId}|${regraId}|${repeticao}`
}

/**
 * Quando a regra dispara pela primeira vez.
 *
 * Devolve `null` quando a regra não tem onde acontecer — hoje só o alarme de
 * última chance num dia sem aula. Aviso que não pode existir é melhor sumir do
 * plano do que virar uma data inventada.
 */
function primeiroDisparo(
  regra: RegraAviso,
  venceEm: Date,
  dataVencimento: string,
  base: Base,
  periodo: Periodo | undefined,
  inverterSemana: boolean,
): Date | null {
  if (regra.quando.tipo === 'diasAntes') {
    return instante(somarDias(dataVencimento, -regra.quando.dias), regra.quando.aHora)
  }
  if (regra.quando.tipo === 'antesDe') {
    return new Date(venceEm.getTime() - regra.quando.minutos * 60_000)
  }
  // antesDaPrimeiraAula: a âncora é o começo do dia de aula, não o vencimento.
  if (!periodo) return null
  const primeira = primeiraAulaDoDia(base, periodo, dataVencimento, inverterSemana)
  if (!primeira) return null
  return new Date(primeira.quando.getTime() - regra.quando.horas * 3_600_000)
}

/** Os disparos de uma regra: o primeiro, mais as repetições que ainda cabem antes do prazo. */
function disparosDaRegra(
  c: Compromisso,
  regra: RegraAviso,
  venceEm: Date,
  dataVencimento: string,
  agora: number,
  base: Base,
  periodo: Periodo | undefined,
  inverterSemana: boolean,
  silencio: { de: Hora; ate: Hora },
): AvisoAgendado[] {
  const inicio = primeiroDisparo(regra, venceEm, dataVencimento, base, periodo, inverterSemana)
  if (!inicio) return []
  const cada = Math.max(0, regra.repetirCada ?? 0)
  const vezes = cada > 0 ? Math.max(0, Math.floor(regra.repeticoes ?? 0)) : 0

  const saida: AvisoAgendado[] = []
  for (let i = 0; i <= vezes; i++) {
    const bruto = inicio.getTime() + i * cada * 60_000

    // Nenhum aviso toca DENTRO de uma aula — de qualquer matéria, não só da
    // matéria do compromisso. Um alarme de matemática às 7h cai no meio da
    // aula de geografia, e de dentro da sala é a mesma coisa.
    //
    // O aviso é EMPURRADO para o primeiro instante livre depois do bloco, nunca
    // descartado: sumir com um aviso porque ele calhou numa hora ruim é a pior
    // falha que este app pode ter.
    // Duas faixas proibidas, na ordem: a aula e a noite. A noite vem por
    // último de propósito — empurrar para fora da aula pode jogar o aviso para
    // as 22h30, e aí ele ainda precisa sair da faixa de silêncio.
    //
    // A EXCEÇÃO é a regra ancorada na primeira aula, e ela não é um jeitinho.
    //
    // Essa regra existe para ACORDAR: "duas horas antes da primeira aula" cai
    // às 5h30 de quem tem aula às 7h30 — dentro de qualquer faixa de sono que
    // se escolha. Empurrar ela para o fim do silêncio não protegeria o sono da
    // pessoa; apagaria o despertador que ela mesma configurou, e ela perderia a
    // entrega achando que o app tocou. Silenciar um aviso é diferente de
    // silenciar um alarme que a pessoa pediu para tocar naquela hora.
    const semAula = respeitarAula(new Date(bruto), base, periodo, inverterSemana)
    const paraAcordar = regra.quando.tipo === 'antesDaPrimeiraAula'
    const t = paraAcordar
      ? semAula.getTime()
      : foraDoSilencio(semAula, silencio.de, silencio.ate).getTime()

    // Aviso no passado não se agenda, e repetição depois do prazo não serve para nada.
    if (t <= agora) continue
    if (i > 0 && t > venceEm.getTime()) break
    saida.push({
      chave: chaveDe(c.id, regra.id, i),
      compromissoId: c.id,
      regraId: regra.id,
      repeticao: i,
      quando: new Date(t),
      modo: regra.modo,
      vencimentoEm: venceEm,
    })
  }
  return saida
}

export function planejar(
  base: Base,
  ajustes: Ajustes,
  agora: Date,
  periodo: Periodo | undefined,
  opcoes: { janela?: number; maxPorCompromisso?: number } = {},
): Plano {
  const janela = opcoes.janela ?? JANELA
  const maxPorCompromisso = opcoes.maxPorCompromisso ?? MAX_POR_COMPROMISSO
  const agoraMs = agora.getTime()

  const candidatos: AvisoAgendado[] = []
  const semData: string[] = []
  const limitados: string[] = []

  for (const c of vivos(base.compromissos)) {
    if (c.concluido) continue

    const r = resolverVencimento(c, base, periodo, ajustes.inverterSemanaAlternada)
    if (!r.ok) {
      semData.push(c.id)
      continue
    }
    // Prazo que já passou não gera aviso novo — o atraso aparece na tela, não no sino.
    if (r.valor.quando.getTime() <= agoraMs) continue

    const doCompromisso: AvisoAgendado[] = []
    for (const regra of avisosDe(c, ajustes)) {
      doCompromisso.push(
        ...disparosDaRegra(
          c,
          regra,
          r.valor.quando,
          r.valor.data,
          agoraMs,
          base,
          periodo,
          ajustes.inverterSemanaAlternada,
          { de: ajustes.silencioDe, ate: ajustes.silencioAte },
        ),
      )
    }
    doCompromisso.sort(ordenar)
    if (doCompromisso.length > maxPorCompromisso) limitados.push(c.id)
    candidatos.push(...doCompromisso.slice(0, maxPorCompromisso))
  }

  candidatos.sort(ordenar)
  return {
    agendar: candidatos.slice(0, janela),
    cortados: Math.max(0, candidatos.length - janela),
    semData,
    limitados,
  }
}

/** Ordem estável: por instante, e a chave desempata para o plano ser determinístico. */
function ordenar(a: AvisoAgendado, b: AvisoAgendado): number {
  const d = a.quando.getTime() - b.quando.getTime()
  return d !== 0 ? d : a.chave.localeCompare(b.chave)
}

export type Diferenca = { criar: AvisoAgendado[]; cancelar: string[] }

/**
 * O que mudar no iOS, e só isso.
 *
 * Recriar as 60 notificações a cada abertura seria mais simples e é o que a maioria
 * dos apps faz — e é por isso que eles piscam: entre cancelar e reagendar existe uma
 * janela em que o aviso não está armado. Se o app morre nessa janela, o aviso some.
 */
export function diferenca(jaAgendadas: string[], plano: AvisoAgendado[]): Diferenca {
  const atual = new Set(jaAgendadas)
  const desejado = new Set(plano.map((a) => a.chave))
  return {
    criar: plano.filter((a) => !atual.has(a.chave)),
    cancelar: jaAgendadas.filter((k) => !desejado.has(k)),
  }
}
