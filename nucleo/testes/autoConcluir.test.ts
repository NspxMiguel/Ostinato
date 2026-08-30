import test from 'node:test'
import assert from 'node:assert/strict'
import { provasJaFeitas } from '../autoConcluir.ts'
import { instante } from '../tempo.ts'
import { base, compromisso, materia, periodo, reiniciarIds } from './ajuda.ts'

const AGORA = instante('2026-09-10', '10:00') // quinta

test('prova de ontem vira feita sozinha', () => {
  reiniciarIds()
  const p = compromisso('Trigonometria', { tipo: 'data', data: '2026-09-09' }, { tipo: 'prova' })
  const r = provasJaFeitas(base({ compromissos: [p] }), periodo(), AGORA)
  assert.deepEqual(r.map((x) => x.titulo), ['Trigonometria'])
})

test('prova de HOJE não: pode ter sido adiada, e o dia ainda não acabou', () => {
  reiniciarIds()
  const p = compromisso('Hoje', { tipo: 'data', data: '2026-09-10', hora: '07:00' }, { tipo: 'prova' })
  assert.equal(provasJaFeitas(base({ compromissos: [p] }), periodo(), AGORA).length, 0)
})

test('tarefa e trabalho NÃO se concluem sozinhos: dá para esquecer de entregar', () => {
  reiniciarIds()
  const itens = [
    compromisso('Lista', { tipo: 'data', data: '2026-09-01' }, { tipo: 'tarefa' }),
    compromisso('Seminário', { tipo: 'data', data: '2026-09-01' }, { tipo: 'trabalho' }),
    compromisso('Redação', { tipo: 'data', data: '2026-09-01' }, { tipo: 'entrega' }),
  ]
  assert.equal(provasJaFeitas(base({ compromissos: itens }), periodo(), AGORA).length, 0)
})

test('prova já concluída à mão não aparece de novo', () => {
  reiniciarIds()
  const p = compromisso('Antiga', { tipo: 'data', data: '2026-09-01' }, { tipo: 'prova', concluido: true })
  assert.equal(provasJaFeitas(base({ compromissos: [p] }), periodo(), AGORA).length, 0)
})

test('prova ancorada na aula também conta, pela data resolvida', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const p = compromisso(
    'Prova de mat',
    { tipo: 'aula', materiaId: mat.id, ocorrencia: 1 },
    { tipo: 'prova', criadoEm: instante('2026-08-31', '08:00').getTime() },
  )
  const b = base({
    periodos: [periodo()],
    materias: [mat],
    aulas: [{ ...materia('x'), id: 'a1', materiaId: mat.id, diaSemana: 2, inicio: '07:00', fim: '07:50', semana: 'toda' } as never],
    compromissos: [p],
  })
  // A prova caiu na terça 01/09; hoje é 10/09.
  assert.equal(provasJaFeitas(b, periodo(), AGORA).length, 1)
})
