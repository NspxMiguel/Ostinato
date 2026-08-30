// Cálculo de médias e metas dentro de uma matéria.
//
// Notas podem viver em escalas diferentes (0-10 aqui, 0-100 ali): a média é
// calculada na escala do máximo mais comum, e cada nota entra normalizada.

import type { Nota } from './modelo.ts'

/**
 * O `maximo` que aparece com mais frequência entre as notas. Em empate escolhe
 * o maior — a escala não muda a proporção, só o número absoluto da resposta.
 */
function maximoMaisComum(notas: Nota[]): number | null {
  const contagem = new Map<number, number>()
  for (const nota of notas) {
    if (nota.maximo <= 0) continue
    contagem.set(nota.maximo, (contagem.get(nota.maximo) ?? 0) + 1)
  }
  let melhor: number | null = null
  let melhorQuantidade = 0
  for (const [maximo, quantidade] of contagem) {
    if (
      quantidade > melhorQuantidade ||
      (quantidade === melhorQuantidade && (melhor === null || maximo > melhor))
    ) {
      melhor = maximo
      melhorQuantidade = quantidade
    }
  }
  return melhor
}

/**
 * Média ponderada de uma matéria, na escala do `maximo` mais comum (cada nota
 * é normalizada para essa escala antes de pesar). Devolve `null` quando não há
 * nota viva — sem dado, não há média.
 */
export function mediaDaMateria(notas: Nota[]): number | null {
  const vivas = notas.filter((nota) => !nota.removido)
  if (vivas.length === 0) return null

  const escala = maximoMaisComum(vivas)
  if (escala === null) return null

  let somaPonderada = 0
  let somaPesos = 0
  for (const nota of vivas) {
    if (nota.maximo <= 0) continue
    const normalizada = (nota.valor / nota.maximo) * escala
    somaPonderada += normalizada * nota.peso
    somaPesos += nota.peso
  }
  if (somaPesos === 0) return null

  return somaPonderada / somaPesos
}

/**
 * Quanto precisa tirar na próxima prova para fechar a média `mediaAlvo`.
 * `mediaAlvo` e o resultado estão na escala de `maximoDaProxima` — as notas
 * antigas são normalizadas para essa mesma escala.
 *
 * Já passa tirando zero: devolve 0 com `possivel: true`. O número necessário
 * passa do máximo: devolve o número real com `possivel: false`, pra ninguém
 * mentir pro aluno.
 */
export function precisaTirar(
  notas: Nota[],
  mediaAlvo: number,
  pesoDaProxima: number,
  maximoDaProxima: number,
): { nota: number; possivel: boolean } {
  const vivas = notas.filter((nota) => !nota.removido)

  let somaPonderada = 0
  let somaPesos = 0
  for (const nota of vivas) {
    if (nota.maximo <= 0) continue
    const normalizada = (nota.valor / nota.maximo) * maximoDaProxima
    somaPonderada += normalizada * nota.peso
    somaPesos += nota.peso
  }

  const nota =
    (mediaAlvo * (somaPesos + pesoDaProxima) - somaPonderada) / pesoDaProxima

  if (nota <= 0) return { nota: 0, possivel: true }
  if (nota > maximoDaProxima) return { nota, possivel: false }
  return { nota, possivel: true }
}