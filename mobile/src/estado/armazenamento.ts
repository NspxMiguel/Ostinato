// Onde o Giz guarda tudo: MMKV, síncrono, no aparelho.
//
// Síncrono importa: a tela "Hoje" precisa desenhar a lista já preenchida no
// primeiro quadro. Armazenamento assíncrono obriga a um estado "carregando" que o
// usuário vê toda vez que abre o app, para ler uns poucos kilobytes.

import { createMMKV } from 'react-native-mmkv'
import { criarId } from '../../../nucleo/sync/registro.ts'

const mmkv = createMMKV({ id: 'giz' })

export function ler<T>(chave: string, padrao: T): T {
  const bruto = mmkv.getString(chave)
  if (!bruto) return padrao
  try {
    return JSON.parse(bruto) as T
  } catch {
    // Guardado corrompido não pode derrubar o app na abertura: perde-se aquela
    // chave, não a sessão inteira.
    return padrao
  }
}

export function escrever(chave: string, valor: unknown): void {
  mmkv.set(chave, JSON.stringify(valor))
}

export function apagarChave(chave: string): void {
  mmkv.remove(chave)
}

/**
 * A identidade deste aparelho, criada uma vez e guardada para sempre.
 *
 * É o `origem` de todo registro, e é o que desempata uma edição simultânea entre
 * dois aparelhos. Trocar esse id depois faria o outro aparelho tratar tudo como
 * escrito por um terceiro — daí ele nascer aqui, antes de qualquer gravação.
 */
export function idDesteAparelho(): string {
  const guardado = mmkv.getString('aparelho.id')
  if (guardado) return guardado
  const novo = criarId()
  mmkv.set('aparelho.id', novo)
  return novo
}

export const CHAVES = {
  base: 'base',
  ajustes: 'ajustes',
  fila: 'sync.fila',
  marca: 'sync.marca',
  agendadas: 'avisos.agendadas',
} as const
