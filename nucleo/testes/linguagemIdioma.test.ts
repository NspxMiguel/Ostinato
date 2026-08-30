import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretar, interpretarMelhor } from '../linguagem.ts'

const AGORA = new Date(2026, 7, 31, 10, 0) // segunda, 31/08/2026

test('frase em português com o app em inglês ainda é entendida', () => {
  // Com uma leitura só, isto voltaria como "tarefa sem data" e o app pareceria
  // burro por um motivo que nada tem a ver com o que a pessoa escreveu.
  const soIngles = interpretar('prova de historia sexta que vem', AGORA, 'en')
  assert.ok(soIngles.confianca < 1)

  const melhor = interpretarMelhor('prova de historia sexta que vem', AGORA, 'en')
  assert.equal(melhor.tipo, 'prova')
  assert.equal(melhor.materiaNome, 'historia')
  assert.equal(melhor.vencimento?.tipo === 'data' && melhor.vencimento.data, '2026-09-11')
})

test('frase em inglês com o app em português também', () => {
  const melhor = interpretarMelhor('math test next friday', AGORA, 'pt')
  assert.equal(melhor.tipo, 'prova')
  assert.equal(melhor.materiaNome, 'math')
})

test('empate fica com o idioma da interface', () => {
  // "redacao" não tem tipo nem data em nenhum dos dois; o preferido decide.
  const pt = interpretarMelhor('redacao', AGORA, 'pt')
  const en = interpretarMelhor('redacao', AGORA, 'en')
  assert.equal(pt.confianca, en.confianca)
})

test('texto vazio não quebra', () => {
  const r = interpretarMelhor('', AGORA, 'pt')
  assert.ok(r.confianca <= 0.5)
})
