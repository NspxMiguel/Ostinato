import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ehAssuntoDeHoje } from '../hoje.ts'
import { instante } from '../tempo.ts'

const AGORA = instante('2026-08-30', '23:43')

test('vence amanha: E assunto de hoje', () => {
  // O caso dele: "e para amanha, mas tenho q fazer hoje a tarefa".
  assert.equal(ehAssuntoDeHoje({ quando: instante('2026-08-31', '23:59') }, AGORA), true)
})

test('vence hoje entra', () => {
  assert.equal(ehAssuntoDeHoje({ quando: instante('2026-08-30', '23:59') }, AGORA), true)
})

test('atrasado entra', () => {
  assert.equal(ehAssuntoDeHoje({ quando: instante('2026-08-29', '23:59') }, AGORA), true)
})

test('depois de amanha NAO entra: isso e a Agenda', () => {
  assert.equal(ehAssuntoDeHoje({ quando: instante('2026-09-01', '23:59') }, AGORA), false)
})

test('vence longe mas AVISA hoje entra', () => {
  // Prova de sexta com alarme marcado para esta noite.
  assert.equal(
    ehAssuntoDeHoje(
      { quando: instante('2026-09-04', '08:00'), proximoAviso: instante('2026-08-30', '23:50') },
      AGORA,
    ),
    true,
  )
})

test('o aviso ja tocado nao segura o item sozinho', () => {
  // Era o defeito: o aviso de 1 dia antes disparou as 20:00, entao as 23:43 o
  // proximo aviso ja e de amanha. Antes, isso tirava o item da tela. Agora quem
  // segura e o vencimento de amanha, e o aviso passado nao muda nada.
  assert.equal(
    ehAssuntoDeHoje(
      { quando: instante('2026-09-05', '23:59'), proximoAviso: instante('2026-09-04', '20:00') },
      AGORA,
    ),
    false,
  )
})

test('sem data resolvida nao entra por aqui', () => {
  assert.equal(ehAssuntoDeHoje({ quando: null }, AGORA), false)
})

import { estaAtrasado } from '../hoje.ts'

test('vence amanha ainda NAO esta atrasado', () => {
  assert.equal(estaAtrasado(instante('2026-08-31', '23:59'), AGORA), false)
})

test('depois da meia-noite, a mesma tarefa fica atrasada', () => {
  // O dia da entrega comecou: a hora de fazer era a noite anterior.
  const depoisDaMeiaNoite = instante('2026-08-31', '00:01')
  assert.equal(estaAtrasado(instante('2026-08-31', '23:59'), depoisDaMeiaNoite), true)
})

test('passou da hora exata tambem conta', () => {
  assert.equal(estaAtrasado(instante('2026-08-30', '20:00'), AGORA), true)
})
