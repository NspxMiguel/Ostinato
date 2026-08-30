import test from 'node:test'
import assert from 'node:assert/strict'
import { previaDeVencimento, resolverVencimento } from '../vencimento.ts'
import { dataDe, instante } from '../tempo.ts'
import { aula, base, compromisso, materia, periodo, reiniciarIds } from './ajuda.ts'

test('vencimento por data usa o fim do dia quando ninguém disse a hora', () => {
  const c = compromisso('Ler o capítulo 4', { tipo: 'data', data: '2026-09-10' })
  const r = resolverVencimento(c, base({}), undefined)
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.valor.hora, '23:59')
  assert.equal(dataDe(r.valor.quando), '2026-09-10')
})

test('vencimento por data respeita a hora escolhida', () => {
  const c = compromisso('Entregar', { tipo: 'data', data: '2026-09-10', hora: '08:00' })
  const r = resolverVencimento(c, base({}), undefined)
  assert.equal(r.ok && r.valor.hora, '08:00')
})

test('"na próxima aula de matemática" resolve contra a grade', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const p = periodo()
  const aulas = [aula(mat.id, 2, '07:00', '07:50'), aula(mat.id, 4, '13:30', '14:20')]
  // Anotado na terça 25/08 às 18h — depois da aula de terça, antes da de quinta.
  const c = compromisso(
    'Página 42',
    { tipo: 'aula', materiaId: mat.id, ocorrencia: 1 },
    { criadoEm: instante('2026-08-25', '18:00').getTime() },
  )
  const b = base({ periodos: [p], materias: [mat], aulas, compromissos: [c] })
  const r = resolverVencimento(c, b, p)
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.valor.data, '2026-08-27')
  assert.equal(r.valor.hora, '13:30')
  assert.equal(r.valor.aula?.materia?.nome, 'Matemática')
})

test('o prazo NÃO escorrega: ele fica preso ao momento em que foi anotado', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const p = periodo()
  const b0 = base({ periodos: [p], materias: [mat], aulas: [aula(mat.id, 2, '07:00', '07:50')] })
  const c = compromisso(
    'Lista de exercícios',
    { tipo: 'aula', materiaId: mat.id, ocorrencia: 1 },
    { criadoEm: instante('2026-08-24', '20:00').getTime() },
  )
  const b = { ...b0, compromissos: { [c.id]: c } }

  // Resolve igual não importa quantas semanas passem no relógio de fora.
  const primeira = resolverVencimento(c, b, p)
  const depois = resolverVencimento(c, b, p)
  assert.equal(primeira.ok && primeira.valor.data, '2026-08-25')
  assert.equal(depois.ok && depois.valor.data, '2026-08-25')
})

test('a segunda ocorrência é a aula depois da próxima', () => {
  reiniciarIds()
  const mat = materia('Física')
  const p = periodo()
  const c = compromisso(
    'Relatório',
    { tipo: 'aula', materiaId: mat.id, ocorrencia: 2 },
    { criadoEm: instante('2026-08-24', '20:00').getTime() },
  )
  const b = base({
    periodos: [p],
    materias: [mat],
    aulas: [aula(mat.id, 2, '07:00', '07:50')],
    compromissos: [c],
  })
  const r = resolverVencimento(c, b, p)
  assert.equal(r.ok && r.valor.data, '2026-09-01')
})

test('feriado empurra a próxima aula para a semana seguinte', () => {
  reiniciarIds()
  const mat = materia('História')
  const p = periodo({ feriados: ['2026-09-08'] })
  const c = compromisso(
    'Resumo',
    { tipo: 'aula', materiaId: mat.id, ocorrencia: 1 },
    { criadoEm: instante('2026-09-02', '10:00').getTime() },
  )
  const b = base({
    periodos: [p],
    materias: [mat],
    aulas: [aula(mat.id, 2, '07:00', '07:50')],
    compromissos: [c],
  })
  const r = resolverVencimento(c, b, p)
  assert.equal(r.ok && r.valor.data, '2026-09-15', 'pulou a terça do feriado')
})

test('as duas falhas são distinguidas, porque a tela precisa explicar cada uma', () => {
  reiniciarIds()
  const mat = materia('Sociologia')
  const p = periodo()

  const semAula = compromisso('Trabalho', { tipo: 'aula', materiaId: mat.id, ocorrencia: 1 })
  const b1 = base({ periodos: [p], materias: [mat], compromissos: [semAula] })
  const r1 = resolverVencimento(semAula, b1, p)
  assert.equal(r1.ok, false)
  assert.equal(!r1.ok && r1.motivo, 'materia-sem-aula')

  const tarde = compromisso(
    'Trabalho',
    { tipo: 'aula', materiaId: mat.id, ocorrencia: 1 },
    { criadoEm: instante('2027-03-01', '10:00').getTime() },
  )
  const b2 = base({
    periodos: [p],
    materias: [mat],
    aulas: [aula(mat.id, 2, '07:00', '07:50')],
    compromissos: [tarde],
  })
  const r2 = resolverVencimento(tarde, b2, p)
  assert.equal(!r2.ok && r2.motivo, 'periodo-acabou')

  const semPeriodo = resolverVencimento(semAula, b1, undefined)
  assert.equal(!semPeriodo.ok && semPeriodo.motivo, 'sem-periodo')
})

test('a prévia da tela usa o relógio de agora, não o criadoEm', () => {
  reiniciarIds()
  const mat = materia('Inglês')
  const p = periodo()
  const b = base({ periodos: [p], materias: [mat], aulas: [aula(mat.id, 3, '08:00', '08:50')] })
  const previa = previaDeVencimento(mat.id, 1, b, p, instante('2026-09-03', '09:00'))
  assert.equal(previa?.data, '2026-09-09')
})
