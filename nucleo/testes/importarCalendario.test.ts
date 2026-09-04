import assert from 'node:assert/strict'
import test from 'node:test'
import { ehParaMim } from '../calendarioEscolar.ts'
import { diasDoEvento, lerCalendario } from '../importarCalendario.ts'

// O bloco abaixo é o calendário de 2026 da escola do Miguel, na forma em que ele
// sai de um PDF colado: o mês como cabeçalho, e cada linha começando pelo dia.
const JANEIRO = `
Janeiro
1 Dia Mundial da Paz
7 Retorno zeladores
12 Início do atendimento da Secretaria e atividades administrativas
19 Início direção coordenações
19 a 26 Recesso Escolar dos Professores
21 a 24 Curso de Estudos Avançados em Educação
27 Retorno dos professores - Colégio fechado para atendimento
29 Reunião de pais do 2º e Ensino Médio - 19h
Fevereiro
2 Início das aulas da 3ª série do Ensino Médio
3 Reunião de Pais do Contraturno
`

test('o mês é estado, e vale para as linhas abaixo dele', () => {
  // Nenhuma linha repete o mês; ele só aparece uma vez, como cabeçalho. Este é o
  // ponto em que uma leitura ingênua joga metade do calendário para janeiro.
  const eventos = lerCalendario(JANEIRO, 2026)
  const paz = eventos.find((e) => e.texto.includes('Paz'))
  const aulas = eventos.find((e) => e.texto.includes('Início das aulas'))
  assert.equal(paz?.inicio, '2026-01-01')
  assert.equal(aulas?.inicio, '2026-02-02')
})

test('intervalo "19 a 26" vira início e fim', () => {
  const recesso = lerCalendario(JANEIRO, 2026).find((e) => e.texto.includes('Recesso'))
  assert.equal(recesso?.inicio, '2026-01-19')
  assert.equal(recesso?.fim, '2026-01-26')
  assert.equal(diasDoEvento(recesso!).length, 8)
})

test('dia solto tem fim igual ao início', () => {
  const zelador = lerCalendario(JANEIRO, 2026).find((e) => e.texto.includes('zeladores'))
  assert.equal(zelador?.inicio, zelador?.fim)
  assert.equal(diasDoEvento(zelador!).length, 1)
})

test('cada linha já vem classificada', () => {
  const eventos = lerCalendario(JANEIRO, 2026)
  assert.equal(eventos.find((e) => e.texto.includes('Recesso'))?.efeito, 'semAula')
  assert.equal(eventos.find((e) => e.texto.includes('zeladores'))?.efeito, 'interno')
  assert.equal(eventos.find((e) => e.texto.includes('Reunião de pais'))?.efeito, 'presenca')
})

test('"Festa de julho" não é cabeçalho de mês', () => {
  // O nome do mês dentro de uma descrição não pode reposicionar o calendário
  // inteiro — foi o erro que o teste do cabeçalho existe para pegar.
  const eventos = lerCalendario('Março\n5 Festa de julho\n', 2026)
  assert.equal(eventos.length, 1)
  assert.equal(eventos[0]!.inicio, '2026-03-05')
})

test('linha com data própria manda no mês corrente', () => {
  const eventos = lerCalendario('Janeiro\n19/02 Reunião de pais\n20 Prova\n', 2026)
  assert.equal(eventos[0]!.inicio, '2026-02-19')
  // E a linha seguinte segue nesse mês, não volta para janeiro.
  assert.equal(eventos[1]!.inicio, '2026-02-20')
})

test('linha sem mês nenhum antes dela é ignorada, não chutada', () => {
  // Sem mês não há data, e inventar uma seria pior que perder a linha.
  assert.deepEqual(lerCalendario('7 Retorno zeladores\n', 2026), [])
})

test('o ano vem de fora', () => {
  // A folha quase nunca repete o ano, e adivinhar pelo relógio erraria em
  // dezembro, quando a escola já publicou o calendário do ano seguinte.
  const eventos = lerCalendario('Janeiro\n1 Dia Mundial da Paz\n', 2027)
  assert.equal(eventos[0]!.inicio, '2027-01-01')
})

test('lixo de OCR não vira evento', () => {
  const eventos = lerCalendario('Janeiro\n|||\n99 Nada\n1\n5 Prova de matemática\n', 2026)
  assert.equal(eventos.length, 1)
  assert.equal(eventos[0]!.efeito, 'avaliacao')
})

// As linhas abaixo são recortes EXATOS do que sai ao copiar o PDF do calendário
// de 2026 da escola dele. O PDF imprime a gradinha do mês ao lado dos eventos,
// então a cópia mistura as duas coisas na mesma linha — e é aqui que uma leitura
// que pega o PRIMEIRO número joga o evento para o dia errado.
const COMO_O_PDF_COPIA = `
JANEIRO - 2(3ª série)
Dom Seg Ter Qua Qui Sex Sáb
1 2 3 1 Dia Mundial da Paz
4 5 6 7 8 9 10 12 13 14 15 16 17 11 18 25 7 Retorno zeladores
19 20 21 22 23 24 19 Início direção/coordenações
19 a 26 Recesso Escolar dos Professores
FEVEREIRO - 18 (F2/EM) e 17 (F1) Dom Seg Ter Qua Qui Sex Sáb 2 Início das aulas da 3ª série do Ensino Médio
9 a 13 16 Avaliação diagnóstica Bernoulli - 1º ao 5º ano
Semana de Avaliação Diagnóstica SAS
MARÇO - 22 dias Letivos
16 a 18 98º Seminário de Diretores e Assembleia Geral da Rede Sinodal
30 31 21 1ª ed. Simulado ENEM do Terceirão - 8h às 13h (1°dia)
`

test('o dia é o último número antes do texto, não o primeiro', () => {
  const ev = lerCalendario(COMO_O_PDF_COPIA, 2026)
  const zelador = ev.find((e) => e.texto.includes('zeladores'))
  // A linha começa em "4 5 6 7 8 9 10 12 …" e o evento é do dia 7.
  assert.equal(zelador?.inicio, '2026-01-07')
  assert.equal(ev.find((e) => e.texto.includes('Dia Mundial'))?.inicio, '2026-01-01')
})

test('cabeçalho de mês com sujeira ainda é cabeçalho, e o evento colado nele entra', () => {
  const ev = lerCalendario(COMO_O_PDF_COPIA, 2026)
  const aulas = ev.find((e) => e.texto.includes('Início das aulas da 3ª série'))
  assert.equal(aulas?.inicio, '2026-02-02')
})

test('intervalo só conta quando o conectivo está entre os dois últimos números', () => {
  const ev = lerCalendario(COMO_O_PDF_COPIA, 2026)
  // "9 a 13" é gradinha; o dia da avaliação é o 16.
  const av = ev.find((e) => e.texto.includes('Avaliação diagnóstica'))
  assert.equal(av?.inicio, '2026-02-16')
  assert.equal(av?.fim, '2026-02-16')
  // Aqui sim é intervalo de verdade.
  const recesso = ev.find((e) => e.texto.includes('Recesso Escolar dos Professores'))
  assert.equal(recesso?.inicio, '2026-01-19')
  assert.equal(recesso?.fim, '2026-01-26')
})

test('número ordinal do título não vira dia', () => {
  const ev = lerCalendario(COMO_O_PDF_COPIA, 2026)
  // "16 a 18 98º Seminário": o 98º é do título, o intervalo é 16–18.
  const sem = ev.find((e) => e.texto.includes('Seminário'))
  assert.equal(sem?.inicio, '2026-03-16')
  assert.equal(sem?.fim, '2026-03-18')
  // "30 31 21 1ª ed. Simulado": o 1ª é do título, o dia é 21.
  assert.equal(ev.find((e) => e.texto.includes('Simulado'))?.inicio, '2026-03-21')
})

test('linha sem dia continua no dia anterior', () => {
  const ev = lerCalendario(COMO_O_PDF_COPIA, 2026)
  // "Semana de Avaliação Diagnóstica SAS" vem sem número, logo abaixo do dia 16.
  assert.equal(ev.find((e) => e.texto.includes('Semana de Avaliação'))?.inicio, '2026-02-16')
})

test('um mes inteiro, do texto cru ate quem ve cada linha', () => {
  // Teste de PONTA A PONTA, e nao das pecas: `lerCalendario` e `ehParaMim` sao
  // corretos separados e e a costura deles que decide o que aparece na tela.
  // Cada linha aqui existe por um motivo diferente.
  const texto = [
    'Setembro',
    '7 Feriado Independencia',
    '12 Reuniao pedagogica sem aula',
    '15 a 19 Semana de provas 3o ano',
    '22 Jogos internos',
    '30 Conselho de classe professores',
  ].join('\n')

  const lidos = lerCalendario(texto, 2026)
  assert.equal(lidos.length, 5, 'nenhuma linha se perde')

  const paraMim = lidos.filter((e) => ehParaMim(e, 'aluno', ['3a serie']))
  assert.deepEqual(
    paraMim.map((e) => e.texto),
    [
      'Feriado Independencia',
      'Reuniao pedagogica sem aula',
      'Semana de provas 3o ano',
      'Jogos internos',
    ],
    'o conselho de classe fica de fora; o resto passa',
  )

  // O intervalo "15 a 19" vira faixa, e nao um dia solto.
  const provas = lidos.find((e) => e.texto.includes('provas'))!
  assert.equal(provas.inicio, '2026-09-15')
  assert.equal(provas.fim, '2026-09-19')

  // "Reuniao pedagogica SEM AULA" fecha a escola, mesmo sendo reuniao de
  // professor: o efeito manda, e no dia o aluno nao tem aula.
  assert.equal(lidos.find((e) => e.texto.includes('Reuniao'))!.efeito, 'semAula')
})

// O bloco abaixo é o calendário 2026 do Colégio Doutor de verdade, extraído do
// PDF que ele anexou (`XLSX_215585_2026_01_21_17_14_12.pdf`) — os mesmos
// eventos, um por linha. O extrator real de PDF devolve o texto de cada mês
// como um parágrafo só, com a gradinha do calendário embutida entre os
// eventos; o recorte `COMO_O_PDF_COPIA` acima já prova que `lerCalendario`
// atravessa essa gradinha linha a linha. Aqui o objetivo é outro: provar que,
// com o mês inteiro — os ~150 eventos reais, não uma amostra —, os marcos que
// importam para um aluno saem certos e o ruído administrativo desaparece.
const CALENDARIO_DOUTOR_2026 = `
JANEIRO - 2(3ª série)
1 Dia Mundial da Paz
7 Retorno zeladores
12 Início do atendimento da Secretaria e atividades administrativas
19 Início direção/coordenações
19 Início professores do contraturno
19 Formação para auxiliares de classe - 8h30 e formação sobre segurança - vigias e recepção - dia todo
20 Início plantão do Contraturno
21 a 24 Curso de Estudos Avançados em Educação RSE - São Leopoldo/RS
19 a 26 Recesso Escolar dos Professores
27 Retiro com todos os colaboradores. Retorno dos professores. Colégio fechado para atendimento.
28 Formação com professores Bernoulli- F1- 7h30 às 11h30
28 Formação de 1ºs socorros - Educ. Infantil, F2, EM e Administrativo - 07h30 às 11h30
29 Reunião de planejamento - Educação Infantil, F1, F2 e Ensino Médio
29 Reunião de pais do F2 e Ensino Médio - 19h
30 Formação com professores Bernoulli-Educ. Infantil e F1-Implantação. 7h30 às 11h30
30 Formação com F2 e EM - Gestão de Sala de Aula - 07h30
FEVEREIRO - 18 (F2/EM) e 17 (F1)
2 Início das aulas da 3ª série do Ensino Médio
2 8h - Palestra LIV: O que escola e saúde têm em comum? - professores de todos os segmentos
2 Reunião de Pais do F1 - 19h
3 Reunião de Pais do Contraturno (18h) e Educação Infantil (19h15)
4 Início das aulas do F2 (6º ao 9º ano) e Ensino Médio (1ª e 2ª série)
5 Início das aulas da Educação Infantil e do F1 (1º ao 5º ano)
9 a 13 Avaliação diagnóstica Bernoulli - 1º ao 5º ano
16 Semana de Avaliação Diagnóstica SAS (6º ao 3ão)
MARÇO - 22 dias Letivos
9 e 10 Fachleitertagung - Encontro de professores de Alemão no Colégio Cruzeiro em Jacarépagua
9 e 10 Reunião de Regentes de Conjuntos Instrumentais e Corais - Colégio Pastor Dohms - Porto Alegre/RS
10 Reunião Pedagógica -EI-F1-F2 e EM
16 a 18 98º Seminário de Diretores e Assembleia Geral da Rede Sinodal - Porto Alegre
21 1ª ed. Simulado ENEM do Terceirão - 8h às 13h (1°dia)
28 1ª ed. Simulado ENEM do Terceirão - 8h às 13h (2°dia)
ABRIL - 18 dias Letivos
2 Quinta-feira Santa - Recesso Escolar - Não tem aula - Plantão no Contraturno
3 Feriado - 6ª feira Santa
6 Feriado Municipal
10 e 11 31º Encontro Nacional de Lideranças Estudantis da Rede Sinodal - Pomerode/SC
14 Reunião Pedagógica -EI-F1-F2 e EM
21 Feriado Nacional
24 e 25 Encontro Nacional de Professores de Língua Portuguesa - Jaraguá do Sul/SC - CEJ
25 Simulado ENEM do Terceirão - 7h30 às 13h
28 Onase Regional RSE: Basquete Sub 15 e Xadrez Masc/Fem
MAIO - 20 Dias Letivos
1 Feriado Nacional - Dia do Trabalho
4 a 12 Avaliação periódica Bernoulli - 4ºs e 5ºs anos
4 a 8 Moleque Bom de Bola - Fase Municipal
6 Homenagem Mães - F1 - 18h (turmas vespertinas) e 19h (turmas matutinas)
7 Homenagem Mães - 19h - Educação Infantil
7 a 10 Olimpíada SAS - on-line (6º à 2ª série)
9 2ª ed. Simulado SAS ENEM do Terceirão - 8h às 13h (1° dia)
16 Festa Escolar - dia letivo
15 e 16 Encontro Nacional de Equipes Administrativas da Rede Sinodal - Joinville/SC
18 2ª ed. Simulado SAS ENEM do Terceirão - 7h15 às 12h45 (2° dia)
18 a 22 1ª Sistemática SAS - (6º à 2ª série)
21 Conselho de classe EI, F1, F2 e EM - 1º trimestre - não tem aula - Plantão Contraturno
21 a 24 32º Encontro de Liderança Jovem - CECREI - São Leopoldo/RS
22 Início do 2º trimestre
23 Sprachcamp DSD I - Witmarsum (PR) - 1ª e 2ª série EM - Grupo Sprachdiplom
30 3ª ed. Simulado SAS ENEM do Terceirão - 8h00 às 13h (1° dia)
JUNHO - 21 dias Letivos
1 Simulado SAS ENEM (1ª e 2ª Série) - 7h15 às 12h - Dia 1
2 Acendimento da Tocha da 48ª edição dos Jogos Estudantis
4 Feriado Corpus Christi
5 Recesso escolar - Não tem aula - Plantão no Contraturno
5 e 6 Encontro de Liderança Jovem da RSE - Lajeado/RS
9 Reunião Pedagógica -EI-F1-F2 e EM
13 Festa Junina - 14h às 18h
15 Simulado SAS ENEM (1ª e 2ª Série) - 7h15 às 12h - Dia 2
20 a 08/07 48ª Edição dos Jogos Estudantis
22 Abertura da 48ª edição dos Jogos Estudantis
JULHO - 14 dias Letivos
11 Mostra Interna
17 Dia do vovô e do vovó: Educação Infantil
13 a 17 SALVA DOUTOR e Jogos Internos Ensino Médio
20 a 22 XXXV Congresso Nacional de Educação da Rede Sinodal - Santa Cruz do Sul/RS
20 a 31 Recesso Escolar - Plantão no Contraturno
AGOSTO - 21 dias Letivos
3 Início do 2º semestre
5 Homenagem pais F1 - 18h (Turmas vespertinas) e 19h (turmas matutinas)
6 Homenagem pais Educação Infantil - 19h
10 e 11 99º Seminário de Diretores (com representantes de mantenedoras) - Instituto Rio Branco - São Leopoldo/RS
11 Dia do Estudante - Reunião pedagógica EI-F1-F2 e EM
12 a 18 Avaliação periódica Bernoulli - 4ºs e 5ºs anos
15 4ª ed. Simulado SAS ENEM do Terceirão - 8h às 13h (1° dia)
15 Formação para auxiliares de classe - 8h
18 DSD II - Prova escrita - Alunos da 3ª série EM - Grupo Sprachdiplom
19 DSD I - Prova escrita - Alunos da 1ª e 2ª série EM - Grupo Sprachdiplom
22 Seminário Endomarketing
24 4ª ed. Simulado SAS ENEM do Terceirão - 7h15 às 12h (2° dia)
28 DSD II - Prova oral - Alunos da 3ª série EM - Grupo Sprachdiplom
SETEMBRO - 20 dias Letivos
03 e 04 DSD I - Prova oral - 1ª e 2ª série EM - presença da professora Jordana (Bonja)
7 Desfile Cívico Escolar
08 a 11 Jogos Internos do Fundamental 2
8 Início do 3º trimestre
12 5ª ed. Simulado SAS ENEM do Terceirão - 8h às 13h (1° dia)
15 Conselho de classe EI, F1, F2 e EM - 2º trimestre - não tem aula - Plantão Contraturno
19 5ª ed. Simulado SAS ENEM do Terceirão - 8h às 13h (2° dia)
24 e 25 Seminário Regional de Diretores e Encontro regional de Eq. Pedagógicas - Rio do Sul/SC
OUTUBRO - 20 dias Letivos
01 a 03 60ª ONASE - (Atletismo e Xadrez) - Colégio Teutônia/RS
2 Encontro Regional de Dança da Rede Sinodal - Blumenau
7 6ª ed. Simulado SAS ENEM do Terceirão - 7h15 às 12h (1° dia)
12 Feriado Nacional
13 Recesso Escolar - Dia do Professor - não haverá aula e nem Plantão
17 6ª ed. Simulado SAS ENEM do Terceirão - 8h às 13h (2° dia)
19 a 23 Semana da Língua Inglesa
23 INTESI - Evento de Teatro da Rede Sinodal - Brusque - Colégio Cônsul
21 a 27 Avaliação processual - Bernoulli - 4ºs e 5ºs anos
26 Reunião de Regentes Conjuntos Instrumentais e Corais - São Leopoldo/RS
27 a 31 Semana da Reforma Luterana
31 Dia da Reforma Luterana - Feriado Municipal
NOVEMBRO - 19 dias Letivos
2 Feriado Nacional - Finados
03 a 06 3ª Sistemática SAS - (6º ao 9º ano)
03 a 06 2ª Sistemática SAS - (1ª e 2ª)
13 Último dia de aula normal do Terceirão
16 Assembleia Extraordinária da Rede Sinodal de Educação
20 Feriado Nacional Dia Nacional do Zumbi e da Consciência Negra
23 Culto de Advento - 1°s, 2°s e 3°s anos
26 Encerramento Educação Infantil - Teatro Municipal
27 Cerimonial de entrega de certificados Ensino Médio - 18h30 Teatro Municipal
DEZEMBRO - 07(F2/EM) 08(F1) dias Letivos
3 Conselho de classe EI, F1, F2 e EM - 18h
9 Último dia de aula do F2 e EM
10 Último dia de aula F1
11 Último dia de aula do EI
15 Conselho de classe final F1, F2 e EM
17 Último dia do plantão do Contraturno até 17h
17 Encerramento das atividades na escola e encerramento dos colaboradores (19h)
18 Compensação de horas - Colégio fechado
21 Início das férias dos professores e colaboradores
`

test('calendário real: os feriados nacionais e municipais entram como semAula', () => {
  const eventos = lerCalendario(CALENDARIO_DOUTOR_2026, 2026)
  const feriados = [
    ['2026-04-03', 'feira Santa'],
    ['2026-04-06', 'Feriado Municipal'],
    ['2026-04-21', 'Feriado Nacional'],
    ['2026-05-01', 'Dia do Trabalho'],
    ['2026-06-04', 'Corpus Christi'],
    ['2026-10-12', 'Feriado Nacional'],
    ['2026-10-31', 'Reforma Luterana'],
    ['2026-11-02', 'Finados'],
    ['2026-11-20', 'Consciência Negra'],
  ] as const
  for (const [data, pedaco] of feriados) {
    const ev = eventos.find((e) => e.texto.includes(pedaco) && e.inicio === data)
    assert.ok(ev, `feriado "${pedaco}" não achado em ${data}`)
    assert.equal(ev!.efeito, 'semAula', `"${pedaco}" deveria ser semAula`)
  }
})

test('calendário real: início dos trimestres e do 2º semestre são marcos, não ruído', () => {
  const eventos = lerCalendario(CALENDARIO_DOUTOR_2026, 2026)
  const segundoTri = eventos.find((e) => e.texto.includes('Início do 2º trimestre'))
  const terceiroTri = eventos.find((e) => e.texto.includes('Início do 3º trimestre'))
  const segundoSem = eventos.find((e) => e.texto.includes('Início do 2º semestre'))
  assert.equal(segundoTri?.inicio, '2026-05-22')
  assert.equal(segundoTri?.efeito, 'inicioPeriodoLetivo')
  assert.equal(terceiroTri?.inicio, '2026-09-08')
  assert.equal(terceiroTri?.efeito, 'inicioPeriodoLetivo')
  assert.equal(segundoSem?.inicio, '2026-08-03')
  assert.equal(segundoSem?.efeito, 'inicioPeriodoLetivo')

  // Nenhum dos três é restrito a uma série: são data da escola inteira, e a
  // leitura ingênua de "2º"/"3º" como série já causou esse bug uma vez.
  for (const e of [segundoTri, terceiroTri, segundoSem]) assert.deepEqual(e!.series, [])
})

test('calendário real: início e fim das aulas, por segmento', () => {
  const eventos = lerCalendario(CALENDARIO_DOUTOR_2026, 2026)

  const emInicio = eventos.find((e) => e.texto.includes('Início das aulas da 3ª série do Ensino Médio'))
  assert.equal(emInicio?.inicio, '2026-02-02')
  assert.equal(emInicio?.efeito, 'inicioAula')
  assert.ok(emInicio!.series.includes('3a serie'))

  const f2emInicio = eventos.find((e) => e.texto.includes('Início das aulas do F2'))
  assert.equal(f2emInicio?.inicio, '2026-02-04')
  assert.equal(f2emInicio?.efeito, 'inicioAula')

  const eiF1Inicio = eventos.find((e) => e.texto.includes('Início das aulas da Educação Infantil'))
  assert.equal(eiF1Inicio?.inicio, '2026-02-05')
  assert.equal(eiF1Inicio?.efeito, 'inicioAula')

  const f2emFim = eventos.find((e) => e.texto === 'Último dia de aula do F2 e EM')
  assert.equal(f2emFim?.inicio, '2026-12-09')
  assert.equal(f2emFim?.efeito, 'fimAula')

  const f1Fim = eventos.find((e) => e.texto === 'Último dia de aula F1')
  assert.equal(f1Fim?.inicio, '2026-12-10')
  assert.equal(f1Fim?.efeito, 'fimAula')

  const eiFim = eventos.find((e) => e.texto === 'Último dia de aula do EI')
  assert.equal(eiFim?.inicio, '2026-12-11')
  assert.equal(eiFim?.efeito, 'fimAula')
})

test('calendário real: "Formação com professores Bernoulli" some da agenda de todo mundo', () => {
  const eventos = lerCalendario(CALENDARIO_DOUTOR_2026, 2026)
  const formacoes = eventos.filter((e) => /formacao/i.test(e.texto.normalize('NFD').replace(/[̀-ͯ]/g, '')) && /bernoulli/i.test(e.texto))
  assert.ok(formacoes.length >= 2, 'o calendário real tem pelo menos duas formações com a Bernoulli')

  for (const perfil of [
    { papel: 'aluno' as const, series: ['3a serie'] },
    { papel: 'aluno' as const, series: ['ensino medio'] },
    { papel: 'responsavel' as const, series: ['educacao infantil'] },
  ]) {
    for (const f of formacoes) {
      assert.equal(f.efeito, 'interno', f.texto)
      assert.equal(ehParaMim(f, perfil.papel, perfil.series), false, f.texto)
    }
  }
})

test('calendário real: ruído administrativo inteiro (zeladores, secretaria, direção, seminário fora) some para qualquer perfil', () => {
  const eventos = lerCalendario(CALENDARIO_DOUTOR_2026, 2026)
  const trechosDeRuido = [
    'Retorno zeladores',
    'atendimento da Secretaria',
    'direção/coordenações',
    'plantão do Contraturno',
    'Reunião Pedagógica',
    'Reunião de planejamento',
    'Seminário de Diretores',
    'Seminário Endomarketing',
  ]
  for (const trecho of trechosDeRuido) {
    const ev = eventos.find((e) => e.texto.includes(trecho))
    assert.ok(ev, `esperava achar um evento contendo "${trecho}"`)
    assert.equal(ehParaMim(ev!, 'aluno', ['3a serie']), false, trecho)
    assert.equal(ehParaMim(ev!, 'responsavel', ['3a serie']), false, trecho)
  }
})

test('calendário real: "Compensação de horas" soa administrativo mas fecha o colégio, e o efeito vence', () => {
  // É a mesma lição do "Recesso Escolar dos Professores": o texto é de
  // funcionário, mas "Colégio fechado" muda o dia de todo mundo.
  const eventos = lerCalendario(CALENDARIO_DOUTOR_2026, 2026)
  const ev = eventos.find((e) => e.texto.includes('Compensação de horas'))
  assert.equal(ev?.efeito, 'semAula')
  assert.equal(ehParaMim(ev!, 'aluno', ['3a serie']), true)
})

test('calendário real: nenhum evento se perde — o ano inteiro chega a mais de cem linhas', () => {
  const eventos = lerCalendario(CALENDARIO_DOUTOR_2026, 2026)
  assert.ok(eventos.length > 100, `só ${eventos.length} eventos lidos do calendário real`)
})
