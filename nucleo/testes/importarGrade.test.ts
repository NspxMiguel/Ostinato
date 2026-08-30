import test from 'node:test'
import assert from 'node:assert/strict'
import { importarGrade } from '../importarGrade.ts'

test('texto vazio devolve todas as coleções vazias', () => {
  assert.deepEqual(importarGrade('  \n\t'), {
    aulas: [],
    materias: [],
    ignoradas: [],
    formato: '',
  })
})

test('importa tabela com dias nas colunas separados por TAB', () => {
  const resultado = importarGrade(`\tSEG\tTER\tQUA\tQUI\tSEX
07:00\tMAT\tPORT\tHIST\tMAT\tGEO
07:50\tMAT\tPORT\tHIST\tED FIS\tGEO`)

  assert.equal(resultado.formato, 'tabela-por-dia')
  assert.equal(resultado.aulas.length, 10)
  assert.deepEqual(resultado.aulas[0], {
    materia: 'MAT',
    diaSemana: 1,
    inicio: '07:00',
    fim: '07:50',
    confianca: 0.82,
  })
  assert.equal(resultado.aulas[8]?.materia, 'ED FIS')
  assert.equal(resultado.aulas[8]?.diaSemana, 4)
  assert.deepEqual(resultado.ignoradas, [])
})

test('importa tabela separada por dois ou mais espaços e preserva matéria composta', () => {
  const resultado = importarGrade(`HORÁRIO  SEGUNDA  TERÇA  QUARTA
07h00    Língua Portuguesa  Matemática  Educação Física
0750     Geografia          Química     Artes`)

  assert.equal(resultado.aulas.length, 6)
  assert.deepEqual(
    resultado.aulas.map((aula) => [aula.diaSemana, aula.inicio, aula.fim, aula.materia]),
    [
      [1, '07:00', '07:50', 'Língua Portuguesa'],
      [2, '07:00', '07:50', 'Matemática'],
      [3, '07:00', '07:50', 'Educação Física'],
      [1, '07:50', '08:40', 'Geografia'],
      [2, '07:50', '08:40', 'Química'],
      [3, '07:50', '08:40', 'Artes'],
    ],
  )
})

test('importa dias nas linhas com várias aulas separadas por barra', () => {
  const resultado = importarGrade(`SEGUNDA: 07:00 Matemática / 07:50 Português / 08:40 História
TERÇA: 07:00 Química / 07:50 Física`)

  assert.equal(resultado.formato, 'lista-por-dia')
  assert.equal(resultado.aulas.length, 5)
  assert.deepEqual(
    resultado.aulas.map((aula) => [aula.diaSemana, aula.inicio, aula.fim, aula.materia]),
    [
      [1, '07:00', '07:50', 'Matemática'],
      [1, '07:50', '08:40', 'Português'],
      [1, '08:40', '09:30', 'História'],
      [2, '07:00', '07:50', 'Química'],
      [2, '07:50', '08:40', 'Física'],
    ],
  )
})

test('importa uma aula por linha com faixa e sala', () => {
  const resultado = importarGrade('Seg 13:30-14:20 Matemática sala 12')
  assert.deepEqual(resultado.aulas[0], {
    materia: 'Matemática',
    diaSemana: 1,
    inicio: '13:30',
    fim: '14:20',
    sala: '12',
    confianca: 0.95,
  })
  assert.equal(resultado.formato, 'aula-por-linha')
})

test('aceita matéria, sala, horário e dia em qualquer ordem', () => {
  const resultado = importarGrade('Biologia sala B-03 15h-15h50 quarta')
  assert.deepEqual(resultado.aulas[0], {
    materia: 'Biologia',
    diaSemana: 3,
    inicio: '15:00',
    fim: '15:50',
    sala: 'B-03',
    confianca: 0.95,
  })
})

test('quando só há início, estima cinquenta minutos', () => {
  const resultado = importarGrade('quarta 15h Biologia')
  assert.equal(resultado.aulas[0]?.inicio, '15:00')
  assert.equal(resultado.aulas[0]?.fim, '15:50')
  assert.equal(resultado.aulas[0]?.confianca, 0.83)
})

test('aceita faixas com às, as e diferentes grafias de hora', () => {
  const resultado = importarGrade(`seg 7:00 às 07:45 Matemática
ter 07h00 as 7h50 Português
qua 0700-0750 História`)

  assert.deepEqual(
    resultado.aulas.map((aula) => [aula.inicio, aula.fim]),
    [
      ['07:00', '07:45'],
      ['07:00', '07:50'],
      ['07:00', '07:50'],
    ],
  )
})

test('reconhece todos os dias em português, inclusive acentos e ordinais', () => {
  const resultado = importarGrade(`domingo 7h Redação
SEG 7h Matemática
terça 7h Português
quarta-feira 7h História
5a 7h Ciências
SEXTA 7h Geografia
sábado 7h Artes`)

  assert.deepEqual(
    resultado.aulas.map((aula) => aula.diaSemana),
    [0, 1, 2, 3, 4, 5, 6],
  )
})

test('reconhece todos os dias em inglês, abreviados ou completos', () => {
  const resultado = importarGrade(`sun 08:00 Writing
monday 08:00 Math
Tue 08:00 Portuguese
wednesday 08:00 History
thu 08:00 Science
Friday 08:00 Geography
saturday 08:00 Arts`)

  assert.deepEqual(
    resultado.aulas.map((aula) => aula.diaSemana),
    [0, 1, 2, 3, 4, 5, 6],
  )
})

test('aceita segunda, segunda-feira, 2a, mon e monday sem confundir caixa', () => {
  const resultado = importarGrade(`segunda 10h Álgebra
segunda-feira 11h Geometria
2a 12h Literatura
MON 13h Chemistry
monday 14h Physics`)

  assert.equal(resultado.aulas.length, 5)
  assert.ok(resultado.aulas.every((aula) => aula.diaSemana === 1))
})

test('aceita as grafias completas, abreviadas e sem acento dos sete dias', () => {
  const casos: Array<[string, number]> = [
    ['dom', 0], ['DOMINGO', 0], ['sun', 0], ['sunday', 0],
    ['seg', 1], ['SEGUNDA', 1], ['segunda-feira', 1], ['2a', 1], ['mon', 1], ['monday', 1],
    ['ter', 2], ['TERÇA', 2], ['terca', 2], ['terça-feira', 2], ['3a', 2], ['tue', 2], ['tuesday', 2],
    ['qua', 3], ['QUARTA', 3], ['quarta-feira', 3], ['4a', 3], ['wed', 3], ['wednesday', 3],
    ['qui', 4], ['QUINTA', 4], ['quinta-feira', 4], ['5a', 4], ['thu', 4], ['thursday', 4],
    ['sex', 5], ['SEXTA', 5], ['sexta-feira', 5], ['6a', 5], ['fri', 5], ['friday', 5],
    ['sáb', 6], ['SÁBADO', 6], ['sabado', 6], ['sat', 6], ['saturday', 6],
  ]
  const texto = casos.map(([dia], indice) => `${dia} 07:00 Matéria ${indice}`).join('\n')
  const resultado = importarGrade(texto)

  assert.deepEqual(
    resultado.aulas.map((aula) => aula.diaSemana),
    casos.map(([, dia]) => dia),
  )
})

test('cabeçalhos e linhas vazias somem, mas lixo verdadeiro é devolvido', () => {
  const resultado = importarGrade(`HORÁRIO ESCOLAR — TURMA 2A

Dia / Horário / Matéria
isso não parece uma aula
sex 09:10 Filosofia`)

  assert.equal(resultado.aulas.length, 1)
  assert.deepEqual(resultado.ignoradas, ['isso não parece uma aula'])
})

test('nomes equivalentes viram uma matéria e usam a grafia mais completa', () => {
  const resultado = importarGrade(`seg 07:00 MAT
ter 07:00 Mat.`)

  assert.deepEqual(resultado.materias, ['Mat.'])
  assert.deepEqual(
    resultado.aulas.map((aula) => aula.materia),
    ['Mat.', 'Mat.'],
  )
})

test('matérias únicas mantêm a ordem da primeira aparição', () => {
  const resultado = importarGrade(`seg 07:00 Química
ter 07:00 História
qua 07:00 Química
qui 07:00 Biologia`)
  assert.deepEqual(resultado.materias, ['Química', 'História', 'Biologia'])
})

test('intervalo e células vazias de tabela não viram aulas nem lixo', () => {
  const resultado = importarGrade(`SEG\tTER\tQUA
09:30\tINTERVALO\tINTERVALO\tINTERVALO
10:00\tMAT\t\tHIST`)

  assert.equal(resultado.aulas.length, 2)
  assert.deepEqual(
    resultado.aulas.map((aula) => [aula.diaSemana, aula.materia]),
    [
      [1, 'MAT'],
      [3, 'HIST'],
    ],
  )
  assert.deepEqual(resultado.ignoradas, [])
})

test('entrada estranha nunca lança exceção e fica disponível para revisão', () => {
  assert.doesNotThrow(() => importarGrade('🛸 ??? 99:99\n---'))
  const resultado = importarGrade('🛸 ??? 99:99\n---')
  assert.deepEqual(resultado.aulas, [])
  assert.deepEqual(resultado.ignoradas, ['🛸 ??? 99:99', '---'])
})
