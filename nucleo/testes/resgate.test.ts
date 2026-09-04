import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  limparResposta,
  precisaDeResgateDeFrase,
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

test('confianca alta do Vision NAO pula a IA na foto de tarefa', () => {
  // Achado em 04/09/2026: foto de um portal escolar inteiro ("Sala de Aula",
  // várias tarefas, nome do aluno, professor, tudo junto) tem confiança ALTA
  // — cada letra foi lida certo — mas a foto não é uma anotação de tarefa só.
  // Sem IA, o texto cru inteiro ia direto pro campo, viravam um bloco só, e o
  // "Salvar" não tinha o que resolver. Diferente da grade, aqui não existe
  // algoritmo fazendo de juiz, então confiança alta não pode mais pular a IA.
  assert.equal(precisaDeResgateDeTarefa({ confianca: 0.95, texto: 'prova de biologia sexta' }), true)
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

test('frase curta nao vale resgate, mesmo mal entendida', () => {
  // Aqui falta INFORMACAO, nao clareza: nao ha o que reescrever.
  assert.equal(precisaDeResgateDeFrase({ confianca: 0.2, faltando: ['data'], texto: 'mat' }), false)
})

test('fala hesitante e longa aciona', () => {
  const texto = 'ahn tipo o professor de bio passou uns exercicio pra sexta'
  assert.equal(precisaDeResgateDeFrase({ confianca: 0.3, faltando: ['materia'], texto }), true)
})

test('frase bem entendida nao aciona', () => {
  const texto = 'prova de matematica na sexta-feira'
  assert.equal(precisaDeResgateDeFrase({ confianca: 0.9, faltando: [], texto }), false)
})

test('confianca alta mas sem materia NEM titulo ainda aciona', () => {
  // O interpretador achou so a data e se apoiou nela.
  const texto = 'aquilo que a professora falou ontem para depois de amanha'
  assert.equal(
    precisaDeResgateDeFrase({ confianca: 0.8, faltando: ['materia', 'titulo'], texto }),
    true,
  )
})

// O caso que ele encontrou: horario IMPRESSO fotografado torto. O Vision le
// cada palavra perfeitamente (confianca alta) e as colunas viram sopa. A regra
// antiga, que exigia confianca baixa, deixava justamente este de fora.
test('confianca alta com ZERO aula lida ainda aciona', () => {
  assert.equal(precisaDeResgateDeGrade({ confianca: 0.97, aulas: 0, ignoradas: 30 }), true)
})

import { diaDoModeloParaApp, diaValido, horaValida } from '../resgate.ts'

test('segunda a sabado passam iguais; domingo e o unico que vira', () => {
  // O modelo responde ISO (1=segunda). O app usa o do JavaScript (0=domingo).
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(diaDoModeloParaApp), [1, 2, 3, 4, 5, 6, 0])
})

test('dia fora de 1..7 nao passa', () => {
  assert.equal(diaValido(0), false)
  assert.equal(diaValido(8), false)
  assert.equal(diaValido('2'), false)
  assert.equal(diaValido(3), true)
})

test('hora tem que ser HH:MM de 24h', () => {
  assert.equal(horaValida('8h'), false)
  assert.equal(horaValida('das 8'), false)
  assert.equal(horaValida('8:00'), false)
  assert.equal(horaValida('25:00'), false)
  assert.equal(horaValida('08:00'), true)
  assert.equal(horaValida('23:59'), true)
})

import { tabelaComoTexto } from '../resgate.ts'

test('celula vazia vira "-" para as colunas nao desalinharem', () => {
  // O erro mais caro possivel num horario e a aula certa no dia errado. Uma
  // linha com buraco no meio — o intervalo, o dia sem aula — encurtaria e
  // deslocaria tudo a partir dali.
  const t = [
    ['', 'Seg', 'Ter', 'Qua'],
    ['07:00', 'MAT', '', 'FIS'],
  ]
  assert.equal(tabelaComoTexto(t), '- | Seg | Ter | Qua\n07:00 | MAT | - | FIS')
})
