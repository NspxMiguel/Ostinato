// O estado do app. Uma loja só, porque o app é pequeno e tudo se olha.
//
// Toda escrita passa por `guardar`/`remover`: é ali que o envelope de sync é
// carimbado e a fila de saída é alimentada. Escrever direto na base seria o jeito
// de criar um registro que o CloudKit nunca vai ver.

import { create } from 'zustand'
import type { Ajustes, Base, Materia, Periodo, Aula, Compromisso, Nota, Falta } from '../../../nucleo/modelo.ts'
import { ajustesPadrao, baseVazia } from '../../../nucleo/modelo.ts'
import type { Registro, Tabela } from '../../../nucleo/sync/registro.ts'
import { criarId } from '../../../nucleo/sync/registro.ts'
import type { ItemFila } from '../../../nucleo/sync/fila.ts'
import { CHAVES, escrever, idDesteAparelho, ler } from './armazenamento.ts'

type PorTabela = {
  periodos: Periodo
  materias: Materia
  aulas: Aula
  compromissos: Compromisso
  notas: Nota
  faltas: Falta
}

type Loja = {
  base: Base
  ajustes: Ajustes
  fila: ItemFila[]
  marca: string | null
  aparelho: string

  /** Cria ou atualiza. Sem `id`, cria; com `id`, atualiza o que existe. */
  guardar: <T extends Tabela>(tabela: T, valor: Partial<PorTabela[T]> & { id?: string }) => string
  remover: (tabela: Tabela, id: string) => void
  mudarAjustes: (mudanca: Partial<Ajustes>) => void
  substituirBase: (base: Base, marca: string | null, fila: ItemFila[]) => void
}

function agora(): number {
  return Date.now()
}

export const usarLoja = create<Loja>((set, get) => ({
  base: ler<Base>(CHAVES.base, baseVazia()),
  ajustes: { ...ajustesPadrao(), ...ler<Partial<Ajustes>>(CHAVES.ajustes, {}) },
  fila: ler<ItemFila[]>(CHAVES.fila, []),
  marca: ler<string | null>(CHAVES.marca, null),
  aparelho: idDesteAparelho(),

  guardar: (tabela, valor) => {
    const t = agora()
    const estado = get()
    const id = valor.id ?? criarId()
    const anterior = (estado.base[tabela] as Record<string, Registro>)[id]

    const registro = {
      ...(anterior ?? {}),
      ...valor,
      id,
      atualizadoEm: t,
      removido: false,
      origem: estado.aparelho,
    } as Registro

    const base: Base = {
      ...estado.base,
      [tabela]: { ...estado.base[tabela], [id]: registro },
    }
    const fila = enfileirar(estado.fila, tabela, id, t)
    escrever(CHAVES.base, base)
    escrever(CHAVES.fila, fila)
    set({ base, fila })
    return id
  },

  remover: (tabela, id) => {
    const t = agora()
    const estado = get()
    const anterior = (estado.base[tabela] as Record<string, Registro>)[id]
    if (!anterior) return

    // Lápide, não delete: sem ela o outro aparelho devolve o registro na próxima
    // sincronização, e o usuário vê a matéria que apagou voltando sozinha.
    const registro: Registro = { ...anterior, removido: true, atualizadoEm: t, origem: estado.aparelho }
    const base: Base = {
      ...estado.base,
      [tabela]: { ...estado.base[tabela], [id]: registro },
    }
    const fila = enfileirar(estado.fila, tabela, id, t)
    escrever(CHAVES.base, base)
    escrever(CHAVES.fila, fila)
    set({ base, fila })
  },

  mudarAjustes: (mudanca) => {
    const ajustes = { ...get().ajustes, ...mudanca }
    escrever(CHAVES.ajustes, ajustes)
    set({ ajustes })
  },

  substituirBase: (base, marca, fila) => {
    escrever(CHAVES.base, base)
    escrever(CHAVES.marca, marca)
    escrever(CHAVES.fila, fila)
    set({ base, marca, fila })
  },
}))

function enfileirar(fila: ItemFila[], tabela: Tabela, id: string, quando: number): ItemFila[] {
  const semEste = fila.filter((i) => !(i.tabela === tabela && i.id === id))
  return [...semEste, { tabela, id, enfileiradoEm: quando }]
}
