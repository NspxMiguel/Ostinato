import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aulaValeNaData,
  aulasDoDia,
  ocorrenciasDeAula,
  periodoAtivo,
  proximasAulasDaMateria,
  semanaDoPeriodo,
  totalDeAulasNoPeriodo,
} from '../grade.ts'
import { instante } from '../tempo.ts'
import { aula, base, materia, periodo, reiniciarIds } from './ajuda.ts'

// 2026-08-03 é uma segunda-feira. O período de teste vai daí até 18/12/2026.

test('a semana do período começa em 1 e conta a partir do domingo', () => {
  const p = periodo()
  assert.equal(semanaDoPeriodo(p, '2026-08-03'), 1, 'a segunda do início é a semana 1')
  assert.equal(semanaDoPeriodo(p, '2026-08-07'), 1, 'a sexta da mesma semana também')
  assert.equal(semanaDoPeriodo(p, '2026-08-10'), 2)
  assert.equal(semanaDoPeriodo(p, '2026-08-17'), 3)
})

test('a aula só vale no dia da semana dela, dentro do período', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const a = aula(mat.id, 2, '07:00', '07:50') // terça
  const p = periodo()
  assert.equal(aulaValeNaData(a, p, '2026-08-04'), true, 'terça dentro do período')
  assert.equal(aulaValeNaData(a, p, '2026-08-05'), false, 'quarta não')
  assert.equal(aulaValeNaData(a, p, '2026-07-28'), false, 'terça antes do período')
  assert.equal(aulaValeNaData(a, p, '2026-12-22'), false, 'terça depois do período')
})

test('feriado apaga a aula daquele dia', () => {
  reiniciarIds()
  const mat = materia('História')
  const a = aula(mat.id, 3, '09:00', '09:50') // quarta
  const p = periodo({ feriados: ['2026-09-09'] })
  assert.equal(aulaValeNaData(a, p, '2026-09-02'), true)
  assert.equal(aulaValeNaData(a, p, '2026-09-09'), false, 'feriado')
  assert.equal(aulaValeNaData(a, p, '2026-09-16'), true)
})

test('semana par e ímpar alternam, e inverter troca as duas', () => {
  reiniciarIds()
  const mat = materia('Química')
  const soPar = aula(mat.id, 1, '07:00', '07:50', { semana: 'par' }) // segunda
  const p = periodo()
  assert.equal(aulaValeNaData(soPar, p, '2026-08-03'), false, 'semana 1 é ímpar')
  assert.equal(aulaValeNaData(soPar, p, '2026-08-10'), true, 'semana 2 é par')
  assert.equal(aulaValeNaData(soPar, p, '2026-08-17'), false)
  assert.equal(aulaValeNaData(soPar, p, '2026-08-03', true), true, 'invertido')
  assert.equal(aulaValeNaData(soPar, p, '2026-08-10', true), false)
})

test('as ocorrências de uma aula pulam feriado e param no fim do período', () => {
  reiniciarIds()
  const mat = materia('Geografia')
  const a = aula(mat.id, 5, '10:00', '10:50') // sexta
  const p = periodo({ inicio: '2026-08-03', fim: '2026-08-31', feriados: ['2026-08-14'] })
  const dias = ocorrenciasDeAula(a, p, '2026-08-01', '2026-09-30')
  assert.deepEqual(dias, ['2026-08-07', '2026-08-21', '2026-08-28'])
})

test('as aulas do dia saem na ordem do relógio', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const port = materia('Português')
  const b = base({
    periodos: [periodo()],
    materias: [mat, port],
    aulas: [
      aula(port.id, 2, '09:00', '09:50'),
      aula(mat.id, 2, '07:00', '07:50'),
      aula(mat.id, 4, '07:00', '07:50'),
    ],
  })
  const doDia = aulasDoDia(b, periodo(), '2026-08-04') // terça
  assert.deepEqual(
    doDia.map((x) => [x.materia?.nome, x.aula.inicio]),
    [
      ['Matemática', '07:00'],
      ['Português', '09:00'],
    ],
  )
})

test('a próxima aula é a próxima no relógio, não no calendário', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const b = base({
    periodos: [periodo()],
    materias: [mat],
    aulas: [aula(mat.id, 2, '07:00', '07:50'), aula(mat.id, 4, '13:30', '14:20')],
  })
  const p = periodo()

  // Terça, 10h: a aula das 7h de hoje já passou; a próxima é a de quinta.
  const depois = proximasAulasDaMateria(mat.id, b, p, instante('2026-08-04', '10:00'), 3)
  assert.deepEqual(
    depois.map((x) => `${x.data} ${x.aula.inicio}`),
    ['2026-08-06 13:30', '2026-08-11 07:00', '2026-08-13 13:30'],
  )

  // Terça, 6h: a de hoje ainda não aconteceu.
  const antes = proximasAulasDaMateria(mat.id, b, p, instante('2026-08-04', '06:00'), 1)
  assert.equal(`${antes[0]?.data} ${antes[0]?.aula.inicio}`, '2026-08-04 07:00')
})

test('duas aulas da mesma matéria no mesmo dia saem na ordem certa', () => {
  reiniciarIds()
  const mat = materia('Educação Física')
  const b = base({
    periodos: [periodo()],
    materias: [mat],
    aulas: [aula(mat.id, 3, '10:00', '10:50'), aula(mat.id, 3, '09:00', '09:50')],
  })
  const r = proximasAulasDaMateria(mat.id, b, periodo(), instante('2026-08-04', '23:00'), 2)
  assert.deepEqual(
    r.map((x) => `${x.data} ${x.aula.inicio}`),
    ['2026-08-05 09:00', '2026-08-05 10:00'],
  )
})

test('matéria sem aula, e período já vencido, devolvem lista vazia sem quebrar', () => {
  reiniciarIds()
  const mat = materia('Filosofia')
  const b = base({ periodos: [periodo()], materias: [mat], aulas: [] })
  assert.equal(proximasAulasDaMateria(mat.id, b, periodo(), instante('2026-08-04'), 3).length, 0)

  const comAula = base({
    periodos: [periodo()],
    materias: [mat],
    aulas: [aula(mat.id, 1, '07:00', '07:50')],
  })
  const depoisDoFim = proximasAulasDaMateria(
    mat.id,
    comAula,
    periodo(),
    instante('2027-01-05', '08:00'),
    3,
  )
  assert.equal(depoisDoFim.length, 0)
})

test('a busca atravessa um mês inteiro de feriados sem desistir', () => {
  reiniciarIds()
  const mat = materia('Artes')
  const feriados: string[] = []
  for (let i = 0; i < 60; i++) {
    const d = new Date(2026, 7, 3 + i)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    feriados.push(`${d.getFullYear()}-${mm}-${dd}`)
  }
  const p = periodo({ feriados })
  const b = base({ periodos: [p], materias: [mat], aulas: [aula(mat.id, 1, '07:00', '07:50')] })
  const r = proximasAulasDaMateria(mat.id, b, p, instante('2026-08-03', '00:00'), 1)
  assert.equal(r.length, 1, 'achou a primeira segunda depois dos 60 dias de feriado')
  assert.equal(r[0]?.data, '2026-10-05')
})

test('o total de aulas do período alimenta o cálculo de faltas', () => {
  reiniciarIds()
  const mat = materia('Biologia')
  const p = periodo({ inicio: '2026-08-03', fim: '2026-08-31' })
  const b = base({
    periodos: [p],
    materias: [mat],
    aulas: [aula(mat.id, 1, '07:00', '07:50'), aula(mat.id, 3, '07:00', '07:50')],
  })
  assert.equal(totalDeAulasNoPeriodo(mat.id, b, p), 5 + 4)
})

test('o período ativo é o que contém hoje', () => {
  const passado = periodo({ id: 'p1', nome: '1º', inicio: '2026-02-01', fim: '2026-06-30', ativo: false })
  const atual = periodo({ id: 'p2', nome: '2º', inicio: '2026-08-03', fim: '2026-12-18', ativo: false })
  const b = base({ periodos: [passado, atual] })
  assert.equal(periodoAtivo(b, '2026-09-10')?.id, 'p2')
  assert.equal(periodoAtivo(b, '2026-03-10')?.id, 'p1')
  assert.equal(periodoAtivo(b, '2026-07-10')?.id, 'p1', 'fora de período cai no primeiro')
})
