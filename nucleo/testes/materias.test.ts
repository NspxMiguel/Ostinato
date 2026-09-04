import test from 'node:test'
import assert from 'node:assert/strict'
import { CONFIANCA_MINIMA, casarMateria, comApelido, normalizar, pareceNomeDeMateria, resolverMateria } from '../materias.ts'
import { base, materia, reiniciarIds } from './ajuda.ts'

test('normalizar tira acento, caixa e pontuação', () => {
  assert.equal(normalizar('Educação Física'), 'educacao fisica')
  assert.equal(normalizar('MAT.'), 'mat')
  assert.equal(normalizar('  Português  '), 'portugues')
})

test('o nome exato ganha de tudo', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const r = casarMateria('matematica', [mat])
  assert.equal(r[0]?.confianca, 1)
  assert.equal(r[0]?.por, 'nome')
})

test('apelido casa: a escola dele chama a mesma coisa de três jeitos', () => {
  reiniciarIds()
  const inf = materia('Informática', { apelidos: ['Computação', 'TI'] })
  for (const nome of ['Computação', 'ti', 'COMPUTACAO']) {
    const r = resolverMateria(nome, base({ materias: [inf] }))
    assert.equal(r.tipo, 'achou', nome)
    if (r.tipo === 'achou') assert.equal(r.materia.nome, 'Informática')
  }
})

test('abreviação do horário casa com o nome por extenso', () => {
  reiniciarIds()
  const ef = materia('Educação Física')
  const r = resolverMateria('ED FIS', base({ materias: [ef] }))
  assert.equal(r.tipo, 'achou')

  const r2 = resolverMateria('EF', base({ materias: [ef] }))
  assert.equal(r2.tipo, 'achou')
})

test('empate no topo vira PERGUNTA, não sorteio', () => {
  reiniciarIds()
  const bio = materia('Biologia')
  const bioq = materia('Bioquímica')
  const r = resolverMateria('Bio', base({ materias: [bio, bioq] }))
  assert.equal(r.tipo, 'perguntar')
  if (r.tipo === 'perguntar') assert.deepEqual(r.candidatos.map((m) => m.nome), ['Biologia', 'Bioquímica'])
})

test('prefixo sem concorrente resolve; com concorrente, pergunta', () => {
  reiniciarIds()
  const hist = materia('História')
  assert.equal(resolverMateria('hist', base({ materias: [hist] })).tipo, 'achou')

  const geo = materia('Geografia')
  const geom = materia('Geometria')
  assert.equal(resolverMateria('geo', base({ materias: [geo, geom] })).tipo, 'perguntar')
})

test('duas letras nao bastam para decidir sozinho', () => {
  reiniciarIds()
  assert.ok(CONFIANCA_MINIMA > 0.5)
  const r = resolverMateria('ma', base({ materias: [materia('Matemática')] }))
  assert.equal(r.tipo, 'nova', 'com duas letras nao ha casamento nenhum')
})

test('nome nunca visto é matéria nova, não erro', () => {
  reiniciarIds()
  const r = resolverMateria('Filosofia', base({ materias: [materia('Matemática')] }))
  assert.equal(r.tipo, 'nova')
})

test('a resposta da pessoa vira apelido, e ela não é perguntada de novo', () => {
  reiniciarIds()
  const hist = materia('História')
  const comNovo = comApelido(hist, 'hist')
  assert.deepEqual(comNovo.apelidos, ['hist'])
  const r = resolverMateria('hist', base({ materias: [comNovo] }))
  assert.equal(r.tipo, 'achou')

  // e não duplica quando já existe
  assert.equal(comApelido(comNovo, 'HIST').apelidos.length, 1)
})

test('matéria apagada não casa', () => {
  reiniciarIds()
  const mat = materia('Matemática', { removido: true })
  assert.equal(casarMateria('matematica', [mat]).length, 0)
})

test('dicionário: "português" casa com a matéria cadastrada como "LPO"', () => {
  // Pedido em 04/09/2026: ele cadastra as matérias com a sigla que a escola
  // usa ("LPO"), e quer falar "português" na captura sem precisar decorar a
  // sigla. "lpo" não é prefixo, iniciais nem pedaço de "portugues" — só um
  // dicionário resolve.
  reiniciarIds()
  const lpo = materia('LPO')
  const r = resolverMateria('português', base({ materias: [lpo] }))
  assert.equal(r.tipo, 'achou')
  if (r.tipo === 'achou') assert.equal(r.materia.nome, 'LPO')
})

test('dicionário não atropela ambiguidade genérica: "geo" com Geografia e Geometria continua perguntando', () => {
  // Regressão que o próprio dicionário quase causou: "geo" já casa as duas
  // por prefixo com confiança igual (0.75), e é assim que a tela sabe
  // perguntar em vez de escolher sozinha. O dicionário não pode ganhar dessa
  // confiança para uma sigla que o algoritmo genérico já resolve.
  reiniciarIds()
  const geo = materia('Geografia')
  const geom = materia('Geometria')
  assert.equal(resolverMateria('geo', base({ materias: [geo, geom] })).tipo, 'perguntar')
})

test('dicionário: os outros três idiomas também têm o de matéria', () => {
  // Pedido em 04/09/2026, no mesmo dia: "faz dicionario de pelo menos umas
  // 20 linguas ai... na vdd so as q tem nosso app ne" — só os quatro que o
  // app fala, não vinte. Um caso por idioma, cobrindo sigla que não é
  // prefixo nem iniciais do nome cadastrado.
  reiniciarIds()

  const pe = materia('PE')
  const en = resolverMateria('physical education', base({ materias: [pe] }), 'en')
  assert.equal(en.tipo, 'achou')
  if (en.tipo === 'achou') assert.equal(en.materia.nome, 'PE')

  const lc = materia('LC')
  const es = resolverMateria('lengua castellana', base({ materias: [lc] }), 'es')
  assert.equal(es.tipo, 'achou')
  if (es.tipo === 'achou') assert.equal(es.materia.nome, 'LC')

  const svt = materia('SVT')
  const fr = resolverMateria('biologie', base({ materias: [svt] }), 'fr')
  assert.equal(fr.tipo, 'achou')
  if (fr.tipo === 'achou') assert.equal(fr.materia.nome, 'SVT')
})

test('dicionário de um idioma não vaza para outro', () => {
  // "svt" é sigla francesa de biologia. Sem o idioma certo, ela não pode
  // casar uma matéria em português.
  reiniciarIds()
  const bio = materia('Biologia')
  const r = resolverMateria('svt', base({ materias: [bio] }), 'pt')
  assert.equal(r.tipo, 'nova')
})

test('pareceNomeDeMateria recusa lixo de OCR de portal escolar', () => {
  // Caso real de 04/09/2026: foto do "Sala de Aula" (portal da escola) virou
  // um "nome de matéria" com cabeçalho de página, nome do aluno e "Postado
  // por" tudo grudado. O app ofereceu "Criar" isso — não devia.
  assert.equal(
    pareceNomeDeMateria(
      'Aula MIGUEL RAMTHUN MORETTI / ENSINO F... • Tarefa de Ciências Postado por Fiama Cristina Kern Kava •',
    ),
    false,
  )
  assert.equal(pareceNomeDeMateria('Biologia'), true)
  assert.equal(pareceNomeDeMateria('Educação Física'), true)
  assert.equal(pareceNomeDeMateria(''), false)
})
