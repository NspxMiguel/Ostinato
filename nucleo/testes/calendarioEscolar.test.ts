import assert from 'node:assert/strict'
import test from 'node:test'
import { classificar, ehParaMim, seriesCitadas } from '../calendarioEscolar.ts'

// As linhas abaixo são do calendário de 2026 da escola do Miguel, copiadas do
// PDF que a escola publicou. Teste com texto inventado sempre passa; o que
// importa é o que a escola escreve de verdade.

test('assunto de funcionário fica de fora', () => {
  const fora = [
    'Retorno zeladores',
    'Início do atendimento da Secretaria e atividades administrativas',
    'Início direção coordenações',
    'Início professores do contraturno',
    'Formação para auxiliares de classe (8h30) e formação sobre segurança (vigias e recepção)',
    'Início plantão do Contraturno',
    'Reunião de planejamento — Educação Infantil, 1º, 2º e Ensino Médio',
    'Formação com professores (Bernoulli)',
  ]
  for (const linha of fora) {
    assert.equal(classificar(linha).efeito, 'interno', linha)
  }
})

test('recesso de professor é evento de funcionário e mesmo assim tira a aula', () => {
  // É a linha que prova por que a pergunta é "muda o meu dia?" e não "é sobre
  // mim?". Classificar por público mandaria isto para o lixo.
  const c = classificar('Recesso Escolar dos Professores')
  assert.equal(c.efeito, 'semAula')
  assert.equal(c.para, 'escola')
})

test('colégio fechado tira a aula mesmo falando de professores', () => {
  const c = classificar('Retorno dos professores - Colégio fechado para atendimento')
  assert.equal(c.efeito, 'semAula')
})

test('feriado e férias entram como dia sem aula', () => {
  assert.equal(classificar('Feriado — Dia Mundial da Paz').efeito, 'semAula')
  assert.equal(classificar('Férias').efeito, 'semAula')
})

test('reunião de pais é do responsável, não do aluno', () => {
  const c = classificar('Reunião de pais do 2º e Ensino Médio - 19h')
  assert.equal(c.efeito, 'presenca')
  assert.equal(ehParaMim(c, 'responsavel', ['ensino medio']), true)
  assert.equal(ehParaMim(c, 'aluno', ['ensino medio']), false)
})

test('prova chega ao aluno E ao responsável', () => {
  // O responsável não vai fazer a prova, mas precisa saber que ela existe.
  const c = classificar('Prova SAS — 3ª série')
  assert.equal(c.efeito, 'avaliacao')
  assert.equal(ehParaMim(c, 'aluno', ['3a serie']), true)
  assert.equal(ehParaMim(c, 'responsavel', ['3a serie']), true)
})

test('a série filtra a prova do ano errado', () => {
  // Era a dúvida dele: "prova SAS, mas tem do 3º ano também, e agora?"
  const minha = classificar('Prova SAS — 3ª série')
  const outra = classificar('Prova SAS — 1º ano')
  assert.equal(ehParaMim(minha, 'aluno', ['3a serie']), true)
  assert.equal(ehParaMim(outra, 'aluno', ['3a serie']), false)
})

test('linha sem série citada vale para a escola inteira', () => {
  const c = classificar('Feriado — Dia Mundial da Paz')
  assert.deepEqual(c.series, [])
  assert.equal(ehParaMim(c, 'aluno', ['3a serie']), true)
})

test('as séries são lidas nas formas que a escola escreve', () => {
  assert.ok(seriesCitadas('Início das aulas da 3ª série do Ensino Médio').includes('3a serie'))
  assert.ok(seriesCitadas('Início das aulas da 3ª série do Ensino Médio').includes('ensino medio'))
  assert.ok(seriesCitadas('Reunião de Pais do Contraturno').includes('contraturno'))
  assert.ok(seriesCitadas('Reunião de pais do 2º e Ensino Médio').includes('2a serie'))
})

test('responsável com dois filhos recebe as duas séries', () => {
  const doPrimeiro = classificar('Reunião de Pais do 1º')
  const doTerceiro = classificar('Reunião de pais da 3ª série')
  const minhas = ['1a serie', '3a serie']
  assert.equal(ehParaMim(doPrimeiro, 'responsavel', minhas), true)
  assert.equal(ehParaMim(doTerceiro, 'responsavel', minhas), true)
})

test('linha sem sinal nenhum não é adivinhada', () => {
  // Descartar calado é como o app perde a confiança de quem importou: a linha
  // fica de fora, mas classificada como "sem sinal" para a tela poder mostrar.
  const c = classificar('Muleque bom de bola')
  assert.equal(c.efeito, 'interno')
  assert.equal(c.porque, 'sem-sinal')
})
