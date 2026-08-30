// Uma rodada de sincronização: puxa, mescla, empurra.
//
// A ordem não é gosto. Puxar primeiro faz a mesclagem acontecer ANTES do envio, e
// aí o que sai já é o resultado — inclusive os registros locais que venceram um
// remoto velho. Empurrando primeiro, seriam necessárias duas rodadas para as duas
// bases ficarem iguais, e a segunda poderia nunca acontecer.

import type { Base } from '../modelo.ts'
import { FilaDeSaida, type ItemFila } from './fila.ts'
import { mesclarBase, mudancaDe } from './mesclar.ts'
import type { Mudanca, PortaDeNuvem } from './porta.ts'

export type EstadoSync = {
  base: Base
  fila: FilaDeSaida
  /** Até onde este aparelho já leu do servidor. */
  marca: string | null
}

export type Relatorio = {
  disponivel: boolean
  recebidas: number
  descartadas: number
  enviadas: number
  rejeitadas: number
  marca: string | null
  pendentes: number
  erro?: string
}

export async function sincronizar(
  estado: EstadoSync,
  porta: PortaDeNuvem,
): Promise<{ estado: EstadoSync; relatorio: Relatorio }> {
  const parado = (erro?: string): { estado: EstadoSync; relatorio: Relatorio } => ({
    estado,
    relatorio: {
      disponivel: false,
      recebidas: 0,
      descartadas: 0,
      enviadas: 0,
      rejeitadas: 0,
      marca: estado.marca,
      pendentes: estado.fila.tamanho,
      ...(erro ? { erro } : {}),
    },
  })

  if (!(await porta.disponivel())) return parado()

  let base: Base = estado.base
  let marca = estado.marca
  let recebidas = 0
  let descartadas = 0
  const reenviar: Mudanca[] = []

  try {
    // 1. Puxar tudo o que há de novo, em lotes até acabar.
    let temMais = true
    let voltas = 0
    while (temMais && voltas < 100) {
      const lote = await porta.puxar(marca)
      const r = mesclarBase(base, lote.mudancas)
      base = r.base
      recebidas += r.aplicadas
      descartadas += r.descartadas
      reenviar.push(...r.reenviar)
      marca = lote.marca || marca
      temMais = lote.temMais
      voltas++
    }

    // 2. Montar o envio: a fila deste aparelho, mais o que a mesclagem provou
    //    que o servidor tem desatualizado.
    const pendentes: ItemFila[] = estado.fila.pendentes()
    const daFila = pendentes
      .map((i) => mudancaDe(base, i.tabela, i.id))
      .filter((m): m is Mudanca => m !== undefined)

    const porChave = new Map<string, Mudanca>()
    for (const m of [...daFila, ...reenviar]) porChave.set(`${m.tabela}:${m.registro.id}`, m)
    const envio = [...porChave.values()]

    if (envio.length === 0) {
      return {
        estado: { base, fila: estado.fila, marca },
        relatorio: {
          disponivel: true,
          recebidas,
          descartadas,
          enviadas: 0,
          rejeitadas: 0,
          marca,
          pendentes: estado.fila.tamanho,
        },
      }
    }

    const resposta = await porta.empurrar(envio)
    marca = resposta.marca || marca

    // 3. O que o servidor recusou volta como versão dele, e é mesclado — assim a
    //    rejeição não vira mudança perdida.
    if (resposta.rejeitadas.length > 0) {
      const r = mesclarBase(base, resposta.rejeitadas)
      base = r.base
      recebidas += r.aplicadas
    }

    const recusados = new Set(resposta.rejeitadas.map((m) => `${m.tabela}:${m.registro.id}`))
    estado.fila.confirmar(pendentes.filter((i) => !recusados.has(`${i.tabela}:${i.id}`)))

    return {
      estado: { base, fila: estado.fila, marca },
      relatorio: {
        disponivel: true,
        recebidas,
        descartadas,
        enviadas: envio.length - resposta.rejeitadas.length,
        rejeitadas: resposta.rejeitadas.length,
        marca,
        pendentes: estado.fila.tamanho,
      },
    }
  } catch (e) {
    // Falhou no meio: a fila NÃO é esvaziada, e a marca só avança até onde deu.
    // Perder a fila por um erro de rede é como perder as mudanças.
    return {
      estado: { base, fila: estado.fila, marca },
      relatorio: {
        disponivel: true,
        recebidas,
        descartadas,
        enviadas: 0,
        rejeitadas: 0,
        marca,
        pendentes: estado.fila.tamanho,
        erro: e instanceof Error ? e.message : String(e),
      },
    }
  }
}

export function estadoInicial(base: Base): EstadoSync {
  return { base, fila: new FilaDeSaida(), marca: null }
}

export { FilaDeSaida }
