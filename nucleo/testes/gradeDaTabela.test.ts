import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aulasDaTabela, horasDaCelula } from '../gradeDaTabela.ts'

// A grade abaixo e a SAIDA REAL do Vision na foto do horario dele, medida com
// `ferramentas/sonda-vision.swift`. Ela esta aqui como FORMA, nao como gabarito:
// o que os testes cobram e o comportamento geral — cabecalho em qualquer linha,
// coluna de horario em qualquer posicao, celula vazia, dia em outro idioma.
// Calibrar para esta escola quebraria o app na escola de todo mundo, e ele
// avisou isso: *"o app n é só pra mim, pq eu vou postar o app dps"*.
const DELE = [
  ['', 'HORÁRIO: 9° ano A 2026', '', '', '', ''],
  ['', 'SEG', 'TER', 'QUA', 'QUI', 'SEX'],
  ['07:25-08:00', 'ERE', 'ALE', 'LPO', 'ING', 'MAT'],
  ['08:00 - 08:45', 'Culto', 'ALE', 'LPO', 'ING', 'MAT'],
  ['08:45 - 09:30', 'LIV', 'FIS', 'ALE', 'ART/PE', 'LPO'],
]

test('le a grade sem modelo nenhum', () => {
  const aulas = aulasDaTabela(DELE)
  assert.equal(aulas.length, 15, '3 linhas de horario x 5 dias')
  const primeira = aulas[0]!
  assert.equal(primeira.diaSemana, 1)
  assert.equal(primeira.inicio, '07:25')
  assert.equal(primeira.fim, '08:00')
  assert.equal(primeira.materia, 'ERE')
})

test('o titulo acima do cabecalho nao vira aula', () => {
  // A primeira linha tem texto e nenhuma hora: e ignorada por nao ter horario.
  assert.equal(aulasDaTabela(DELE).some((a) => a.materia.includes('HORÁRIO')), false)
})

test('cabecalho em qualquer linha, e coluna de horario no FIM', () => {
  const t = [
    ['Mon', 'Tue', 'Time'],
    ['MATH', 'PHYS', '08:00 - 09:00'],
  ]
  const aulas = aulasDaTabela(t)
  assert.deepEqual(
    aulas.map((a) => [a.diaSemana, a.materia]),
    [[1, 'MATH'], [2, 'PHYS']],
  )
})

test('celula vazia e traco nao viram aula', () => {
  const t = [
    ['', 'SEG', 'TER'],
    ['07:00 - 08:00', '', '—'],
  ]
  assert.deepEqual(aulasDaTabela(t), [])
})

test('sem dois dias reconheciveis, devolve vazio e o modelo assume', () => {
  // "Seguranca do trabalho" comeca com "seg" e NAO e segunda-feira.
  const t = [['Seguranca do trabalho'], ['07:00 - 08:00', 'X']]
  assert.deepEqual(aulasDaTabela(t), [])
})

test('hora escrita de varios jeitos', () => {
  assert.deepEqual(horasDaCelula('07:25-08:00'), { inicio: '07:25', fim: '08:00' })
  assert.deepEqual(horasDaCelula('7h25 às 8h00'), { inicio: '07:25', fim: '08:00' })
  assert.equal(horasDaCelula('07:25'), null, 'uma hora so nao define aula')
  assert.equal(horasDaCelula('LPO'), null)
})

import { tabelaDoTexto } from '../resgate.ts'

test('texto colado com | volta a ser tabela', () => {
  const t = tabelaDoTexto('- | SEG | TER\n07:25 - 08:00 | ERE | ALE')
  assert.deepEqual(t, [['', 'SEG', 'TER'], ['07:25 - 08:00', 'ERE', 'ALE']])
  assert.equal(aulasDaTabela(t).length, 2)
})

test('frase solta com uma barra NAO vira tabela', () => {
  assert.deepEqual(tabelaDoTexto('prova de mat | sexta'), [])
})
