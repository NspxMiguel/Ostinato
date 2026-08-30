import test from 'node:test'
import assert from 'node:assert/strict'
import { CONFIANCA_MINIMA, casarMateria, comApelido, normalizar, resolverMateria } from '../materias.ts'
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
