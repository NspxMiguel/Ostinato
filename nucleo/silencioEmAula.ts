// Nenhum aviso toca enquanto você está em aula.
//
// Pedido dele em 30/08/2026: *"configura pra nunca toca em periodo de aula,
// tipo, eu tenho aula de mat as 9 da manha, as 7 da manha n pode tocar nada,
// ate pq isso é periodo de aula para mim. outras aulas n mat."*
//
// A regra que isso estabelece, e ela não é óbvia: o que silencia o aviso é
// estar EM AULA, de qualquer matéria — não a aula da matéria do compromisso.
// Um alarme de tarefa de matemática às 7h toca no meio da aula de geografia, e
// para quem está lá dentro isso é a mesma coisa que tocar na aula de matemática.
//
// O aviso não é descartado: ele é EMPURRADO para o primeiro instante livre
// depois da aula. Cancelar um aviso porque ele caiu numa hora ruim é a falha
// mais grave que este app pode ter — a pessoa confia que vai ser avisada.
//
// Puro, sem I/O: testável e atravessa para Android sem mudança.

import type { Base, DataISO, Periodo } from './modelo.ts'
import { aulasDoDia } from './grade.ts'
import { dataDe, instante } from './tempo.ts'

/** Um intervalo ocupado. */
export type Janela = { de: Date; ate: Date }

/**
 * As aulas do dia, como janelas.
 *
 * Sem período letivo ou sem grade a lista é vazia — e aí nada é silenciado, que
 * é o certo: quem não cadastrou aula não está em aula que o app conheça.
 */
export function aulasComoJanelas(
  base: Base,
  periodo: Periodo | undefined,
  iso: DataISO,
  inverterSemana = false,
): Janela[] {
  if (!periodo) return []
  return aulasDoDia(base, periodo, iso, inverterSemana)
    .map((a) => ({ de: instante(iso, a.aula.inicio), ate: instante(iso, a.aula.fim) }))
    .sort((x, y) => x.de.getTime() - y.de.getTime())
}

/**
 * O instante em que o aviso pode tocar sem cair dentro de uma aula.
 *
 * Devolve o próprio `quando` se ele já está livre. Se cai dentro de uma aula,
 * devolve o fim dela — e continua empurrando enquanto o novo horário cair na
 * aula seguinte, porque aulas coladas (uma terminando 09:30 e outra começando
 * 09:30) formam um bloco contínuo em que a pessoa não olha o telefone.
 */
export function foraDeAula(quando: Date, janelas: Janela[]): Date {
  let alvo = quando
  // O laço tem teto: sem ele, dados estranhos — uma aula que termina antes de
  // começar — girariam para sempre. Doze é mais aulas do que qualquer dia tem.
  for (let i = 0; i < 12; i++) {
    const dentro = janelas.find((j) => alvo >= j.de && alvo < j.ate)
    if (!dentro) return alvo
    alvo = dentro.ate
  }
  return alvo
}

/**
 * Empurra um aviso para fora do horário de aula, usando a grade do dia dele.
 *
 * Recalcula as janelas quando o aviso muda de dia: um aviso de segunda não pode
 * ser conferido contra as aulas de domingo.
 */
export function respeitarAula(
  quando: Date,
  base: Base,
  periodo: Periodo | undefined,
  inverterSemana = false,
): Date {
  return foraDeAula(quando, aulasComoJanelas(base, periodo, dataDe(quando), inverterSemana))
}
