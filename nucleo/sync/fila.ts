// A fila de saída: o que este aparelho ainda não conseguiu contar para a nuvem.
//
// Decisão que importa: a fila guarda REFERÊNCIA (tabela + id), não uma cópia do
// registro. Se guardasse cópia, uma edição feita offline enfileiraria a versão
// antiga e depois a nova, e o envio mandaria as duas — a última podendo chegar
// primeiro e ser sobrescrita pela penúltima. Guardando referência, o envio sempre
// lê o estado atual, e cada registro sai uma vez só, na versão que vale.

import type { Tabela } from './registro.ts'

export type ItemFila = {
  tabela: Tabela
  id: string
  enfileiradoEm: number
}

function chave(tabela: Tabela, id: string): string {
  return `${tabela}:${id}`
}

export class FilaDeSaida {
  private itens = new Map<string, ItemFila>()

  constructor(iniciais: ItemFila[] = []) {
    for (const i of iniciais) this.itens.set(chave(i.tabela, i.id), i)
  }

  /** Enfileira. Enfileirar o mesmo registro de novo só atualiza o carimbo. */
  enfileirar(tabela: Tabela, id: string, agora: number): void {
    this.itens.set(chave(tabela, id), { tabela, id, enfileiradoEm: agora })
  }

  /** Ordem de chegada — o servidor recebe as mudanças na ordem em que aconteceram. */
  pendentes(): ItemFila[] {
    return [...this.itens.values()].sort((a, b) => a.enfileiradoEm - b.enfileiradoEm)
  }

  get tamanho(): number {
    return this.itens.size
  }

  /**
   * Tira da fila o que o servidor confirmou.
   *
   * Só remove se o carimbo não mudou: se o registro foi editado DEPOIS de sair
   * para o envio, ele continua pendente. Sem essa checagem, uma edição feita
   * durante o envio some para sempre.
   */
  confirmar(itens: ItemFila[]): void {
    for (const i of itens) {
      const k = chave(i.tabela, i.id)
      const atual = this.itens.get(k)
      if (atual && atual.enfileiradoEm === i.enfileiradoEm) this.itens.delete(k)
    }
  }

  serializar(): ItemFila[] {
    return this.pendentes()
  }

  static restaurar(itens: ItemFila[] | undefined | null): FilaDeSaida {
    return new FilaDeSaida(Array.isArray(itens) ? itens : [])
  }
}
