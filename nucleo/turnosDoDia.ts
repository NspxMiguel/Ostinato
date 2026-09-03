// A régua do dia: aulas seguidas da mesma matéria viram um bloco só, e os
// blocos se agrupam em manhã, tarde e noite.
//
// O motivo é a tela. Uma quinta-feira com onze tempos virava onze linhas, e
// seis delas diziam a mesma coisa duas vezes seguidas — "ING 7:25, ING 8:00".
// Ninguém lê o horário assim: quem tem dois tempos de inglês tem inglês das
// 7:25 às 8:45.
//
// Turno vazio não aparece. Escola de um turno só mostraria dois títulos vazios
// todo dia, e título vazio ensina a pessoa a ignorar títulos.

import type { AulaNoDia } from './grade.ts'

export type Turno = 'manha' | 'tarde' | 'noite'

/**
 * Aulas seguidas da mesma matéria, vistas como uma.
 *
 * `aulas` é a lista original, para quem precisar do detalhe — quantos tempos
 * são, e qual sala em cada um.
 */
export type BlocoDeAula = {
  materiaId: string
  materia: AulaNoDia['materia']
  inicio: string
  fim: string
  aulas: AulaNoDia[]
}

export type TurnoComAulas = { turno: Turno; blocos: BlocoDeAula[] }

/** Meio-dia e seis da tarde: as fronteiras que qualquer pessoa usaria. */
const FIM_DA_MANHA = 12 * 60
const FIM_DA_TARDE = 18 * 60

export function emMinutos(hora: string): number {
  const [h, m] = hora.split(':')
  return Number(h) * 60 + Number(m ?? 0)
}

export function turnoDe(hora: string): Turno {
  const m = emMinutos(hora)
  if (m < FIM_DA_MANHA) return 'manha'
  if (m < FIM_DA_TARDE) return 'tarde'
  return 'noite'
}

/**
 * Junta aulas CONSECUTIVAS da mesma matéria.
 *
 * Consecutivas de verdade: só junta quando uma começa onde a outra terminou, ou
 * quase. Duas aulas de matemática separadas pelo recreio continuam sendo duas —
 * dizer "matemática das 7h às 12h" quando existe um intervalo de meia hora no
 * meio seria mentir sobre o dia da pessoa.
 *
 * A folga de 15 minutos existe porque escola nenhuma encosta um tempo no outro
 * com precisão de relógio: 7:25–8:10 seguido de 8:15–9:00 é aula dupla.
 */
const FOLGA_ENTRE_TEMPOS = 15

export function unificarAulas(aulas: readonly AulaNoDia[]): BlocoDeAula[] {
  const blocos: BlocoDeAula[] = []
  for (const item of aulas) {
    const ultimo = blocos[blocos.length - 1]
    const emenda =
      ultimo !== undefined &&
      ultimo.materiaId === item.aula.materiaId &&
      emMinutos(item.aula.inicio) - emMinutos(ultimo.fim) <= FOLGA_ENTRE_TEMPOS &&
      emMinutos(item.aula.inicio) >= emMinutos(ultimo.fim)
    if (emenda) {
      ultimo.fim = item.aula.fim
      ultimo.aulas.push(item)
      continue
    }
    blocos.push({
      materiaId: item.aula.materiaId,
      materia: item.materia,
      inicio: item.aula.inicio,
      fim: item.aula.fim,
      aulas: [item],
    })
  }
  return blocos
}

/**
 * Os turnos que TÊM aula, na ordem do dia.
 *
 * Um turno sem aula não vira seção vazia: ele não existe. Se o dia inteiro cabe
 * na manhã, sai um grupo só — e é isso que ele pediu.
 */
export function turnosComAulas(aulas: readonly AulaNoDia[]): TurnoComAulas[] {
  const ordem: Turno[] = ['manha', 'tarde', 'noite']
  const porTurno = new Map<Turno, AulaNoDia[]>()
  for (const item of aulas) {
    const turno = turnoDe(item.aula.inicio)
    const lista = porTurno.get(turno)
    if (lista) lista.push(item)
    else porTurno.set(turno, [item])
  }
  return ordem
    .filter((turno) => (porTurno.get(turno)?.length ?? 0) > 0)
    .map((turno) => ({ turno, blocos: unificarAulas(porTurno.get(turno) ?? []) }))
}
