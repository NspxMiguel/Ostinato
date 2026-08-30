import test from 'node:test'
import assert from 'node:assert/strict'
import { planejar } from '../planejador.ts'
import { ajustesPadrao } from '../modelo.ts'
import type { RegraAviso } from '../modelo.ts'
import { instante } from '../tempo.ts'
import { ajustesSimples, aula, base, compromisso, materia, periodo, reiniciarIds } from './ajuda.ts'

/** O alarme de última chance: N horas antes da PRIMEIRA aula do dia. */
const manha = (horas: number): RegraAviso => ({
  id: 'manha',
  quando: { tipo: 'antesDaPrimeiraAula', horas },
  modo: 'alarme',
})

test('ancora na primeira aula do dia, e não na aula da matéria', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const geo = materia('Geografia')
  const p = periodo()
  // Quinta 2026-09-10: geografia às 07:30, matemática às 08:00.
  const aulas = [aula(mat.id, 4, '08:00', '08:50'), aula(geo.id, 4, '07:30', '08:20')]
  const c = compromisso(
    'Lista de exercícios',
    { tipo: 'data', data: '2026-09-10', hora: '08:00' },
    { tipo: 'tarefa' },
  )
  const b = base({ periodos: [p], materias: [mat, geo], aulas, compromissos: [c] })

  const plano = planejar(b, ajustesSimples([manha(2)]), instante('2026-09-08', '10:00'), p)
  assert.equal(plano.agendar.length, 1)
  // 07:30 (geografia, a primeira) menos 2h = 05:30. Ancorar em matemática daria
  // 06:00, e uma hora antes de matemática cairia dentro da aula de geografia.
  assert.equal(plano.agendar[0]?.quando.getTime(), instante('2026-09-10', '05:30').getTime())
})

test('dia sem aula não gera alarme: acordar 5h num sábado é defeito', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const p = periodo()
  const c = compromisso('Sábado', { tipo: 'data', data: '2026-09-12' }, { tipo: 'tarefa' })
  const b = base({
    periodos: [p],
    materias: [mat],
    aulas: [aula(mat.id, 4, '08:00', '08:50')], // só quinta
    compromissos: [c],
  })
  const plano = planejar(b, ajustesSimples([manha(2)]), instante('2026-09-08', '10:00'), p)
  assert.equal(plano.agendar.length, 0)
})

test('feriado também não gera: não há primeira aula', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const p = periodo({ feriados: ['2026-09-10'] })
  const c = compromisso('No feriado', { tipo: 'data', data: '2026-09-10' }, { tipo: 'tarefa' })
  const b = base({
    periodos: [p],
    materias: [mat],
    aulas: [aula(mat.id, 4, '08:00', '08:50')],
    compromissos: [c],
  })
  assert.equal(planejar(b, ajustesSimples([manha(2)]), instante('2026-09-08', '10:00'), p).agendar.length, 0)
})

test('prova NÃO leva o alarme de última chance no padrão', () => {
  const padroes = ajustesPadrao().padroesAviso
  const temManha = (t: keyof typeof padroes) =>
    padroes[t].some((r) => r.quando.tipo === 'antesDaPrimeiraAula')

  assert.equal(temManha('prova'), false, 'não existe fazer a prova antes de sair de casa')
  for (const t of ['tarefa', 'trabalho', 'entrega', 'leitura'] as const) {
    assert.equal(temManha(t), true, t)
  }
})

test('o alarme da manhã é modo alarme, e repete', () => {
  const r = ajustesPadrao().padroesAviso.tarefa.find((x) => x.quando.tipo === 'antesDaPrimeiraAula')
  assert.equal(r?.modo, 'alarme')
  assert.ok((r?.repeticoes ?? 0) > 0)
})
