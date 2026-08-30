import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dataDe,
  dataDeDias,
  diaSemanaDe,
  diasDesdeEpoca,
  diferencaEmDias,
  entre,
  horaDeMinutos,
  instante,
  minutosDaHora,
  somarDias,
} from '../tempo.ts'

test('ida e volta entre data civil e número de dias, em 8000 dias seguidos', () => {
  for (let i = 0; i < 8000; i++) {
    const iso = dataDeDias(i - 4000)
    assert.equal(diasDesdeEpoca(iso), i - 4000, iso)
  }
})

test('o dia da semana bate com o Date do sistema', () => {
  for (let i = 0; i < 3000; i++) {
    const iso = somarDias('2024-01-01', i)
    assert.equal(diaSemanaDe(iso), instante(iso).getDay(), iso)
  }
})

test('ano bissexto e virada de ano', () => {
  assert.equal(somarDias('2024-02-28', 1), '2024-02-29')
  assert.equal(somarDias('2023-02-28', 1), '2023-03-01')
  assert.equal(somarDias('2100-02-28', 1), '2100-03-01', '2100 não é bissexto')
  assert.equal(somarDias('2000-02-28', 1), '2000-02-29', '2000 é bissexto')
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01')
  assert.equal(somarDias('2027-01-01', -1), '2026-12-31')
})

test('a diferença em dias atravessa o mês sem erro', () => {
  assert.equal(diferencaEmDias('2026-08-30', '2026-09-02'), 3)
  assert.equal(diferencaEmDias('2026-09-02', '2026-08-30'), -3)
  assert.equal(diferencaEmDias('2026-01-01', '2027-01-01'), 365)
})

test('a hora aceita os formatos que aparecem num horário de escola', () => {
  assert.equal(minutosDaHora('07:00'), 420)
  assert.equal(minutosDaHora('7:00'), 420)
  assert.equal(minutosDaHora('7h'), 420)
  assert.equal(minutosDaHora('07h30'), 450)
  assert.equal(minutosDaHora('23:59'), 1439)
  assert.equal(minutosDaHora('lixo'), 0, 'entrada inválida vira meia-noite, não exceção')
})

test('minutos viram hora de volta', () => {
  assert.equal(horaDeMinutos(0), '00:00')
  assert.equal(horaDeMinutos(1439), '23:59')
  assert.equal(horaDeMinutos(-1), '23:59', 'negativo dá a volta em vez de quebrar')
})

test('o instante gerado devolve a mesma data civil de onde saiu', () => {
  for (let i = 0; i < 400; i++) {
    const iso = somarDias('2026-01-01', i)
    assert.equal(dataDe(instante(iso, '13:30')), iso)
    assert.equal(dataDe(instante(iso, '00:00')), iso)
    assert.equal(dataDe(instante(iso, '23:59')), iso)
  }
})

test('entre é inclusivo nas duas pontas', () => {
  assert.equal(entre('2026-08-03', '2026-08-03', '2026-12-18'), true)
  assert.equal(entre('2026-12-18', '2026-08-03', '2026-12-18'), true)
  assert.equal(entre('2026-08-02', '2026-08-03', '2026-12-18'), false)
  assert.equal(entre('2026-12-19', '2026-08-03', '2026-12-18'), false)
})
