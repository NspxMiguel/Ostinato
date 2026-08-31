import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dentroDoSilencio, foraDoSilencio } from '../silencioNoturno.ts'
import { instante } from '../tempo.ts'

const DE = '22:00' as const
const ATE = '07:00' as const

test('a faixa atravessa a meia-noite nos dois lados', () => {
  assert.equal(dentroDoSilencio(instante('2026-08-30', '23:30'), DE, ATE), true)
  assert.equal(dentroDoSilencio(instante('2026-08-30', '02:00'), DE, ATE), true)
  assert.equal(dentroDoSilencio(instante('2026-08-30', '12:00'), DE, ATE), false)
})

test('as bordas: comeco entra, fim nao', () => {
  assert.equal(dentroDoSilencio(instante('2026-08-30', '22:00'), DE, ATE), true)
  assert.equal(dentroDoSilencio(instante('2026-08-30', '07:00'), DE, ATE), false)
})

test('faixa vazia nao silencia nada', () => {
  assert.equal(dentroDoSilencio(instante('2026-08-30', '03:00'), '07:00', '07:00'), false)
})

test('aviso da madrugada vai para as 7h do MESMO dia', () => {
  const r = foraDoSilencio(instante('2026-08-30', '02:00'), DE, ATE)
  assert.equal(r.getTime(), instante('2026-08-30', '07:00').getTime())
})

test('aviso da noite vai para as 7h do dia SEGUINTE', () => {
  // A armadilha da faixa que atravessa a meia-noite: as 23h, o fim e amanha.
  const r = foraDoSilencio(instante('2026-08-30', '23:00'), DE, ATE)
  assert.equal(r.getTime(), instante('2026-08-31', '07:00').getTime())
})

test('fora da faixa nao se mexe', () => {
  const q = instante('2026-08-30', '15:00')
  assert.equal(foraDoSilencio(q, DE, ATE).getTime(), q.getTime())
})
