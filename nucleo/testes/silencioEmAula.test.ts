import assert from 'node:assert/strict'
import test from 'node:test'
import { foraDeAula, type Janela } from '../silencioEmAula.ts'

const em = (h: string) => new Date(`2026-08-31T${h}:00`)
const janela = (de: string, ate: string): Janela => ({ de: em(de), ate: em(ate) })

// O caso dele: aula às 07:15 e aula de matemática às 09:00. Um alarme de tarefa
// de matemática marcado para 07:00 tocaria ANTES da primeira aula — livre. Um
// marcado para 07:30 cairia dentro da aula de geografia, e para quem está lá
// dentro isso é igual a tocar na aula de matemática.
const MANHA = [janela('07:15', '08:00'), janela('08:00', '08:45'), janela('09:00', '09:45')]

test('antes da primeira aula continua valendo', () => {
  assert.equal(foraDeAula(em('07:00'), MANHA).getTime(), em('07:00').getTime())
})

test('dentro de uma aula isolada, empurra para o fim dela', () => {
  // 09:00–09:45 não tem aula colada depois, então o fim dela já é livre.
  assert.equal(foraDeAula(em('09:20'), MANHA).getTime(), em('09:45').getTime())
})

test('aulas coladas formam um bloco: empurra até o fim do bloco', () => {
  // 07:15–08:00 e 08:00–08:45 são contínuas. Sair no fim da primeira cairia no
  // começo da segunda, e a pessoa continua sem olhar o telefone.
  assert.equal(foraDeAula(em('07:20'), MANHA).getTime(), em('08:45').getTime())
})

test('o intervalo entre aulas é livre', () => {
  // 08:45 até 09:00 é intervalo: é exatamente quando dá para avisar.
  assert.equal(foraDeAula(em('08:50'), MANHA).getTime(), em('08:50').getTime())
})

test('o fim da última aula libera', () => {
  assert.equal(foraDeAula(em('09:30'), MANHA).getTime(), em('09:45').getTime())
})

test('sem aula nenhuma, nada é empurrado', () => {
  assert.equal(foraDeAula(em('07:30'), []).getTime(), em('07:30').getTime())
})

test('o aviso nunca é descartado, só adiado', () => {
  // A falha mais grave possível seria sumir com o aviso por ele cair numa hora
  // ruim: a pessoa confia que vai ser avisada.
  for (const h of ['07:00', '07:30', '08:44', '09:44', '23:00']) {
    const r = foraDeAula(em(h), MANHA)
    assert.ok(r instanceof Date && !Number.isNaN(r.getTime()), h)
    assert.ok(r.getTime() >= em(h).getTime(), h)
  }
})

test('dado estranho não trava o laço', () => {
  // Uma aula que "termina" antes de começar não pode girar para sempre.
  const quebrada = [{ de: em('10:00'), ate: em('09:00') }]
  const r = foraDeAula(em('09:30'), quebrada)
  assert.ok(r instanceof Date)
})
