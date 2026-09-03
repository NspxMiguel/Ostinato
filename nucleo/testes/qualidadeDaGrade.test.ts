import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NOTA_MINIMA, qualidadeDaGrade } from '../qualidadeDaGrade.ts'
import type { AulaCrua } from '../importarGrade.ts'

const aula = (d: number, i: string, f: string, m: string): AulaCrua =>
  ({ diaSemana: d, inicio: i, fim: f, materia: m, confianca: 1 }) as AulaCrua

test('leitura boa passa do corte', () => {
  const q = qualidadeDaGrade([
    aula(1, '07:25', '08:00', 'ERE'),
    aula(2, '07:25', '08:00', 'ALE'),
    aula(3, '07:25', '08:00', 'LPO'),
    aula(4, '07:25', '08:00', 'ING'),
    aula(5, '07:25', '08:00', 'MAT'),
  ])
  assert.equal(q.suspeitas.length, 0)
  assert.ok(q.nota >= NOTA_MINIMA)
})

test('duas materias no mesmo dia e hora e choque', () => {
  const q = qualidadeDaGrade([aula(1, '07:00', '08:00', 'MAT'), aula(1, '07:00', '08:00', 'FIS')])
  assert.equal(q.suspeitas[0]?.tipo, 'choque')
})

test('celula partida vira nome de uma letra', () => {
  const q = qualidadeDaGrade([aula(1, '07:00', '08:00', 'M')])
  assert.equal(q.suspeitas[0]?.tipo, 'nomeCurto')
})

test('frase inteira numa celula denuncia coluna errada', () => {
  const q = qualidadeDaGrade([aula(1, '07:00', '08:00', 'MAT MAT FIS ALE TER LIV Culto')])
  assert.equal(q.suspeitas[0]?.tipo, 'nomeLongo')
})

test('aula que termina antes de comecar', () => {
  const q = qualidadeDaGrade([aula(1, '10:00', '09:00', 'MAT')])
  assert.equal(q.suspeitas[0]?.tipo, 'horaInvertida')
})

test('nada lido tem nota zero, e isso NAO e "ruim" — e "nao leu"', () => {
  const q = qualidadeDaGrade([])
  assert.equal(q.nota, 0)
  assert.equal(q.aulas, 0)
})

test('um dia com o dobro da media denuncia coluna escorregada', () => {
  const q = qualidadeDaGrade([
    aula(1, '07:00', '08:00', 'MAT'), aula(1, '08:00', '09:00', 'FIS'),
    aula(1, '09:00', '10:00', 'LPO'), aula(1, '10:00', '11:00', 'GEO'),
    aula(2, '07:00', '08:00', 'ING'),
  ])
  assert.ok(q.suspeitas.some((s) => s.tipo === 'diaDesbalanceado'))
})
