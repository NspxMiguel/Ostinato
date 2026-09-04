import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretar } from '../linguagem.ts'
import { instante } from '../tempo.ts'

const AGORA = instante('2026-08-31', '10:00')

test('prova de matemática na sexta da semana seguinte', () => {
  const resultado = interpretar('prova de matematica sexta que vem', AGORA, 'pt')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'matematica')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-11' })
  assert.equal(resultado.titulo, 'Prova de matematica')
})

test('sexta sem modificador é a ocorrência mais próxima', () => {
  const resultado = interpretar('prova de mat sexta', AGORA, 'pt')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'mat')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-04' })
})

test('trabalho para amanhã', () => {
  const resultado = interpretar('trabalho de historia pra amanha', AGORA, 'pt')
  assert.equal(resultado.tipo, 'trabalho')
  assert.equal(resultado.materiaNome, 'historia')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-01' })
})

test('dia do mês que já passou avança para o mês seguinte', () => {
  const resultado = interpretar('entregar redacao dia 12', AGORA, 'pt')
  assert.equal(resultado.tipo, 'entrega')
  assert.equal(resultado.titulo, 'redacao')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-12' })
})

test('leitura preserva páginas e intervalo no título', () => {
  const resultado = interpretar('ler paginas 40 a 60 ate quinta', AGORA, 'pt')
  assert.equal(resultado.tipo, 'leitura')
  assert.equal(resultado.titulo, 'paginas 40 a 60')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-03' })
})

test('próxima aula vira vencimento relativo à grade', () => {
  const resultado = interpretar('tarefa de mat pra proxima aula', AGORA, 'pt')
  assert.equal(resultado.tipo, 'tarefa')
  assert.equal(resultado.materiaNome, 'mat')
  assert.deepEqual(resultado.vencimento, { tipo: 'aula', ocorrencia: 1 })
})

test('data numérica e hora com h', () => {
  const resultado = interpretar('prova de quimica dia 15/09 as 7h', AGORA, 'pt')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'quimica')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-15', hora: '07:00' })
})

test('prazo relativo em dias atravessa o mês', () => {
  const resultado = interpretar('trabalho de biologia em 3 dias', AGORA, 'pt')
  assert.equal(resultado.tipo, 'trabalho')
  assert.equal(resultado.materiaNome, 'biologia')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-03' })
})

test('texto livre vira título e informa os campos ausentes', () => {
  const resultado = interpretar('redacao', AGORA, 'pt')
  assert.equal(resultado.titulo, 'redacao')
  assert.equal(resultado.tipo, undefined)
  assert.deepEqual(resultado.faltando, ['data', 'materia'])
})

test('semana que vem encontra data mas ainda pede matéria', () => {
  const resultado = interpretar('prova semana que vem', AGORA, 'pt')
  assert.equal(resultado.tipo, 'prova')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-07' })
  assert.ok(resultado.faltando.includes('materia'))
  assert.equal(resultado.confianca, 0.75)
})

test('prova em inglês extrai a matéria antes do tipo', () => {
  const resultado = interpretar('math test next friday', AGORA, 'en')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'math')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-11' })
  assert.equal(resultado.titulo, 'Math test')
})

test('essay continua trabalho mesmo com due na frase', () => {
  const resultado = interpretar('history essay due tomorrow', AGORA, 'en')
  assert.equal(resultado.tipo, 'trabalho')
  assert.equal(resultado.materiaNome, 'history')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-01' })
})

test('leitura em inglês preserva o intervalo de páginas', () => {
  const resultado = interpretar('read pages 40-60 by thursday', AGORA, 'en')
  assert.equal(resultado.tipo, 'leitura')
  assert.equal(resultado.titulo, 'pages 40-60')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-03' })
})

test('mês por nome e hora am em inglês', () => {
  const resultado = interpretar('chemistry exam on sep 15 at 7am', AGORA, 'en')
  assert.equal(resultado.tipo, 'prova')
  assert.equal(resultado.materiaNome, 'chemistry')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-15', hora: '07:00' })
})

test('assignment due é tratado como entrega', () => {
  const resultado = interpretar('assignment due in 3 days', AGORA, 'en')
  assert.equal(resultado.tipo, 'entrega')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-03' })
})

test('hoje conserva a data civil de agora', () => {
  const resultado = interpretar('tarefa de fisica pra hoje', AGORA, 'pt')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-08-31' })
})

test('depois de amanhã soma dois dias civis', () => {
  const resultado = interpretar('seminario de artes depois de amanha', AGORA, 'pt')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-02' })
})

test('próxima segunda soma uma semana mesmo quando hoje é segunda', () => {
  const resultado = interpretar('teste de ingles proxima segunda', AGORA, 'pt')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-07' })
})

test('dia da semana sem próximo pode ser o próprio dia', () => {
  const resultado = interpretar('teste de ingles segunda', AGORA, 'pt')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-08-31' })
})

test('data completa mantém o ano explícito', () => {
  const resultado = interpretar('apresentacao de geografia dia 15/09/2027', AGORA, 'pt')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2027-09-15' })
})

test('hora em formato de relógio é normalizada', () => {
  const resultado = interpretar('prova de musica dia 02/09 as 7:30', AGORA, 'pt')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-02', hora: '07:30' })
})

test('hora pm em inglês vira relógio de 24 horas', () => {
  const resultado = interpretar('biology test on sep 2 at 7:30pm', AGORA, 'en')
  assert.deepEqual(resultado.vencimento, { tipo: 'data', data: '2026-09-02', hora: '19:30' })
})

test('next class em inglês vira vencimento de aula', () => {
  const resultado = interpretar('homework for next class', AGORA, 'en')
  assert.equal(resultado.tipo, 'tarefa')
  assert.deepEqual(resultado.vencimento, { tipo: 'aula', ocorrencia: 1 })
})

test('frase vazia devolve título seguro e confiança mínima', () => {
  const resultado = interpretar('   ', AGORA, 'pt')
  assert.equal(resultado.titulo, 'Compromisso')
  assert.equal(resultado.confianca, 0.1)
  assert.deepEqual(resultado.faltando, ['data', 'materia'])
})

test('confiança é máxima com tipo, matéria e data', () => {
  const resultado = interpretar('prova de matematica amanha', AGORA, 'pt')
  assert.equal(resultado.confianca, 1)
  assert.deepEqual(resultado.faltando, [])
})

test('marcas apontam para os trechos exatos do texto original', () => {
  const frase = 'prova de quimica dia 15/09 as 7h'
  const resultado = interpretar(frase, AGORA, 'pt')
  const trechos = resultado.marcas.map((marca) => [marca.papel, frase.slice(marca.de, marca.ate)])
  assert.deepEqual(trechos, [
    ['tipo', 'prova'],
    ['materia', 'quimica'],
    ['data', 'dia 15/09'],
    ['hora', 'as 7h'],
  ])
})

test('entrada estranha nunca lança nem devolve título vazio', () => {
  assert.doesNotThrow(() => interpretar('!!! 999/99 às 99h ???', AGORA, 'pt'))
  assert.notEqual(interpretar('!!! 999/99 às 99h ???', AGORA, 'pt').titulo, '')
})

test('o nome da matéria termina onde começa o complemento', () => {
  // Aconteceu no iPhone dele em 30/08/2026: ditou "tarefa de química no
  // caderno" e o app criou uma MATÉRIA chamada "química no caderno". O estrago
  // é permanente — a matéria fica na lista para sempre.
  const r = interpretar('tarefa de química no caderno', new Date('2026-08-31T08:00:00'), 'pt')
  assert.equal(r.materiaNome, 'química')

  const f = interpretar('tarefa de física na folha', new Date('2026-08-31T08:00:00'), 'pt')
  assert.equal(f.materiaNome, 'física')

  const p = interpretar('leitura de biologia páginas 40 a 60', new Date('2026-08-31T08:00:00'), 'pt')
  assert.equal(p.materiaNome, 'biologia')

  // "num"/"numa" (em+um/uma) faltava na lista: "português num post it" virava
  // matéria "português num post it" em vez de parar em "português". Achado no
  // iPhone dele em 04/09/2026.
  const n = interpretar('tarefa de português num post it', new Date('2026-09-04T08:00:00'), 'pt')
  assert.equal(n.materiaNome, 'português')
})

test('"questões" é tarefa, mesmo com "páginas" (que sozinho seria leitura)', () => {
  // Achado no iPhone dele em 04/09/2026: "Biologia — todas as questões
  // páginas 14 a 19" saiu como tipo Leitura, porque "questoes" não estava
  // na lista de palavras de tarefa e só sobrou "paginas" pra decidir.
  const r = interpretar(
    'Biologia — todas as questões páginas 14 a 19',
    new Date('2026-09-04T08:00:00'),
    'pt',
  )
  assert.equal(r.tipo, 'tarefa')
})

test('"de/da/do" continuam dentro do nome da matéria', () => {
  // O corte não pode comer nome legítimo: "história da arte" é uma matéria.
  const r = interpretar('prova de história da arte', new Date('2026-08-31T08:00:00'), 'pt')
  assert.equal(r.materiaNome, 'história da arte')
})
