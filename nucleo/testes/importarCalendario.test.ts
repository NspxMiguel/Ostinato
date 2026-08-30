import assert from 'node:assert/strict'
import test from 'node:test'
import { diasDoEvento, lerCalendario } from '../importarCalendario.ts'

// O bloco abaixo é o calendário de 2026 da escola do Miguel, na forma em que ele
// sai de um PDF colado: o mês como cabeçalho, e cada linha começando pelo dia.
const JANEIRO = `
Janeiro
1 Dia Mundial da Paz
7 Retorno zeladores
12 Início do atendimento da Secretaria e atividades administrativas
19 Início direção coordenações
19 a 26 Recesso Escolar dos Professores
21 a 24 Curso de Estudos Avançados em Educação
27 Retorno dos professores - Colégio fechado para atendimento
29 Reunião de pais do 2º e Ensino Médio - 19h
Fevereiro
2 Início das aulas da 3ª série do Ensino Médio
3 Reunião de Pais do Contraturno
`

test('o mês é estado, e vale para as linhas abaixo dele', () => {
  // Nenhuma linha repete o mês; ele só aparece uma vez, como cabeçalho. Este é o
  // ponto em que uma leitura ingênua joga metade do calendário para janeiro.
  const eventos = lerCalendario(JANEIRO, 2026)
  const paz = eventos.find((e) => e.texto.includes('Paz'))
  const aulas = eventos.find((e) => e.texto.includes('Início das aulas'))
  assert.equal(paz?.inicio, '2026-01-01')
  assert.equal(aulas?.inicio, '2026-02-02')
})

test('intervalo "19 a 26" vira início e fim', () => {
  const recesso = lerCalendario(JANEIRO, 2026).find((e) => e.texto.includes('Recesso'))
  assert.equal(recesso?.inicio, '2026-01-19')
  assert.equal(recesso?.fim, '2026-01-26')
  assert.equal(diasDoEvento(recesso!).length, 8)
})

test('dia solto tem fim igual ao início', () => {
  const zelador = lerCalendario(JANEIRO, 2026).find((e) => e.texto.includes('zeladores'))
  assert.equal(zelador?.inicio, zelador?.fim)
  assert.equal(diasDoEvento(zelador!).length, 1)
})

test('cada linha já vem classificada', () => {
  const eventos = lerCalendario(JANEIRO, 2026)
  assert.equal(eventos.find((e) => e.texto.includes('Recesso'))?.efeito, 'semAula')
  assert.equal(eventos.find((e) => e.texto.includes('zeladores'))?.efeito, 'interno')
  assert.equal(eventos.find((e) => e.texto.includes('Reunião de pais'))?.efeito, 'presenca')
})

test('"Festa de julho" não é cabeçalho de mês', () => {
  // O nome do mês dentro de uma descrição não pode reposicionar o calendário
  // inteiro — foi o erro que o teste do cabeçalho existe para pegar.
  const eventos = lerCalendario('Março\n5 Festa de julho\n', 2026)
  assert.equal(eventos.length, 1)
  assert.equal(eventos[0].inicio, '2026-03-05')
})

test('linha com data própria manda no mês corrente', () => {
  const eventos = lerCalendario('Janeiro\n19/02 Reunião de pais\n20 Prova\n', 2026)
  assert.equal(eventos[0].inicio, '2026-02-19')
  // E a linha seguinte segue nesse mês, não volta para janeiro.
  assert.equal(eventos[1].inicio, '2026-02-20')
})

test('linha sem mês nenhum antes dela é ignorada, não chutada', () => {
  // Sem mês não há data, e inventar uma seria pior que perder a linha.
  assert.deepEqual(lerCalendario('7 Retorno zeladores\n', 2026), [])
})

test('o ano vem de fora', () => {
  // A folha quase nunca repete o ano, e adivinhar pelo relógio erraria em
  // dezembro, quando a escola já publicou o calendário do ano seguinte.
  const eventos = lerCalendario('Janeiro\n1 Dia Mundial da Paz\n', 2027)
  assert.equal(eventos[0].inicio, '2027-01-01')
})

test('lixo de OCR não vira evento', () => {
  const eventos = lerCalendario('Janeiro\n|||\n99 Nada\n1\n5 Prova de matemática\n', 2026)
  assert.equal(eventos.length, 1)
  assert.equal(eventos[0].efeito, 'avaliacao')
})
