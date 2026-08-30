// A porta de nuvem sobre CloudKit, do lado do JavaScript.
//
// Implementa a MESMA interface `PortaDeNuvem` que a `PortaMemoria` dos testes e
// que a `PortaNula` de hoje. É essa igualdade que faz a bateria de sync valer
// como prova: o que muda aqui é só de onde os bytes vêm.

import { moduloOpcional } from '../../../src/modulosNativos.ts'
import type { Lote, Mudanca, PortaDeNuvem, ResultadoEnvio } from '../../../../nucleo/sync/porta.ts'

const modulo = moduloOpcional<any>('Nuvem')

export type MotivoIndisponivel =
  | 'ok'
  | 'sem-modulo'
  | 'sem-conta-icloud'
  | 'restrito'
  | 'indeterminado'
  | 'temporariamente-indisponivel'
  | 'desconhecido'
  | string

export class PortaCloudKit implements PortaDeNuvem {
  readonly nome = 'icloud'

  async disponivel(): Promise<boolean> {
    if (!modulo) return false
    try {
      return (await modulo.disponivel()) as boolean
    } catch {
      // Conta Apple gratuita não emite o entitlement de iCloud, e a chamada
      // falha aqui. Isso não é erro do app: é o app rodando sem sync.
      return false
    }
  }

  async motivo(): Promise<MotivoIndisponivel> {
    if (!modulo) return 'sem-modulo'
    try {
      return (await modulo.motivo()) as MotivoIndisponivel
    } catch (e) {
      return e instanceof Error ? `erro: ${e.message}` : 'desconhecido'
    }
  }

  async puxar(desde: string | null): Promise<Lote> {
    if (!modulo) throw new Error('nuvem indisponível')
    const r = (await modulo.puxar(desde)) as Lote
    return { mudancas: r.mudancas ?? [], marca: r.marca ?? '', temMais: Boolean(r.temMais) }
  }

  async empurrar(mudancas: Mudanca[]): Promise<ResultadoEnvio> {
    if (!modulo) throw new Error('nuvem indisponível')
    const r = (await modulo.empurrar(mudancas)) as ResultadoEnvio
    return { marca: r.marca ?? '', rejeitadas: r.rejeitadas ?? [] }
  }
}

/** A porta que o app deve usar: a de verdade quando dá, a nula quando não dá. */
export async function portaDisponivel(): Promise<PortaCloudKit | null> {
  const p = new PortaCloudKit()
  return (await p.disponivel()) ? p : null
}
