// Quem sincroniza, quando, e com qual porta.
//
// Hoje a resposta é "ninguém": conta Apple gratuita não emite o entitlement do
// iCloud, então a `PortaCloudKit` responde indisponível e o app roda inteiro no
// aparelho. Toda a máquina em volta já está de pé, e ligar é trocar uma porta.

import { FilaDeSaida } from '../../nucleo/sync/fila.ts'
import { PortaNula, type PortaDeNuvem } from '../../nucleo/sync/porta.ts'
import { sincronizar, type Relatorio } from '../../nucleo/sync/sincronizar.ts'
import { PortaCloudKit } from '../modules/nuvem/src/index.ts'
import { usarLoja } from './estado/loja.ts'

let porta: PortaDeNuvem = new PortaNula('entitlement-icloud-ausente')
let escolhida = false

/** Descobre uma vez qual porta serve, e guarda a resposta. */
export async function portaAtual(): Promise<PortaDeNuvem> {
  if (escolhida) return porta
  const icloud = new PortaCloudKit()
  porta = (await icloud.disponivel()) ? icloud : new PortaNula('entitlement-icloud-ausente')
  escolhida = true
  return porta
}

export async function rodarSincronizacao(): Promise<Relatorio> {
  const loja = usarLoja.getState()
  const p = await portaAtual()
  const r = await sincronizar(
    { base: loja.base, fila: FilaDeSaida.restaurar(loja.fila), marca: loja.marca },
    p,
  )
  loja.substituirBase(r.estado.base, r.estado.marca, r.estado.fila.serializar())
  return r.relatorio
}

/** O texto que a tela de Ajustes mostra. */
export async function estadoDaNuvem(): Promise<{ ligada: boolean; motivo: string }> {
  const p = await portaAtual()
  if (p instanceof PortaNula) return { ligada: false, motivo: p.motivo }
  return { ligada: true, motivo: 'ok' }
}
