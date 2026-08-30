// Quem vence quando dois aparelhos escreveram no mesmo registro.
//
// Esta é a parte que causaria a reescrita se ficasse para depois — e é TypeScript
// puro, sem CloudKit e sem conta paga. Por isso ela é escrita e provada agora: o
// transporte (CloudKit hoje, Firestore no Android amanhã) vira detalhe.

import type { Base } from '../modelo.ts'
import type { Registro, Tabela } from './registro.ts'
import type { Mudanca } from './porta.ts'

export type Vencedor = 'local' | 'remoto' | 'igual'

/**
 * Último a escrever vence, com dois desempates que existem por motivo:
 *
 * 1. **Empate no relógio, um lado apagou:** vence quem apagou. Relógio de dois
 *    aparelhos bate no mesmo milissegundo por acaso, e ressuscitar um registro que
 *    a pessoa apagou é um erro que ela percebe; perder uma edição da mesma fração
 *    de segundo, não.
 * 2. **Empate total:** desempate pelo id do aparelho, em ordem alfabética. É
 *    arbitrário de propósito — o que importa é que os DOIS aparelhos cheguem à
 *    mesma conclusão sem conversar, senão eles ficam trocando versões para sempre.
 */
export function mesclarRegistro<T extends Registro>(local: T | undefined, remoto: T): {
  valor: T
  venceu: Vencedor
} {
  if (!local) return { valor: remoto, venceu: 'remoto' }
  if (local.atualizadoEm > remoto.atualizadoEm) return { valor: local, venceu: 'local' }
  if (local.atualizadoEm < remoto.atualizadoEm) return { valor: remoto, venceu: 'remoto' }

  if (local.removido !== remoto.removido) {
    return local.removido ? { valor: local, venceu: 'local' } : { valor: remoto, venceu: 'remoto' }
  }

  const c = local.origem.localeCompare(remoto.origem)
  if (c === 0) return { valor: local, venceu: 'igual' }
  return c < 0 ? { valor: local, venceu: 'local' } : { valor: remoto, venceu: 'remoto' }
}

export type ResultadoMesclagem = {
  base: Base
  /** Mudanças remotas que entraram. */
  aplicadas: number
  /** Mudanças remotas descartadas porque o local era mais novo. */
  descartadas: number
  /** Registros locais que venceram e portanto precisam ser reenviados. */
  reenviar: Mudanca[]
}

/** Aplica um lote remoto sobre a base, registro a registro. */
export function mesclarBase(base: Base, mudancas: Mudanca[]): ResultadoMesclagem {
  const nova: Base = {
    periodos: { ...base.periodos },
    materias: { ...base.materias },
    aulas: { ...base.aulas },
    compromissos: { ...base.compromissos },
    notas: { ...base.notas },
    faltas: { ...base.faltas },
  }

  let aplicadas = 0
  let descartadas = 0
  const reenviar: Mudanca[] = []

  for (const m of mudancas) {
    const tabela = nova[m.tabela] as Record<string, Registro>
    if (!tabela) continue
    const local = tabela[m.registro.id]
    const r = mesclarRegistro(local, m.registro)
    if (r.venceu === 'remoto') {
      tabela[m.registro.id] = r.valor
      aplicadas++
    } else {
      descartadas++
      // O outro aparelho está com versão velha deste registro. Reenviar é o que
      // faz duas bases convergirem sem uma terceira rodada.
      if (r.venceu === 'local' && local) {
        reenviar.push({ tabela: m.tabela, registro: local as Registro & Record<string, unknown> })
      }
    }
  }

  return { base: nova, aplicadas, descartadas, reenviar }
}

/** Extrai uma mudança da base, para mandar embora. */
export function mudancaDe(base: Base, tabela: Tabela, id: string): Mudanca | undefined {
  const registro = (base[tabela] as Record<string, Registro> | undefined)?.[id]
  if (!registro) return undefined
  return { tabela, registro: registro as Registro & Record<string, unknown> }
}
