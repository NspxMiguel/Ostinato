import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  limparResposta,
  precisaDeResgateDeGrade,
  precisaDeResgateDeTarefa,
  vale,
} from '../resgate.ts'

// O caso que ele nomeou: print de computador NAO chama o modelo.
test('print bem lido nao aciona a IA, mesmo com tabela pequena', () => {
  assert.equal(precisaDeResgateDeGrade({ confianca: 0.94, aulas: 2, ignoradas: 9 }), false)
})

test('letra de mao com tabela que nao fechou aciona', () => {
  assert.equal(precisaDeResgateDeGrade({ confianca: 0.4, aulas: 1, ignoradas: 12 }), true)
})

test('letra de mao que MESMO ASSIM foi lida certa nao aciona', () => {
  // Foto ruim e resultado bom: gastar o modelo aqui so atrasa e arrisca.
  assert.equal(precisaDeResgateDeGrade({ confianca: 0.4, aulas: 20, ignoradas: 2 }), false)
})

test('nada lido aciona mesmo sem linha ignorada', () => {
  assert.equal(precisaDeResgateDeGrade({ confianca: 0.3, aulas: 0, ignoradas: 0 }), true)
})

test('tarefa curta demais nao vale resgate', () => {
  assert.equal(precisaDeResgateDeTarefa({ confianca: 0.2, texto: 'mat' }), false)
  assert.equal(precisaDeResgateDeTarefa({ confianca: 0.2, texto: 'prova de biologia' }), true)
})

test('cerca de codigo e preambulo saem da resposta', () => {
  const bruto = '```\nSeg\t08:00\t09:00\tMAT\n```'
  assert.equal(limparResposta(bruto), 'Seg\t08:00\t09:00\tMAT')
  assert.equal(limparResposta('Aqui está:\nSeg\t08:00\t09:00\tMAT'), 'Seg\t08:00\t09:00\tMAT')
})

test('empate fica com o algoritmo', () => {
  assert.equal(vale({ aulas: 5 }, { aulas: 5 }), false)
  assert.equal(vale({ aulas: 5 }, { aulas: 6 }), true)
})
