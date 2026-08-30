// Uma nuvem de mentira, e portas ligadas nela.
//
// É com isto que o sync é provado HOJE, sem CloudKit, sem conta paga e sem
// simulador: dois "aparelhos" na memória, um servidor no meio, e a liberdade de
// desligar a rede de um lado no meio da história. Se a semântica passa aqui, o
// CloudKit é só transporte.

import type { Registro } from './registro.ts'
import { mesclarRegistro } from './mesclar.ts'
import type { Lote, Mudanca, PortaDeNuvem, ResultadoEnvio } from './porta.ts'

type Guardado = { mudanca: Mudanca; versao: number }

export class NuvemFalsa {
  private porChave = new Map<string, Guardado>()
  private versao = 0
  private ouvintes = new Set<(lote: Lote) => void>()

  private chave(m: Mudanca): string {
    return `${m.tabela}:${m.registro.id}`
  }

  /** O servidor também mescla: dois aparelhos podem escrever no mesmo instante. */
  gravar(mudancas: Mudanca[]): { aceitas: Mudanca[]; rejeitadas: Mudanca[]; marca: string } {
    const aceitas: Mudanca[] = []
    const rejeitadas: Mudanca[] = []
    for (const m of mudancas) {
      const k = this.chave(m)
      const atual = this.porChave.get(k)
      const r = mesclarRegistro(atual?.mudanca.registro as Registro | undefined, m.registro)
      if (r.valor === m.registro) {
        this.versao++
        this.porChave.set(k, { mudanca: m, versao: this.versao })
        aceitas.push(m)
      } else {
        rejeitadas.push(atual ? atual.mudanca : m)
      }
    }
    const marca = String(this.versao)
    if (aceitas.length > 0) {
      const lote: Lote = { mudancas: aceitas, marca, temMais: false }
      for (const o of this.ouvintes) o(lote)
    }
    return { aceitas, rejeitadas, marca }
  }

  desde(marca: string | null, tamanhoDoLote: number): Lote {
    const corte = marca ? Number(marca) : 0
    const todas = [...this.porChave.values()]
      .filter((g) => g.versao > corte)
      .sort((a, b) => a.versao - b.versao)
    const pedaco = todas.slice(0, tamanhoDoLote)
    const ultima = pedaco[pedaco.length - 1]
    return {
      mudancas: pedaco.map((g) => g.mudanca),
      marca: ultima ? String(ultima.versao) : (marca ?? ''),
      temMais: todas.length > pedaco.length,
    }
  }

  assinar(cb: (lote: Lote) => void): () => void {
    this.ouvintes.add(cb)
    return () => this.ouvintes.delete(cb)
  }

  get tamanho(): number {
    return this.porChave.size
  }
}

export class PortaMemoria implements PortaDeNuvem {
  readonly nome: string
  /** Desligar a "rede" deste aparelho, para testar fila offline. */
  offline = false
  /** Quantas mudanças cabem num lote — para exercitar paginação. */
  tamanhoDoLote: number

  // Sem `private` no parâmetro: o Node roda TypeScript apagando os tipos, e
  // propriedade declarada no construtor não é tipo — é código que teria que ser
  // gerado. O nucleo inteiro fica dentro do que o apagador entende.
  private nuvem: NuvemFalsa

  constructor(
    nuvem: NuvemFalsa,
    opcoes: { nome?: string; offline?: boolean; tamanhoDoLote?: number } = {},
  ) {
    this.nuvem = nuvem
    this.nome = opcoes.nome ?? 'memoria'
    this.offline = opcoes.offline ?? false
    this.tamanhoDoLote = opcoes.tamanhoDoLote ?? 1000
  }

  async disponivel(): Promise<boolean> {
    return !this.offline
  }

  async puxar(desde: string | null): Promise<Lote> {
    if (this.offline) throw new Error('offline')
    return this.nuvem.desde(desde, this.tamanhoDoLote)
  }

  async empurrar(mudancas: Mudanca[]): Promise<ResultadoEnvio> {
    if (this.offline) throw new Error('offline')
    const r = this.nuvem.gravar(mudancas)
    return { marca: r.marca, rejeitadas: r.rejeitadas }
  }

  assinar(aoChegar: (lote: Lote) => void): () => void {
    return this.nuvem.assinar((lote) => {
      if (!this.offline) aoChegar(lote)
    })
  }
}
