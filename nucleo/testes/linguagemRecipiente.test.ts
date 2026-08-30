import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretar } from '../linguagem.ts'

// Segunda, 31 de agosto de 2026, 10h.
const AGORA = new Date(2026, 7, 31, 10, 0)
const materiaDe = (f: string) => interpretar(f, AGORA, 'pt').materiaNome

test('palavra que embrulha a matéria não vira a matéria', () => {
  assert.equal(materiaDe('lista de exercicios de fisica pra quarta'), 'fisica')
  assert.equal(materiaDe('resumo de capitulo de biologia amanha'), 'biologia')
  assert.equal(materiaDe('atividade de portugues pra quinta'), 'portugues')
  assert.equal(materiaDe('paginas 40 a 60 de historia ate sexta'), 'historia')
})

test('mas "de" que faz parte do nome da matéria fica', () => {
  // Pegar sempre o último "de" daria "arte", e a pessoa perderia a matéria.
  assert.equal(materiaDe('trabalho de historia da arte sexta'), 'historia da arte')
  assert.equal(materiaDe('prova de lingua portuguesa amanha'), 'lingua portuguesa')
})

test('o título fica com o que sobrou, e nunca vazio', () => {
  const r = interpretar('lista de exercicios de fisica pra quarta as 8h', AGORA, 'pt')
  assert.equal(r.titulo, 'lista')
  assert.notEqual(interpretar('prova de mat sexta', AGORA, 'pt').titulo, '')
})
