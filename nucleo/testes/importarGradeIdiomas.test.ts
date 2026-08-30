import test from 'node:test'
import assert from 'node:assert/strict'
import { importarGrade } from '../importarGrade.ts'

const dias = (texto: string) => importarGrade(texto).aulas.map((a) => a.diaSemana)

test('horário em espanhol', () => {
  assert.deepEqual(dias('Lun 08:00-08:50 Matematicas\nMie 08:00-08:50 Historia\nVie 10:00 Ingles'), [1, 3, 5])
  assert.deepEqual(dias('Martes 09:00-09:50 Fisica\nJueves 09:00-09:50 Quimica'), [2, 4])
})

test('horário em francês, italiano e alemão', () => {
  assert.deepEqual(dias('Lundi 08:00-09:00 Maths\nJeudi 14:00-15:00 Histoire'), [1, 4])
  assert.deepEqual(dias('Lunedi 08:00-08:50 Matematica\nMercoledi 09:00 Storia'), [1, 3])
  assert.deepEqual(dias('Montag 08:00-08:45 Mathematik\nDonnerstag 10:00 Geschichte'), [1, 4])
})

test('"mar" é terça, e não março', () => {
  // Espanhol escreve "mar" para martes. Mês num horário SEMANAL não aparece
  // abreviado, então a leitura de terça é a única útil.
  assert.deepEqual(dias('Mar 10:00-10:50 Biologia'), [2])
})

test('português e inglês continuam funcionando como antes', () => {
  assert.deepEqual(dias('Seg 07:00-07:50 Matematica\nQui 13:30-14:20 Fisica'), [1, 4])
  assert.deepEqual(dias('Mon 08:00-08:50 Math\nThu 13:30 History'), [1, 4])
  assert.deepEqual(dias('2a 07:00 Mat\n6a 07:00 Geo'), [1, 5])
})
