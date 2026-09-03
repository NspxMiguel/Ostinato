import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AulaNoDia } from '../grade.ts'
import { turnoDe, turnosComAulas, unificarAulas } from '../turnosDoDia.ts'

function aula(materiaId: string, inicio: string, fim: string): AulaNoDia {
  return {
    aula: {
      id: `${materiaId}-${inicio}`,
      materiaId,
      diaSemana: 2,
      inicio,
      fim,
      semana: 'toda',
      atualizadoEm: 0,
      removido: false,
      origem: 'teste',
    } as AulaNoDia['aula'],
    materia: { id: materiaId, nome: materiaId, cor: '#fff' } as AulaNoDia['materia'],
    data: '2026-09-03' as AulaNoDia['data'],
    quando: new Date(`2026-09-03T${inicio}:00`),
  }
}

test('back-to-back classes of the same subject become one block', () => {
  const blocos = unificarAulas([aula('ING', '07:25', '08:00'), aula('ING', '08:00', '08:45')])
  assert.equal(blocos.length, 1)
  assert.equal(blocos[0]!.inicio, '07:25')
  assert.equal(blocos[0]!.fim, '08:45')
  assert.equal(blocos[0]!.aulas.length, 2)
})

test('a short gap between periods still counts as one block', () => {
  // 8:10 -> 8:15 is the corridor, not a break.
  const blocos = unificarAulas([aula('MAT', '07:25', '08:10'), aula('MAT', '08:15', '09:00')])
  assert.equal(blocos.length, 1)
  assert.equal(blocos[0]!.fim, '09:00')
})

test('the same subject on both sides of a real break stays two blocks', () => {
  // Saying "maths 7:25 to 12:00" would lie about the person's day.
  const blocos = unificarAulas([aula('MAT', '07:25', '08:10'), aula('MAT', '08:40', '09:25')])
  assert.equal(blocos.length, 2)
})

test('different subjects never merge', () => {
  const blocos = unificarAulas([aula('ING', '07:25', '08:00'), aula('HIS', '08:00', '08:45')])
  assert.equal(blocos.length, 2)
})

test('shift boundaries are noon and six', () => {
  assert.equal(turnoDe('07:25'), 'manha')
  assert.equal(turnoDe('11:59'), 'manha')
  assert.equal(turnoDe('12:00'), 'tarde')
  assert.equal(turnoDe('17:59'), 'tarde')
  assert.equal(turnoDe('18:00'), 'noite')
  assert.equal(turnoDe('23:30'), 'noite')
})

test('a morning-only day yields exactly one shift', () => {
  const turnos = turnosComAulas([aula('ING', '07:25', '08:00'), aula('HIS', '08:00', '08:45')])
  assert.equal(turnos.length, 1)
  assert.equal(turnos[0]!.turno, 'manha')
})

test('shifts come out in the order of the day, and empty ones are absent', () => {
  const turnos = turnosComAulas([aula('ING', '07:25', '08:00'), aula('QUI', '19:00', '19:45')])
  assert.deepEqual(
    turnos.map((s) => s.turno),
    ['manha', 'noite'],
  )
})

test('merging happens inside a shift, not across it', () => {
  // Same subject either side of noon: two blocks, because they are two shifts.
  const turnos = turnosComAulas([aula('MAT', '11:15', '12:00'), aula('MAT', '12:00', '12:45')])
  assert.equal(turnos.length, 2)
  assert.equal(turnos[0]!.blocos.length, 1)
  assert.equal(turnos[1]!.blocos.length, 1)
})

test('no classes means no shifts at all', () => {
  assert.deepEqual(turnosComAulas([]), [])
})
