import test from 'node:test'
import assert from 'node:assert/strict'
import type { Falta, Materia } from '../modelo.ts'
import { situacaoDeFaltas, type SituacaoFaltas } from '../faltas.ts'

/** `assert.ok` não estreita o tipo; esta assinatura afirma para o TS. */
function exigeSituacao(s: SituacaoFaltas | null): asserts s is SituacaoFaltas {
  assert.ok(s !== null, 'esperava situação calculada')
}

function materia(extra: Partial<Materia> = {}): Materia {
  return {
    id: 'm1',
    atualizadoEm: 0,
    removido: false,
    origem: 'teste',
    periodoId: 'p1',
    nome: 'Matemática',
    apelidos: [],
    cor: '#E4572E',
    limiteFaltasPct: 25,
    ...extra,
  }
}

function falta(extra: Partial<Falta> = {}): Falta {
  return {
    id: 'f1',
    atualizadoEm: 0,
    removido: false,
    origem: 'teste',
    materiaId: 'm1',
    data: '2026-08-03',
    aulas: 1,
    justificada: false,
    ...extra,
  }
}

test('sem carga horária informada devolve null', () => {
  assert.equal(situacaoDeFaltas(materia({}), []), null)
})

test('zero faltas: tranquilo, limite intacto', () => {
  const s = situacaoDeFaltas(materia({ cargaHoraria: 60 }), [])
  exigeSituacao(s)
  assert.equal(s.perdidas, 0)
  assert.equal(s.justificadas, 0)
  assert.equal(s.limite, 15) // 60 * 25%
  assert.equal(s.restantes, 15)
  assert.equal(s.percentual, 0)
  assert.equal(s.risco, 'tranquilo')
})

test('exatamente no limite: critico sem folga', () => {
  const s = situacaoDeFaltas(materia({ cargaHoraria: 60 }), [falta({ aulas: 15 })])
  exigeSituacao(s)
  assert.equal(s.perdidas, 15)
  assert.equal(s.restantes, 0)
  assert.equal(s.percentual, 100)
  assert.equal(s.risco, 'critico')
})

test('uma acima do limite: reprovado', () => {
  const s = situacaoDeFaltas(materia({ cargaHoraria: 60 }), [falta({ aulas: 16 })])
  exigeSituacao(s)
  assert.equal(s.perdidas, 16)
  assert.equal(s.restantes, 0) // nunca fica negativo
  assert.equal(s.percentual, 100) // estancado no topo
  assert.equal(s.risco, 'reprovado')
})

test('só faltas justificadas não gastam o limite', () => {
  const s = situacaoDeFaltas(materia({ cargaHoraria: 60 }), [
    falta({ aulas: 20, justificada: true }),
  ])
  exigeSituacao(s)
  assert.equal(s.perdidas, 0)
  assert.equal(s.justificadas, 20)
  assert.equal(s.restantes, 15)
  assert.equal(s.risco, 'tranquilo')
})

test('exatamente 50% do limite é tranquilo', () => {
  const s = situacaoDeFaltas(materia({ cargaHoraria: 80 }), [falta({ aulas: 10 })])
  exigeSituacao(s)
  assert.equal(s.percentual, 50)
  assert.equal(s.risco, 'tranquilo')
})

test('entre 50% e 80% do limite: atencao', () => {
  const s = situacaoDeFaltas(materia({ cargaHoraria: 60 }), [falta({ aulas: 10 })])
  exigeSituacao(s)
  assert.equal(s.percentual, 67) // 10 de 15 = 66.7%
  assert.equal(s.risco, 'atencao')
})

test('entre 80% e 100% do limite: critico', () => {
  const s = situacaoDeFaltas(materia({ cargaHoraria: 60 }), [falta({ aulas: 13 })])
  exigeSituacao(s)
  assert.equal(s.percentual, 87) // 13 de 15 = 86.7%
  assert.equal(s.risco, 'critico')
})

test('limite fracionário é arredondado para baixo', () => {
  const s = situacaoDeFaltas(materia({ cargaHoraria: 30 }), [falta({ aulas: 7 })])
  exigeSituacao(s)
  assert.equal(s.limite, 7) // 30 * 25% = 7.5 → 7
  assert.equal(s.restantes, 0)
  assert.equal(s.risco, 'critico')
})

test('contabiliza perdas e justificadas e ignora removidas', () => {
  const s = situacaoDeFaltas(materia({ cargaHoraria: 60 }), [
    falta({ id: 'a', aulas: 5, justificada: true }),
    falta({ id: 'b', aulas: 3 }),
    falta({ id: 'c', aulas: 10, removido: true }),
  ])
  exigeSituacao(s)
  assert.equal(s.perdidas, 3)
  assert.equal(s.justificadas, 5)
  assert.equal(s.restantes, 12)
})