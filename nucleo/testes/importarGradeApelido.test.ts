import test from 'node:test'
import assert from 'node:assert/strict'
import { importarGrade } from '../importarGrade.ts'

const nomes = (texto: string): string[] => importarGrade(texto).materias

test('a abreviação da tabela e o nome por extenso viram uma matéria só', () => {
  assert.deepEqual(nomes('Seg 07:00 Matemática\nQua 07:00 MAT'), ['Matemática'])
  assert.deepEqual(nomes('Seg 13:30-14:20 Matematica\n2a 07h00 Mat.'), ['Matematica'])
})

test('abreviação de duas letras NÃO junta — casaria com coisa demais', () => {
  assert.deepEqual(nomes('Seg 07:00 Ed\nQua 07:00 Educação Física'), ['Ed', 'Educação Física'])
})

test('matérias diferentes com a mesma inicial continuam separadas', () => {
  assert.deepEqual(nomes('Seg 07:00 Fisica\nQua 07:00 Filosofia\nSex 07:00 Frances'), [
    'Fisica',
    'Filosofia',
    'Frances',
  ])
})

test('a aula também passa a apontar para o nome consolidado', () => {
  const r = importarGrade('Seg 07:00 MAT\nQua 07:00 Matemática')
  assert.deepEqual([...new Set(r.aulas.map((a) => a.materia))], ['Matemática'])
})
