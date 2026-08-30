import test from 'node:test'
import assert from 'node:assert/strict'
import { criarT } from '../i18n.ts'
import { textoDoAviso } from '../textoAviso.ts'
import type { AvisoAgendado } from '../planejador.ts'
import { compromisso, materia, reiniciarIds } from './ajuda.ts'
import { instante } from '../tempo.ts'

function aviso(minutosAntes: number): AvisoAgendado {
  const vence = instante('2026-09-10', '14:00')
  return {
    chave: 'k',
    compromissoId: 'c',
    regraId: 'r',
    repeticao: 0,
    quando: new Date(vence.getTime() - minutosAntes * 60_000),
    modo: 'normal',
    vencimentoEm: vence,
  }
}

test('a distância é dita na unidade que uma pessoa usaria', () => {
  reiniciarIds()
  const t = criarT('pt')
  const mat = materia('Matemática')
  const c = compromisso('Trigonometria', { tipo: 'data', data: '2026-09-10' }, { tipo: 'prova' })

  assert.equal(textoDoAviso(aviso(0), c, mat, t).corpo, 'Vence agora · Matemática')
  assert.equal(textoDoAviso(aviso(30), c, mat, t).corpo, 'Em 30 minutos · Matemática')
  assert.equal(textoDoAviso(aviso(120), c, mat, t).corpo, 'Em 2 horas · Matemática')
  assert.equal(textoDoAviso(aviso(60 * 24), c, mat, t).corpo, 'Amanhã · Matemática')
  assert.equal(textoDoAviso(aviso(60 * 24 * 3), c, mat, t).corpo, 'Em 3 dias · Matemática')
})

test('o título diz o tipo, e sem matéria não sobra separador solto', () => {
  reiniciarIds()
  const t = criarT('pt')
  const c = compromisso('Redação', { tipo: 'data', data: '2026-09-10' }, { tipo: 'entrega' })
  const r = textoDoAviso(aviso(60 * 24 * 2), c, undefined, t)
  assert.equal(r.titulo, 'Entrega: Redação')
  assert.equal(r.corpo, 'Em 2 dias')
})

test('em inglês sai em inglês', () => {
  reiniciarIds()
  const t = criarT('en')
  const c = compromisso('Trigonometry', { tipo: 'data', data: '2026-09-10' }, { tipo: 'prova' })
  const r = textoDoAviso(aviso(60 * 24 * 3), c, materia('Math'), t)
  assert.equal(r.titulo, 'Exam: Trigonometry')
  assert.equal(r.corpo, 'In 3 days · Math')
})
