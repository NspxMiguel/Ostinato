import test from 'node:test'
import assert from 'node:assert/strict'
import { JANELA, LIMITE_IOS, MAX_POR_COMPROMISSO, diferenca, planejar } from '../planejador.ts'
import { ajustesPadrao } from '../modelo.ts'
import type { RegraAviso } from '../modelo.ts'
import { instante } from '../tempo.ts'
import { ajustesSimples, base, compromisso, materia, periodo, regraDias, reiniciarIds, aula } from './ajuda.ts'

const AGORA = instante('2026-09-01', '08:00')

test('a janela deixa 4 de reserva abaixo do teto do iOS', () => {
  assert.equal(LIMITE_IOS, 64)
  assert.equal(JANELA, 60)
})

test('uma regra de "3 dias antes às 20h" cai no dia e hora certos', () => {
  const c = compromisso('Prova de história', { tipo: 'data', data: '2026-09-10', hora: '07:00' })
  const plano = planejar(
    base({ compromissos: [c] }),
    ajustesSimples([regraDias('r', 3, '20:00')]),
    AGORA,
    undefined,
  )
  assert.equal(plano.agendar.length, 1)
  const a = plano.agendar[0]
  assert.equal(a?.quando.getTime(), instante('2026-09-07', '20:00').getTime())
})

test('"2 horas antes" é relativo à hora exata do vencimento', () => {
  const c = compromisso('Entrega', { tipo: 'data', data: '2026-09-10', hora: '14:00' })
  const regra: RegraAviso = { id: 'r', quando: { tipo: 'antesDe', minutos: 120 }, modo: 'normal' }
  const plano = planejar(base({ compromissos: [c] }), ajustesSimples([regra]), AGORA, undefined)
  assert.equal(plano.agendar[0]?.quando.getTime(), instante('2026-09-10', '12:00').getTime())
})

test('aviso que já passou não é agendado', () => {
  const c = compromisso('Prova', { tipo: 'data', data: '2026-09-02', hora: '07:00' })
  const plano = planejar(
    base({ compromissos: [c] }),
    ajustesSimples([regraDias('longe', 30, '20:00'), regraDias('perto', 1, '20:00')]),
    AGORA,
    undefined,
  )
  assert.deepEqual(plano.agendar.map((a) => a.regraId), ['perto'])
})

test('compromisso concluído e prazo já vencido não geram aviso', () => {
  const feito = compromisso('Feito', { tipo: 'data', data: '2026-09-20' }, { concluido: true })
  const vencido = compromisso('Vencido', { tipo: 'data', data: '2026-08-01' })
  const plano = planejar(
    base({ compromissos: [feito, vencido] }),
    ajustesSimples([regraDias('r', 1)]),
    AGORA,
    undefined,
  )
  assert.equal(plano.agendar.length, 0)
})

test('a repetição gera uma notificação por disparo, e para no prazo', () => {
  const c = compromisso('Prova', { tipo: 'data', data: '2026-09-10', hora: '14:00' })
  const regra: RegraAviso = {
    id: 'alarme',
    quando: { tipo: 'antesDe', minutos: 30 },
    modo: 'alarme',
    repetirCada: 10,
    repeticoes: 10,
  }
  const plano = planejar(base({ compromissos: [c] }), ajustesSimples([regra]), AGORA, undefined)
  // 13:30, 13:40, 13:50, 14:00 — a de 14:10 passaria do prazo.
  assert.deepEqual(
    plano.agendar.map((a) => a.quando.getHours() * 60 + a.quando.getMinutes()),
    [13 * 60 + 30, 13 * 60 + 40, 13 * 60 + 50, 14 * 60],
  )
})

test('um compromisso sozinho não come a janela inteira', () => {
  const c = compromisso('Prova', { tipo: 'data', data: '2026-09-10', hora: '14:00' })
  const regra: RegraAviso = {
    id: 'insistente',
    quando: { tipo: 'antesDe', minutos: 600 },
    modo: 'insistente',
    repetirCada: 1,
    repeticoes: 500,
  }
  const plano = planejar(base({ compromissos: [c] }), ajustesSimples([regra]), AGORA, undefined)
  assert.equal(plano.agendar.length, MAX_POR_COMPROMISSO)
  assert.deepEqual(plano.limitados, [c.id])
})

test('com mais avisos do que cabem, sobram os 60 MAIS PRÓXIMOS — não uma lista qualquer', () => {
  reiniciarIds()
  const compromissos = []
  for (let i = 0; i < 40; i++) {
    compromissos.push(
      compromisso(`Tarefa ${i}`, { tipo: 'data', data: `2026-10-${String((i % 28) + 1).padStart(2, '0')}` }),
    )
  }
  const plano = planejar(
    base({ compromissos }),
    ajustesSimples([regraDias('a', 5, '08:00'), regraDias('b', 3, '08:00'), regraDias('c', 1, '08:00')]),
    AGORA,
    undefined,
  )

  assert.equal(plano.agendar.length, 60, 'exatamente a janela')
  assert.equal(plano.cortados, 120 - 60, 'e o resto contado, não sumido')

  // Prova de que são os mais próximos: o mais tardio agendado vem antes de
  // qualquer um que ficou de fora.
  const ordenado = [...plano.agendar].sort((x, y) => x.quando.getTime() - y.quando.getTime())
  assert.deepEqual(plano.agendar.map((a) => a.chave), ordenado.map((a) => a.chave))
})

test('compromisso cujo vencimento não resolve é reportado, não descartado calado', () => {
  reiniciarIds()
  const mat = materia('Espanhol')
  const c = compromisso('Trabalho', { tipo: 'aula', materiaId: mat.id, ocorrencia: 1 })
  const plano = planejar(
    base({ periodos: [periodo()], materias: [mat], compromissos: [c] }),
    ajustesPadrao(),
    AGORA,
    periodo(),
  )
  assert.deepEqual(plano.semData, [c.id])
  assert.equal(plano.agendar.length, 0)
})

test('o plano é determinístico: a mesma base sempre dá as mesmas chaves', () => {
  reiniciarIds()
  const mat = materia('Matemática')
  const p = periodo()
  const compromissos = [
    compromisso('A', { tipo: 'aula', materiaId: mat.id, ocorrencia: 1 }),
    compromisso('B', { tipo: 'data', data: '2026-09-15' }),
  ]
  const b = base({
    periodos: [p],
    materias: [mat],
    aulas: [aula(mat.id, 2, '07:00', '07:50')],
    compromissos,
  })
  const um = planejar(b, ajustesPadrao(), AGORA, p).agendar.map((a) => a.chave)
  const dois = planejar(b, ajustesPadrao(), AGORA, p).agendar.map((a) => a.chave)
  assert.deepEqual(um, dois)
})

test('a diferença só mexe no que mudou', () => {
  const c = compromisso('Prova', { tipo: 'data', data: '2026-09-10' })
  const plano = planejar(
    base({ compromissos: [c] }),
    ajustesSimples([regraDias('a', 5), regraDias('b', 2)]),
    AGORA,
    undefined,
  ).agendar

  const nada = diferenca(plano.map((a) => a.chave), plano)
  assert.equal(nada.criar.length, 0)
  assert.equal(nada.cancelar.length, 0)

  const parcial = diferenca([plano[0]!.chave, 'velha|regra|0'], plano)
  assert.deepEqual(parcial.criar.map((a) => a.chave), [plano[1]!.chave])
  assert.deepEqual(parcial.cancelar, ['velha|regra|0'])
})

test('nenhum aviso é agendado dentro de uma aula', () => {
  // O módulo `silencioEmAula` existia e NÃO estava ligado aqui — escrito,
  // testado e sem efeito nenhum no app. Este teste é o que impede isso de
  // voltar: ele falha se o planejador parar de consultar a grade.
  reiniciarIds()
  const per = periodo({ inicio: '2026-08-01', fim: '2026-12-20' })
  const mat = materia('matemática', { periodoId: per.id })
  // Segunda, 07:15–08:00. O aviso de 30 minutos antes das 07:45 cairia dentro.
  const a = aula(mat.id, 1, '07:15', '08:00')
  const c = compromisso(
    'lista',
    { tipo: 'data', data: '2026-09-07', hora: '07:45' },
    {
      materiaId: mat.id,
      avisos: [{ id: 'x', quando: { tipo: 'antesDe', minutos: 30 }, modo: 'alarme' }],
    },
  )
  const b = base({ periodos: [per], materias: [mat], aulas: [a], compromissos: [c] })

  const plano = planejar(b, ajustesSimples(), new Date('2026-09-01T06:00:00'), per)
  for (const aviso of plano.agendar.filter((x) => x.compromissoId === c.id)) {
    const min = aviso.quando.getHours() * 60 + aviso.quando.getMinutes()
    const dentro = aviso.quando.getDay() === 1 && min >= 7 * 60 + 15 && min < 8 * 60
    assert.equal(dentro, false, `avisou às ${aviso.quando.toISOString()}, dentro da aula`)
  }
})

test('a faixa de silencio empurra o aviso, e nao o apaga', () => {
  // O pedido dele: nada toca de madrugada, nem alarme. Mas EMPURRAR, nunca
  // descartar — sumir com um aviso porque ele calhou numa hora ruim e a pessoa
  // perde a prova.
  reiniciarIds()
  const p = periodo({ inicio: '2026-08-01', fim: '2026-12-20' })
  const m = materia('mat', { periodoId: p.id })
  const c = compromisso(
    'lista de exercicios',
    { tipo: 'data', data: '2026-09-10', hora: '23:59' },
    {
      materiaId: m.id,
      tipo: 'tarefa',
      avisos: [{ id: 'x', quando: { tipo: 'antesDe', minutos: 60 }, modo: 'alarme' }],
    },
  )
  const b = base({ periodos: [p], materias: [m], compromissos: [c] })

  const plano = planejar(b, ajustesSimples(), instante('2026-09-01', '08:00'), p)
  const meus = plano.agendar.filter((a) => a.compromissoId === c.id)
  assert.equal(meus.length, 1, 'o aviso continua existindo')
  // 22:59 cai dentro de 22:00-07:00, entao vai para as 07:00 do dia seguinte.
  assert.equal(meus[0]!.quando.getTime(), instante('2026-09-11', '07:00').getTime())
})
