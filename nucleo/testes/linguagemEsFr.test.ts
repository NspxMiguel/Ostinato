import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretar, interpretarMelhor } from '../linguagem.ts'
import { instante } from '../tempo.ts'

const AGORA = instante('2026-08-31', '10:00')

test('exame em espanhol reconhece matéria e a sexta mais próxima', () => {
  const resultado = interpretar('examen de matematicas el viernes', AGORA, 'es')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'matematicas')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-04' })
})

test('próxima sexta em espanhol fica na semana seguinte', () => {
  const resultado = interpretar('examen de historia el proximo viernes', AGORA, 'es')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'historia')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-11' })
})

test('amanhã em espanhol soma um dia', () => {
  const resultado = interpretar('trabajo de historia para manana', AGORA, 'es')
  assert.equal(resultado.tipo, 'trabalho')
  assert.equal(resultado.materiaNome, 'historia')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-01' })
})

test('dia do mês em espanhol avança para o próximo mês possível', () => {
  const resultado = interpretar('entregar redaccion el dia 12', AGORA, 'es')
  assert.equal(resultado.tipo, 'entrega')
  assert.equal(resultado.titulo, 'redaccion')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-12' })
})

test('leitura em espanhol preserva o intervalo de páginas', () => {
  const resultado = interpretar('leer paginas 40 a 60 hasta el jueves', AGORA, 'es')
  assert.equal(resultado.tipo, 'leitura')
  assert.equal(resultado.titulo, 'paginas 40 a 60')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-03' })
})

test('próxima aula em espanhol vira vencimento relativo', () => {
  const resultado = interpretar('tarea de mate para la proxima clase', AGORA, 'es')
  assert.equal(resultado.tipo, 'tarefa')
  assert.equal(resultado.materiaNome, 'mate')
  assert.deepEqual(resultado.vencimento, { tipo: 'aula', ocorrencia: 1 })
})

test('data numérica e hora em espanhol são normalizadas', () => {
  const resultado = interpretar('examen de quimica el 15/09 a las 7h', AGORA, 'es')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'quimica')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-15', hora: '07:00' })
})

test('prazo relativo em espanhol atravessa o mês', () => {
  const resultado = interpretar('trabajo de biologia en 3 dias', AGORA, 'es')
  assert.equal(resultado.tipo, 'trabalho')
  assert.equal(resultado.materiaNome, 'biologia')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-03' })
})

test('detecção automática entende espanhol com acentos e preserva a matéria', () => {
  const resultado = interpretarMelhor('proyecto de español para mañana', AGORA, 'en')
  assert.equal(resultado.tipo, 'trabalho')
  assert.equal(resultado.materiaNome, 'español')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-01' })
})

test('controle em francês reconhece matéria e a sexta mais próxima', () => {
  const resultado = interpretar('controle de maths vendredi', AGORA, 'fr')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'maths')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-04' })
})

test('dever em francês reconhece matéria depois de apóstrofo', () => {
  const resultado = interpretar("devoir d'histoire pour demain", AGORA, 'fr')
  assert.equal(resultado.tipo, 'trabalho')
  assert.equal(resultado.materiaNome, 'histoire')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-01' })
})

test('leitura em francês preserva o intervalo de páginas', () => {
  const resultado = interpretar('lire les pages 40 a 60 pour jeudi', AGORA, 'fr')
  assert.equal(resultado.tipo, 'leitura')
  assert.equal(resultado.titulo, 'pages 40 a 60')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-03' })
})

test('dia do mês em francês avança para o próximo mês possível', () => {
  const resultado = interpretar('rendre la redaction le 12', AGORA, 'fr')
  assert.equal(resultado.tipo, 'entrega')
  assert.equal(resultado.titulo, 'redaction')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-12' })
})

test('próximo curso em francês vira vencimento relativo', () => {
  const resultado = interpretar('exercice de maths pour le prochain cours', AGORA, 'fr')
  assert.equal(resultado.tipo, 'tarefa')
  assert.equal(resultado.materiaNome, 'maths')
  assert.deepEqual(resultado.vencimento, { tipo: 'aula', ocorrencia: 1 })
})

test('data numérica e hora em francês são normalizadas', () => {
  const resultado = interpretar('controle de chimie le 15/09 a 7h', AGORA, 'fr')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'chimie')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-15', hora: '07:00' })
})

test('prazo relativo em francês atravessa o mês', () => {
  const resultado = interpretar('devoir de biologie dans 3 jours', AGORA, 'fr')
  assert.equal(resultado.tipo, 'trabalho')
  assert.equal(resultado.materiaNome, 'biologie')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-03' })
})

test('próxima sexta em francês preserva acento na matéria', () => {
  const resultado = interpretar('contrôle de français vendredi prochain', AGORA, 'fr')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'français')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-11' })
})

test('detecção automática entende francês com artigo e acentos', () => {
  const resultado = interpretarMelhor('devoir de la philosophie pour après-demain', AGORA, 'en')
  assert.equal(resultado.tipo, 'trabalho')
  assert.equal(resultado.materiaNome, 'philosophie')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-02' })
})
