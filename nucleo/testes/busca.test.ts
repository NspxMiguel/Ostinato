import test from 'node:test'
import assert from 'node:assert/strict'
import { itensParaBusca } from '../busca.ts'
import { criarT } from '../i18n.ts'
import { base, compromisso, materia, periodo, reiniciarIds } from './ajuda.ts'

const t = criarT('pt')

test('a matéria, os apelidos dela e o tipo viram palavras de busca', () => {
  reiniciarIds()
  const bio = materia('Biologia', { apelidos: ['Bio', 'Ciências'] })
  const c = compromisso('Trigonometria', { tipo: 'data', data: '2026-09-10' }, { tipo: 'prova', materiaId: bio.id })
  const itens = itensParaBusca(base({ periodos: [periodo()], materias: [bio], compromissos: [c] }), periodo(), t)

  assert.equal(itens.length, 1)
  assert.deepEqual(itens[0]?.palavras, ['Biologia', 'Bio', 'Ciências', 'Prova'])
  assert.ok((itens[0]?.venceEm ?? 0) > 0)
})

test('concluído fica de fora: o resultado velho empurraria o novo para baixo', () => {
  reiniciarIds()
  const feito = compromisso('Antiga', { tipo: 'data', data: '2026-09-01' }, { concluido: true })
  const aberta = compromisso('Nova', { tipo: 'data', data: '2026-09-10' })
  const itens = itensParaBusca(base({ compromissos: [feito, aberta] }), undefined, t)
  assert.deepEqual(itens.map((i) => i.titulo), ['Nova'])
})

test('compromisso sem data ainda entra: dá para achar e completar', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const semData = compromisso('Lista', { tipo: 'aula', materiaId: mat.id, ocorrencia: 1 })
  const itens = itensParaBusca(base({ materias: [mat], compromissos: [semData] }), undefined, t)
  assert.equal(itens.length, 1)
  assert.equal(itens[0]?.venceEm, undefined)
})
