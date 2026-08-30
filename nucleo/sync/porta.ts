// A porta de nuvem: a única coisa que o resto do app conhece sobre sincronização.
//
// Existe para que trocar CloudKit por Firestore (quando o Android entrar) seja
// escrever uma classe nova, e nada mais. Nenhuma tela, nenhum store e nenhuma
// regra de mesclagem sabe qual porta está do outro lado.

import type { Registro, Tabela } from './registro.ts'

/** Um registro qualquer atravessando a fronteira. */
export type Mudanca = {
  tabela: Tabela
  registro: Registro & Record<string, unknown>
}

export type Lote = {
  mudancas: Mudanca[]
  /** Cursor do servidor. Guardado no aparelho para o próximo `puxar`. */
  marca: string
  /** Ainda há mais lote depois deste. */
  temMais: boolean
}

export type ResultadoEnvio = {
  marca: string
  /** O que o servidor recusou — normalmente porque já tinha versão mais nova. */
  rejeitadas: Mudanca[]
}

export interface PortaDeNuvem {
  readonly nome: string
  /** Falso quando falta conta, entitlement ou rede. O app tem que continuar inteiro. */
  disponivel(): Promise<boolean>
  puxar(desde: string | null): Promise<Lote>
  empurrar(mudancas: Mudanca[]): Promise<ResultadoEnvio>
  /** Opcional: notificação do servidor. Devolve a função que cancela. */
  assinar?(aoChegar: (lote: Lote) => void): () => void
}

/**
 * A porta que não sincroniza nada.
 *
 * É o que roda hoje: conta Apple gratuita não emite o entitlement de iCloud, então
 * o app funciona 100% no aparelho e a tela de Ajustes diz por que o sync está
 * apagado — em vez de mostrar um botão que não faz nada.
 */
export class PortaNula implements PortaDeNuvem {
  readonly nome = 'nenhuma'
  readonly motivo: string

  constructor(motivo = 'sync-indisponivel') {
    this.motivo = motivo
  }

  async disponivel(): Promise<boolean> {
    return false
  }

  async puxar(): Promise<Lote> {
    return { mudancas: [], marca: '', temMais: false }
  }

  async empurrar(mudancas: Mudanca[]): Promise<ResultadoEnvio> {
    // Rejeita tudo de volta: a fila NÃO pode ser esvaziada por uma porta que não
    // guardou nada, senão a primeira sincronização de verdade nasceria sem passado.
    return { marca: '', rejeitadas: mudancas }
  }
}
