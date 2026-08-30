import test from 'node:test'
import assert from 'node:assert/strict'
import type { Nota } from '../modelo.ts'
import { mediaDaMateria, precisaTirar } from '../notas.ts'

/** `assert.ok` não estreita o tipo; esta assinatura afirma para o TS. */
function exigeMedia(media: number | null): asserts media is number {
  assert.ok(media !== null, 'esperava média calculada')
}

function nota(extra: Partial<Nota> = {}): Nota {
  return {
    id: 'n1',
    atualizadoEm: 0,
    removido: false,
    origem: 'teste',
    materiaId: 'm1',
    titulo: 'Prova',
    valor: 0,
    maximo: 10,
    peso: 1,
    ...extra,
  }
}

test('mediaDaMateria sem notas devolve null', () => {
  assert.equal(mediaDaMateria([]), null)
})

test('mediaDaMateria pondera pelo peso na mesma escala', () => {
  const media = mediaDaMateria([
    nota({ id: 'a', valor: 8, maximo: 10, peso: 2 }),
    nota({ id: 'b', valor: 4, maximo: 10, peso: 3 }),
  ])
  exigeMedia(media)
  assert.ok(Math.abs(media - 5.6) < 1e-9) // (8*2 + 4*3) / 5
})

test('mediaDaMateria normaliza notas de escalas diferentes', () => {
  const media = mediaDaMateria([
    nota({ id: 'a', valor: 8, maximo: 10, peso: 2 }),
    nota({ id: 'b', valor: 6, maximo: 10, peso: 3 }),
    nota({ id: 'c', valor: 50, maximo: 100, peso: 5 }),
  ])
  exigeMedia(media)
  assert.ok(Math.abs(media - 5.9) < 1e-9) // (8*2 + 6*3 + 5*5) / 10
})

test('mediaDaMateria ignora notas removidas', () => {
  const media = mediaDaMateria([
    nota({ id: 'a', valor: 8, maximo: 10, peso: 1 }),
    nota({ id: 'b', valor: 2, maximo: 10, peso: 1, removido: true }),
  ])
  exigeMedia(media)
  assert.ok(Math.abs(media - 8) < 1e-9)
})

test('mediaDaMateria empata no máximo mais comum e fica com a maior escala', () => {
  const media = mediaDaMateria([
    nota({ id: 'a', valor: 6, maximo: 10, peso: 1 }),
    nota({ id: 'b', valor: 600, maximo: 1000, peso: 1 }),
  ])
  exigeMedia(media)
  assert.ok(Math.abs(media - 600) < 1e-9) // proporção 0.6 na escala 1000
})

test('precisaTirar calcula a nota necessária', () => {
  const r = precisaTirar([nota({ id: 'a', valor: 5, maximo: 10, peso: 2 })], 6, 1, 10)
  assert.equal(r.possivel, true)
  assert.ok(Math.abs(r.nota - 8) < 1e-9) // (6*3 - 10) / 1
})

test('precisaTirar devolve zero quando já está passando', () => {
  const r = precisaTirar([nota({ id: 'a', valor: 10, maximo: 10, peso: 2 })], 6, 1, 10)
  assert.equal(r.possivel, true)
  assert.equal(r.nota, 0) // o cálculo daria -2
})

test('precisaTirar avisa quando a meta é impossível', () => {
  const r = precisaTirar([nota({ id: 'a', valor: 2, maximo: 10, peso: 1 })], 8, 1, 10)
  assert.equal(r.possivel, false)
  assert.ok(Math.abs(r.nota - 14) < 1e-9) // acima do máximo: avisa o número real
})

test('precisaTirar mistura a escala das notas com a da próxima prova', () => {
  const r = precisaTirar([nota({ id: 'a', valor: 8, maximo: 10, peso: 2 })], 70, 3, 100)
  assert.equal(r.possivel, true)
  assert.ok(Math.abs(r.nota - 63.333333333333336) < 1e-9) // (70*5 - 160) / 3
})

test('precisaTirar sem notas anteriores', () => {
  const r = precisaTirar([], 7, 1, 10)
  assert.equal(r.possivel, true)
  assert.ok(Math.abs(r.nota - 7) < 1e-9)
})

test('precisaTirar ignora notas removidas', () => {
  const r = precisaTirar(
    [
      nota({ id: 'a', valor: 5, maximo: 10, peso: 2 }),
      nota({ id: 'b', valor: 10, maximo: 10, peso: 2, removido: true }),
    ],
    6,
    1,
    10,
  )
  assert.equal(r.possivel, true)
  assert.ok(Math.abs(r.nota - 8) < 1e-9)
})