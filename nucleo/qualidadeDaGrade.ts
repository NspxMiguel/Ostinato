// O app sabendo que não sabe.
//
// Ideia dele, em 31/08/2026, e é a melhor coisa que apareceu nesta conversa:
// *"ao checar a tabela, deve ter como da uma estimativa, tal coisa parece q n
// ta muito certo, ta ruim de ver, gostaria de baixar uma ia local de tantos
// gigas, para uma melhor leitura? sim, nao, escrever manualmente"*.
//
// Ela resolve o problema CERTO. Não dá para garantir leitura perfeita em toda
// escola do mundo — cada uma imprime o horário do seu jeito, e ele lembrou que
// o app não é só para ele. O que dá é o app reconhecer quando o resultado ficou
// suspeito e passar a decisão para quem está olhando, em vez de gravar quinze
// aulas erradas com cara de certeza.
//
// A regra que governa este arquivo: só acusa o que é VERIFICÁVEL. Nada de
// "parece estranho" — cada sinal aqui é uma contradição que dá para apontar com
// o dedo, e é isso que permite dizer à pessoa o QUE está errado, e não só que
// algo está.

import type { AulaCrua } from './importarGrade.ts'

export type Suspeita =
  /** Duas aulas diferentes no mesmo dia e hora. */
  | { tipo: 'choque'; onde: string }
  /** Nome de matéria com cara de frase, não de matéria. */
  | { tipo: 'nomeLongo'; onde: string }
  /** Uma letra só: o OCR partiu a célula. */
  | { tipo: 'nomeCurto'; onde: string }
  /** A aula termina antes de começar. */
  | { tipo: 'horaInvertida'; onde: string }
  /** Um dia com muito mais aula que os outros: coluna que escorregou. */
  | { tipo: 'diaDesbalanceado'; onde: string }

export type Qualidade = {
  /** 0 a 1. Abaixo de 0.7 a tela pergunta em vez de gravar. */
  nota: number
  suspeitas: Suspeita[]
  aulas: number
}

const NOME_LONGO = 28
const minutos = (h: string) => {
  const [a, b] = h.split(':').map(Number)
  return (a ?? 0) * 60 + (b ?? 0)
}

/**
 * Avalia o que foi lido.
 *
 * Sem aula nenhuma a nota é 0 — e isso não é "ruim", é "não leu". A tela trata
 * os dois casos igual de propósito: nos dois a pessoa precisa escolher o que
 * fazer, e fingir que zero aulas é um resultado seria pior.
 */
export function qualidadeDaGrade(aulas: readonly AulaCrua[]): Qualidade {
  if (aulas.length === 0) return { nota: 0, suspeitas: [], aulas: 0 }

  const suspeitas: Suspeita[] = []
  const vistos = new Map<string, string>()
  const porDia = new Map<number, number>()

  for (const a of aulas) {
    const chave = `${a.diaSemana}|${a.inicio}`
    const anterior = vistos.get(chave)
    if (anterior && anterior !== a.materia) {
      suspeitas.push({ tipo: 'choque', onde: `${anterior} / ${a.materia}` })
    }
    vistos.set(chave, a.materia)
    porDia.set(a.diaSemana, (porDia.get(a.diaSemana) ?? 0) + 1)

    const nome = a.materia.trim()
    if (nome.length > NOME_LONGO) suspeitas.push({ tipo: 'nomeLongo', onde: nome })
    // Uma letra só quase sempre é célula partida. Duas ainda é matéria de
    // verdade em muita escola — "EF", "AR" — então o corte é em uma.
    if (nome.length <= 1) suspeitas.push({ tipo: 'nomeCurto', onde: nome })

    if (minutos(a.fim) <= minutos(a.inicio)) {
      suspeitas.push({ tipo: 'horaInvertida', onde: `${a.inicio}–${a.fim}` })
    }
  }

  // Um dia MUITO acima da média denuncia coluna que escorregou para o vizinho —
  // o erro mais provável e o mais difícil de ver a olho nu.
  //
  // O corte é 1,5× e não 2×: com dois dias, 4 contra 1 é evidentemente torto e
  // não chega a 2× da média. E 1,5× não acusa variação normal — sexta com uma
  // aula a mais que o resto da semana passa longe.
  const contagens = [...porDia.values()]
  const media = contagens.reduce((s, n) => s + n, 0) / contagens.length
  for (const [dia, n] of porDia) {
    if (contagens.length > 1 && n > media * 1.5) {
      suspeitas.push({ tipo: 'diaDesbalanceado', onde: String(dia) })
    }
  }

  // Cada suspeita custa, e o custo é proporcional ao tamanho da leitura: duas
  // linhas tortas em quinze aulas é ruído; duas em três é a leitura inteira.
  const nota = Math.max(0, 1 - suspeitas.length / Math.max(4, aulas.length))
  return { nota, suspeitas, aulas: aulas.length }
}

/** Abaixo disto a tela pergunta em vez de gravar. */
export const NOTA_MINIMA = 0.7
