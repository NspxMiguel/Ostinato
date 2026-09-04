// 300 calendários gerados: 100 baseados em recortes REAIS do calendário 2026
// do Colégio Doutor (o mesmo documento que o Miguel anexou), 100 "limpos" —
// cobrindo a variedade de formato de cabeçalho e evento que o leitor já
// suporta — e 100 "bagunçados" de propósito, cada um testando UMA corrupção
// real que um PDF, um OCR ou uma foto pode introduzir.
//
// Cada caso é gerado, não digitado — a combinação de mês/eventos/estilo vem
// de índices percorrendo os pools abaixo, o mesmo princípio do
// `testes/corpus/cases.ts` da grade horária.
//
// O que o teste mede (em `corpus-calendario.test.ts`) não é "acertou ou
// errou": é, por evento esperado, se ele saiu na data certa, se sumiu (o
// leitor prefere não inventar — seguro, ainda que incompleto) ou se saiu com
// DATA ERRADA e ninguém avisou (perigoso — é isso que o app não pode fazer
// calado). `silencioEsperado` marca os casos em que uma data errada é um
// ponto cego DOCUMENTADO — não uma regressão nova.

import { renderCalendario, type EventoEsperado, type MonthSpec, type RenderOptions } from './builder.ts'

export type CorpusCase = {
  name: string
  texto: string
  ano: number
  esperado: EventoEsperado[]
  /** Data errada aqui é ponto cego conhecido, não regressão — ver o comentário acima do arquivo. */
  silencioEsperado?: boolean
}

// ─── Pool de eventos reais (Colégio Doutor, 2026) ──────────────────────────
// Um por categoria de efeito, exatamente como a escola escreveu.

const REAIS = {
  feriado: [
    'Feriado - 6ª feira Santa',
    'Feriado Municipal',
    'Feriado Nacional',
    'Feriado Nacional - Dia do Trabalho',
    'Feriado Corpus Christi',
    'Dia da Reforma Luterana - Feriado Municipal',
    'Feriado Nacional - Finados',
    'Feriado Nacional Dia Nacional do Zumbi e da Consciência Negra',
  ],
  recesso: [
    'Recesso Escolar dos Professores',
    'Quinta-feira Santa - Recesso Escolar - Não tem aula - Plantão no Contraturno',
    'Recesso escolar - Não tem aula - Plantão no Contraturno',
    'Recesso Escolar - Plantão no Contraturno',
    'Recesso Escolar - Dia do Professor - não haverá aula e nem Plantão',
  ],
  avaliacao: [
    'Avaliação diagnóstica Bernoulli - 1º ao 5º ano',
    '1ª ed. Simulado ENEM do Terceirão - 8h às 13h',
    '2ª ed. Simulado SAS ENEM do Terceirão - 8h às 13h',
    'Avaliação periódica Bernoulli - 4ºs e 5ºs anos',
    'DSD II - Prova escrita - Alunos da 3ª série EM',
    '1ª Sistemática SAS - (6º à 2ª série)',
  ],
  presenca: [
    'Reunião de Pais do F1 - 19h',
    'Reunião de Pais do Contraturno (18h) e Educação Infantil (19h15)',
    'Homenagem Mães - F1 - 18h (turmas vespertinas) e 19h (turmas matutinas)',
  ],
  evento: [
    'Festa Junina - 14h às 18h',
    'Mostra Interna',
    'Jogos Internos do Fundamental 2',
    'Desfile Cívico Escolar',
    'Dia do vovô e do vovó: Educação Infantil',
  ],
  inicioAula: [
    'Início das aulas da 3ª série do Ensino Médio',
    'Início das aulas do F2 (6º ao 9º ano) e Ensino Médio (1ª e 2ª série)',
    'Início das aulas da Educação Infantil e do F1 (1º ao 5º ano)',
  ],
  fimAula: ['Último dia de aula do F2 e EM', 'Último dia de aula F1', 'Último dia de aula do EI'],
  inicioPeriodo: ['Início do 2º trimestre', 'Início do 3º trimestre', 'Início do 2º semestre'],
  administrativo: [
    'Retorno zeladores',
    'Início do atendimento da Secretaria e atividades administrativas',
    'Formação com professores Bernoulli- F1- 7h30 às 11h30',
    'Reunião de planejamento - Educação Infantil, F1, F2 e Ensino Médio',
    '99º Seminário de Diretores (com representantes de mantenedoras)',
    'Seminário Endomarketing',
    'Reunião Pedagógica -EI-F1-F2 e EM',
  ],
}

// Os dias reais em que esses eventos caem, mês a mês (extraído do PDF).
const MESES_REAIS: MonthSpec[] = [
  {
    mes: 1,
    eventos: [
      { dia: 7, texto: REAIS.administrativo[0]! },
      { dia: 12, texto: REAIS.administrativo[1]! },
      { dia: 19, ate: 26, texto: REAIS.recesso[0]! },
      { dia: 28, texto: REAIS.administrativo[2]! },
      { dia: 29, texto: REAIS.administrativo[3]! },
    ],
  },
  {
    mes: 2,
    eventos: [
      { dia: 2, texto: REAIS.inicioAula[0]! },
      { dia: 2, texto: REAIS.presenca[0]! },
      { dia: 4, texto: REAIS.inicioAula[1]! },
      { dia: 5, texto: REAIS.inicioAula[2]! },
      { dia: 9, ate: 13, texto: REAIS.avaliacao[0]! },
    ],
  },
  {
    mes: 4,
    eventos: [
      { dia: 2, texto: REAIS.recesso[1]! },
      { dia: 3, texto: REAIS.feriado[0]! },
      { dia: 6, texto: REAIS.feriado[1]! },
      { dia: 21, texto: REAIS.feriado[2]! },
      { dia: 25, texto: REAIS.avaliacao[1]! },
    ],
  },
  {
    mes: 5,
    eventos: [
      { dia: 1, texto: REAIS.feriado[3]! },
      { dia: 4, ate: 12, texto: REAIS.avaliacao[3]! },
      { dia: 9, texto: REAIS.avaliacao[2]! },
      { dia: 18, ate: 22, texto: REAIS.avaliacao[5]! },
      { dia: 22, texto: REAIS.inicioPeriodo[0]! },
    ],
  },
  {
    mes: 6,
    eventos: [
      { dia: 4, texto: REAIS.feriado[4]! },
      { dia: 5, texto: REAIS.recesso[2]! },
      { dia: 9, texto: REAIS.administrativo[6]! },
      { dia: 13, texto: REAIS.evento[0]! },
    ],
  },
  {
    mes: 7,
    eventos: [
      { dia: 11, texto: REAIS.evento[1]! },
      { dia: 17, texto: REAIS.evento[4]! },
      { dia: 20, ate: 31, texto: REAIS.recesso[3]! },
    ],
  },
  {
    mes: 8,
    eventos: [
      { dia: 3, texto: REAIS.inicioPeriodo[2]! },
      { dia: 6, texto: REAIS.presenca[2]! },
      { dia: 10, ate: 11, texto: REAIS.administrativo[4]! },
      { dia: 18, texto: REAIS.avaliacao[4]! },
      { dia: 22, texto: REAIS.administrativo[5]! },
    ],
  },
  {
    mes: 9,
    eventos: [
      { dia: 7, texto: REAIS.evento[3]! },
      { dia: 8, ate: 11, texto: REAIS.evento[2]! },
      { dia: 8, texto: REAIS.inicioPeriodo[1]! },
    ],
  },
  {
    mes: 10,
    eventos: [
      { dia: 12, texto: REAIS.feriado[2]! },
      { dia: 13, texto: REAIS.recesso[4]! },
      { dia: 31, texto: REAIS.feriado[5]! },
    ],
  },
  {
    mes: 11,
    eventos: [
      { dia: 2, texto: REAIS.feriado[6]! },
      { dia: 20, texto: REAIS.feriado[7]! },
    ],
  },
  {
    mes: 12,
    eventos: [
      { dia: 9, texto: REAIS.fimAula[0]! },
      { dia: 10, texto: REAIS.fimAula[1]! },
      { dia: 11, texto: REAIS.fimAula[2]! },
    ],
  },
]

const HEADER_STYLES: RenderOptions['headerStyle'][] = [
  'maiusculoSimples', 'comDiasLetivos', 'comSerieNoParenteses', 'comDoisSegmentos', 'minusculoComTraco',
]
const CONECTOR_STYLES: RenderOptions['conectorStyle'][] = ['a', 'à', 'ate', 'e-en-dash']

function subconjunto<T>(lista: readonly T[], quantidade: number, deslocamento: number): T[] {
  const out: T[] = []
  for (let i = 0; i < quantidade; i++) out.push(lista[(i + deslocamento) % lista.length]!)
  return out
}

// ─── 100 casos baseados no calendário real ─────────────────────────────────
// Cada um pega de 2 a 4 meses reais (em ordens e combinações diferentes) e
// varia o estilo de cabeçalho, o conector de intervalo e o zero à esquerda —
// nunca o texto do evento em si, que é sempre o que a escola escreveu.

function gerarCasosReais(): CorpusCase[] {
  const casos: CorpusCase[] = []
  for (let i = 0; i < 100; i++) {
    const quantosMeses = 2 + (i % 3) // 2, 3 ou 4 meses por caso
    const meses = subconjunto(MESES_REAIS, quantosMeses, i)
    const options: RenderOptions = {
      headerStyle: HEADER_STYLES[i % HEADER_STYLES.length],
      conectorStyle: CONECTOR_STYLES[i % CONECTOR_STYLES.length],
      zeroAEsquerda: i % 2 === 0,
      embaralharOrdemDosEventos: i % 5 === 0,
    }
    const { texto, esperado } = renderCalendario(meses, 2026, options)
    casos.push({ name: `real-${i + 1}-${meses.map((m) => m.mes).join('.')}`, texto, ano: 2026, esperado })
  }
  return casos
}

// ─── 100 casos limpos ───────────────────────────────────────────────────────
// Calendários sintéticos, um evento de cada categoria, cobrindo a matriz de
// formato de cabeçalho × conector × zero à esquerda. Nenhuma corrupção — o
// objetivo é provar que o leitor lê de verdade a variedade de formato
// "normal", não só o calendário de uma escola só.

function mesSintetico(mes: number, seed: number): MonthSpec {
  const categorias = Object.values(REAIS)
  const eventos = []
  const quantos = 3 + (seed % 3)
  for (let k = 0; k < quantos; k++) {
    const categoria = categorias[(seed + k) % categorias.length]!
    const texto = categoria[(seed * 3 + k) % categoria.length]!
    const dia = 1 + ((seed + k * 7) % 26)
    const temIntervalo = k % 4 === 0
    eventos.push(temIntervalo ? { dia, ate: Math.min(dia + 3, 28), texto } : { dia, texto })
  }
  return { mes, eventos }
}

function gerarCasosLimpos(): CorpusCase[] {
  const casos: CorpusCase[] = []
  for (let i = 0; i < 100; i++) {
    const mes1 = 1 + (i % 12)
    const mes2 = 1 + ((i + 6) % 12)
    const meses = mes1 === mes2 ? [mesSintetico(mes1, i)] : [mesSintetico(mes1, i), mesSintetico(mes2, i + 50)]
    const options: RenderOptions = {
      headerStyle: HEADER_STYLES[(i * 2) % HEADER_STYLES.length],
      conectorStyle: CONECTOR_STYLES[(i * 3) % CONECTOR_STYLES.length],
      zeroAEsquerda: i % 3 === 0,
      embaralharOrdemDosEventos: i % 4 === 0,
    }
    const { texto, esperado } = renderCalendario(meses, 2026, options)
    casos.push({ name: `limpo-${i + 1}-mes${mes1}`, texto, ano: 2026, esperado })
  }
  return casos
}

// ─── 100 casos bagunçados ───────────────────────────────────────────────────
// Cada caso aplica UMA corrupção de cada vez, sobre a MESMA base de meses
// sintéticos usada nos casos limpos — assim o efeito da corrupção fica
// isolado, e dá para nomear exatamente o que está sendo testado.
//
// `silencioEsperado` documenta o único tipo de corrupção que este leitor NÃO
// detecta — a data sai errada sem aviso nenhum: um cabeçalho de mês AUSENTE
// no meio do calendário. Os eventos daquele mês caem silenciosamente no mês
// anterior, porque o mês é estado e ninguém avisa que ele não mudou.
//
// "Mês abreviado" (JAN em vez de JANEIRO) parecia o mesmo risco, mas medido
// contra o leitor de verdade não é: como a corrupção abrevia TODO cabeçalho
// do caso, o primeiro mês também some, `mes` nunca chega a ser atribuído, e
// o calendário inteiro fica vazio — incompleto, mas seguro, não silencioso
// (ver o comentário do `CORRUPCOES` abaixo).
//
// As demais corrupções (dia com ruído de OCR, "de X a Y", linha de lixo,
// evento partido em dois) fazem a linha inteira ser descartada — o evento
// SOME, o que é incompleto mas não é enganoso.

type Corrupcao = { nome: string; options: RenderOptions; perigosaNoMeioDoTexto: boolean }

const CORRUPCOES: Corrupcao[] = [
  // Abrevia TODO cabeçalho do caso (não só o do meio) — o primeiro mês também
  // fica irreconhecível, `mes` nunca é atribuído, e o calendário inteiro sai
  // vazio: incompleto, mas seguro. Medido, não suposto — ver o comentário
  // acima do arquivo.
  { nome: 'mes-abreviado', options: { mesAbreviado: true }, perigosaNoMeioDoTexto: false },
  { nome: 'cabecalho-omitido', options: {}, perigosaNoMeioDoTexto: true }, // omitirCabecalhoDoMes setado por caso
  { nome: 'prefixo-de-no-intervalo', options: { prefixoDeNoIntervalo: true }, perigosaNoMeioDoTexto: false },
  { nome: 'ruido-de-ocr-no-dia', options: { ruidoDeOcrNoDia: true }, perigosaNoMeioDoTexto: false },
  { nome: 'linha-de-lixo-intercalada', options: { linhaDeLixo: true }, perigosaNoMeioDoTexto: false },
  { nome: 'evento-continuado-vira-dois', options: { eventoContinuadoNaLinhaDeBaixo: true }, perigosaNoMeioDoTexto: false },
]

function gerarCasosBagunçados(): CorpusCase[] {
  const casos: CorpusCase[] = []
  for (let i = 0; i < 100; i++) {
    const corrupcao = CORRUPCOES[i % CORRUPCOES.length]!
    const mes1 = 1 + (i % 12)
    const mes2 = 1 + ((i + 4) % 12)
    // Sempre 2 meses: a corrupção "no meio do texto" só é interessante
    // quando não é o primeiro mês do documento (senão o evento é
    // simplesmente descartado por falta de mês — caso seguro, não perigoso).
    const meses = mes1 === mes2 ? [mesSintetico(mes1, i), mesSintetico((mes1 % 12) + 1, i + 1)] : [mesSintetico(mes1, i), mesSintetico(mes2, i + 50)]

    const options: RenderOptions = {
      ...corrupcao.options,
      headerStyle: HEADER_STYLES[i % HEADER_STYLES.length],
      conectorStyle: CONECTOR_STYLES[i % CONECTOR_STYLES.length],
      omitirCabecalhoDoMes: corrupcao.nome === 'cabecalho-omitido' ? meses[1]!.mes : undefined,
    }
    const { texto, esperado } = renderCalendario(meses, 2026, options)
    casos.push({
      name: `bagunçado-${i + 1}-${corrupcao.nome}`,
      texto,
      ano: 2026,
      esperado,
      silencioEsperado: corrupcao.perigosaNoMeioDoTexto,
    })
  }
  return casos
}

export const CORPUS: CorpusCase[] = [...gerarCasosReais(), ...gerarCasosLimpos(), ...gerarCasosBagunçados()]
