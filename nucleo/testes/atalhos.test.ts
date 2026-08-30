import test from 'node:test'
import assert from 'node:assert/strict'


import { lerAtalho } from '../atalhos.ts'

test('reconhece anotar com e sem texto', () => {
  assert.deepEqual(lerAtalho('ostinato://anotar?texto=prova de mat sexta'), {
    tipo: 'anotar',
    texto: 'prova de mat sexta',
  })
  assert.deepEqual(lerAtalho('ostinato://anotar'), { tipo: 'anotar' })
  assert.deepEqual(lerAtalho('ostinato://anotar?text=math test'), {
    tipo: 'anotar',
    texto: 'math test',
  })
})

test('reconhece abrir por id, e recusa sem id', () => {
  assert.deepEqual(lerAtalho('ostinato://abrir?id=abc'), { tipo: 'abrir', id: 'abc' })
  assert.equal(lerAtalho('ostinato://abrir'), null)
})

test('entrada estranha nunca lança e nunca vira comando', () => {
  for (const ruim of [null, '', 'não é url', 'ostinato://', 'ostinato://apagarTudo', 'https://exemplo.com']) {
    assert.equal(lerAtalho(ruim), null, String(ruim))
  }
})
