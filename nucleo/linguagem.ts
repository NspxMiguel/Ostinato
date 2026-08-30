// Entender uma frase solta e virar compromisso.
//
// É a peça que os TRÊS jeitos de anotar compartilham: digitar corrido, falar, e
// fotografar o papel. Todos terminam em texto, e todos passam por aqui — assim
// a foto e a voz não ganham regras próprias para divergir depois.
//
// A regra que manda: quando não tiver certeza, dizer que não tem. Uma prova
// marcada no dia errado é pior do que uma pergunta a mais.

import type { DataISO, Hora, Idioma, TipoCompromisso } from './modelo.ts'
import { dataDe, diaSemanaDe, diferencaEmDias, horaDeMinutos, minutosDaHora, somarDias } from './tempo.ts'

/** O papel de cada pedaço reconhecido, para a tela poder grifar na frase. */
export type Papel = 'tipo' | 'materia' | 'data' | 'hora' | 'titulo'

export type Marca = { de: number; ate: number; papel: Papel }

export type VencimentoInterpretado =
  | { tipo: 'data'; data: DataISO; hora?: Hora }
  /** "na próxima aula de X" — quem resolve contra a grade é `vencimento.ts`. */
  | { tipo: 'aula'; ocorrencia: number }

export type Interpretacao = {
  /** Ausente quando a frase não diz. A tela usa 'tarefa' como padrão visível. */
  tipo?: TipoCompromisso
  /** O que sobra depois de tirar tipo, matéria e data. Nunca vazio. */
  titulo: string
  /** O nome CRU da matéria. Quem decide qual é ela é `materias.ts`. */
  materiaNome?: string
  vencimento?: VencimentoInterpretado
  /** 0..1. Abaixo de 0.5 a tela mostra o formulário aberto em vez de confirmar. */
  confianca: number
  marcas: Marca[]
  /** O que ficou faltando, para a tela pedir só isso. */
  faltando: ('data' | 'materia' | 'titulo')[]
}

export const NAO_IMPLEMENTADO = 'linguagem: interpretar ainda não foi escrito'

type Trecho = { de: number; ate: number }

type TipoEncontrado = Trecho & {
  tipo: TipoCompromisso
  palavra: string
}

type DataEncontrada = {
  trecho: Trecho
  vencimento: VencimentoInterpretado
}

type HoraEncontrada = Trecho & { hora: Hora }

type MateriaEncontrada = {
  nome: string
  trecho: Trecho
  remocao: Trecho
}

const DIAS_PT: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  'terca-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
}

const DIAS_EN: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const MESES_EN: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function normalizarBusca(texto: string): string {
  return texto.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function trechoDe(resultado: RegExpExecArray): Trecho {
  const de = resultado.index
  return { de, ate: de + resultado[0].length }
}

function executar(texto: string, expressao: RegExp): RegExpExecArray | undefined {
  const resultado = expressao.exec(texto)
  expressao.lastIndex = 0
  return resultado ?? undefined
}

function reconhecerTipo(texto: string, idioma: Idioma): TipoEncontrado | undefined {
  if (idioma === 'en') {
    // Em "assignment due", o "due" transforma a tarefa genérica numa entrega:
    // há um prazo explicitamente anunciado, como em "submit" e "hand in".
    const entregaDeAssignment = executar(texto, /\bassignment(?=\s+due\b)/)
    if (entregaDeAssignment) {
      return { ...trechoDe(entregaDeAssignment), tipo: 'entrega', palavra: entregaDeAssignment[0] }
    }
  }

  const regras: { expressao: RegExp; tipo: TipoCompromisso }[] = idioma === 'pt'
    ? [
        { expressao: /\b(?:prova|teste|avaliacao|avaliacoes)\b/, tipo: 'prova' },
        { expressao: /\b(?:trabalho|seminario|apresentacao)\b/, tipo: 'trabalho' },
        { expressao: /\b(?:tarefa|exercicio|exercicios|licao|dever)\b/, tipo: 'tarefa' },
        { expressao: /\b(?:ler|leitura|livro|capitulo|paginas)\b/, tipo: 'leitura' },
        { expressao: /\b(?:entregar|entrega|enviar)\b/, tipo: 'entrega' },
      ]
    : [
        { expressao: /\b(?:test|tests|exam|exams|quiz|quizzes)\b/, tipo: 'prova' },
        { expressao: /\b(?:essay|essays|project|projects|presentation|presentations)\b/, tipo: 'trabalho' },
        { expressao: /\b(?:homework|assignment|assignments|exercise|exercises)\b/, tipo: 'tarefa' },
        { expressao: /\b(?:read|reading|pages|chapter|chapters)\b/, tipo: 'leitura' },
        { expressao: /\b(?:submit|turn\s+in|hand\s+in|due)\b/, tipo: 'entrega' },
      ]

  const encontrados: TipoEncontrado[] = []
  for (const regra of regras) {
    const resultado = executar(texto, regra.expressao)
    if (!resultado) continue
    encontrados.push({ ...trechoDe(resultado), tipo: regra.tipo, palavra: resultado[0] })
  }

  encontrados.sort((a, b) => a.de - b.de || b.ate - b.de - (a.ate - a.de))
  return encontrados[0]
}

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0')
}

function montarData(ano: number, mes: number, dia: number): DataISO {
  return `${String(ano).padStart(4, '0')}-${doisDigitos(mes)}-${doisDigitos(dia)}`
}

function dataValida(ano: number, mes: number, dia: number): boolean {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return false
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1) return false

  const primeiro = montarData(ano, mes, 1)
  const proximo = mes === 12 ? montarData(ano + 1, 1, 1) : montarData(ano, mes + 1, 1)
  return dia <= diferencaEmDias(primeiro, proximo)
}

function dataComAnoInferido(hoje: DataISO, mes: number, dia: number): DataISO | undefined {
  const anoAtual = Number(hoje.slice(0, 4))
  if (!dataValida(anoAtual, mes, dia)) return undefined

  const nesteAno = montarData(anoAtual, mes, dia)
  if (diferencaEmDias(hoje, nesteAno) >= 0) return nesteAno
  return dataValida(anoAtual + 1, mes, dia) ? montarData(anoAtual + 1, mes, dia) : undefined
}

function dataNoProximoMesPossivel(hoje: DataISO, dia: number): DataISO | undefined {
  let ano = Number(hoje.slice(0, 4))
  let mes = Number(hoje.slice(5, 7))

  for (let tentativa = 0; tentativa < 13; tentativa++) {
    if (dataValida(ano, mes, dia)) {
      const candidata = montarData(ano, mes, dia)
      if (diferencaEmDias(hoje, candidata) >= 0) return candidata
    }
    if (mes === 12) {
      ano += 1
      mes = 1
    } else {
      mes += 1
    }
  }
  return undefined
}

function proximoDiaSemana(hoje: DataISO, alvo: number, semanaSeguinte: boolean): DataISO {
  const diferenca = (alvo - diaSemanaDe(hoje) + 7) % 7
  return somarDias(hoje, diferenca + (semanaSeguinte ? 7 : 0))
}

function somarQuantidadeDias(hoje: DataISO, quantidade: string | undefined): DataISO | undefined {
  const dias = Number(quantidade)
  return Number.isSafeInteger(dias) && dias >= 0 ? somarDias(hoje, dias) : undefined
}

function reconhecerData(texto: string, hoje: DataISO, idioma: Idioma): DataEncontrada | undefined {
  const candidatos: DataEncontrada[] = []
  const adicionar = (resultado: RegExpExecArray | undefined, vencimento: VencimentoInterpretado | undefined): void => {
    if (resultado && vencimento) candidatos.push({ trecho: trechoDe(resultado), vencimento })
  }
  const porData = (data: DataISO | undefined): VencimentoInterpretado | undefined =>
    data ? { tipo: 'data', data } : undefined

  if (idioma === 'pt') {
    let resultado = executar(texto, /\b(?:(?:pra|para|na)\s+)?proxima\s+aula\b/)
    adicionar(resultado, resultado ? { tipo: 'aula', ocorrencia: 1 } : undefined)

    resultado = executar(texto, /\b(?:(?:pra|para|ate)\s+)?depois\s+de\s+amanha\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 2) : undefined))

    resultado = executar(texto, /\b(?:(?:pra|para|ate)\s+)?amanha\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 1) : undefined))

    resultado = executar(texto, /\b(?:(?:pra|para|ate)\s+)?hoje\b/)
    adicionar(resultado, porData(resultado ? hoje : undefined))

    resultado = executar(texto, /\bem\s+(\d+)\s+dias?\b/)
    adicionar(resultado, porData(resultado ? somarQuantidadeDias(hoje, resultado[1]) : undefined))

    resultado = executar(texto, /\b(?:(?:na|pra|para)\s+)?semana\s+que\s+vem\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 7) : undefined))

    resultado = executar(
      texto,
      /\b(?:(?:ate|pra|para|na|no)\s+)?(?:(proxima)\s+)?(segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|domingo)(?:\s+(que\s+vem))?\b/,
    )
    if (resultado) {
      const alvo = DIAS_PT[resultado[2] ?? '']
      adicionar(
        resultado,
        alvo === undefined ? undefined : porData(proximoDiaSemana(hoje, alvo, Boolean(resultado[1] || resultado[3]))),
      )
    }

    resultado = executar(texto, /\b(?:(?:no|em)\s+)?(?:dia\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
    if (resultado) {
      const dia = Number(resultado[1])
      const mes = Number(resultado[2])
      const ano = Number(resultado[3])
      adicionar(resultado, porData(dataValida(ano, mes, dia) ? montarData(ano, mes, dia) : undefined))
    }

    resultado = executar(texto, /\b(?:(?:no|em)\s+)?(?:dia\s+)?(\d{1,2})\/(\d{1,2})\b/)
    if (resultado) {
      adicionar(resultado, porData(dataComAnoInferido(hoje, Number(resultado[2]), Number(resultado[1]))))
    }

    resultado = executar(texto, /\bdia\s+(\d{1,2})\b/)
    if (resultado) adicionar(resultado, porData(dataNoProximoMesPossivel(hoje, Number(resultado[1]))))
  } else {
    let resultado = executar(texto, /\b(?:(?:due|by|for)\s+)?next\s+class\b/)
    adicionar(resultado, resultado ? { tipo: 'aula', ocorrencia: 1 } : undefined)

    resultado = executar(texto, /\b(?:(?:due|by)\s+)?day\s+after\s+tomorrow\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 2) : undefined))

    resultado = executar(texto, /\b(?:(?:due|by)\s+)?tomorrow\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 1) : undefined))

    resultado = executar(texto, /\b(?:(?:due|by)\s+)?today\b/)
    adicionar(resultado, porData(resultado ? hoje : undefined))

    resultado = executar(texto, /\b(?:(?:due|by)\s+)?in\s+(\d+)\s+days?\b/)
    adicionar(resultado, porData(resultado ? somarQuantidadeDias(hoje, resultado[1]) : undefined))

    resultado = executar(texto, /\b(?:(?:due|by)\s+)?next\s+week\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 7) : undefined))

    resultado = executar(
      texto,
      /\b(?:(?:by|on|due)\s+)?(?:(next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    )
    if (resultado) {
      const alvo = DIAS_EN[resultado[2] ?? '']
      adicionar(resultado, alvo === undefined ? undefined : porData(proximoDiaSemana(hoje, alvo, Boolean(resultado[1]))))
    }

    resultado = executar(
      texto,
      /\b(?:(?:on|by|due)\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:(?:,\s*|\s+)(\d{4}))?\b/,
    )
    if (resultado) {
      const mes = MESES_EN[resultado[1] ?? '']
      const dia = Number(resultado[2])
      const anoExplicito = resultado[3] ? Number(resultado[3]) : undefined
      const data = mes === undefined
        ? undefined
        : anoExplicito === undefined
          ? dataComAnoInferido(hoje, mes, dia)
          : dataValida(anoExplicito, mes, dia)
            ? montarData(anoExplicito, mes, dia)
            : undefined
      adicionar(resultado, porData(data))
    }
  }

  candidatos.sort((a, b) => a.trecho.de - b.trecho.de || b.trecho.ate - b.trecho.de - (a.trecho.ate - a.trecho.de))
  return candidatos[0]
}

function reconhecerHora(texto: string, idioma: Idioma): HoraEncontrada | undefined {
  const candidatos: HoraEncontrada[] = []
  const adicionar = (resultado: RegExpExecArray | undefined, horas: number, minutos: number): void => {
    if (!resultado || !Number.isInteger(horas) || !Number.isInteger(minutos)) return
    if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return
    const total = minutosDaHora(`${horas}:${doisDigitos(minutos)}`)
    candidatos.push({ ...trechoDe(resultado), hora: horaDeMinutos(total) })
  }

  if (idioma === 'pt') {
    const resultado = executar(texto, /\b(?:as\s+)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/)
    if (resultado) adicionar(resultado, Number(resultado[1]), Number(resultado[2] ?? resultado[3] ?? 0))
  } else {
    let resultado = executar(texto, /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
    if (resultado) {
      const original = Number(resultado[1])
      if (original >= 1 && original <= 12) {
        const horas = resultado[3] === 'am' ? original % 12 : (original % 12) + 12
        adicionar(resultado, horas, Number(resultado[2] ?? 0))
      }
    }

    resultado = executar(texto, /\bat\s+(\d{1,2}):(\d{2})\b/)
    if (resultado) adicionar(resultado, Number(resultado[1]), Number(resultado[2]))
  }

  candidatos.sort((a, b) => a.de - b.de)
  return candidatos[0]
}

function estaDentro(indice: number, trecho: Trecho | undefined): boolean {
  return Boolean(trecho && indice >= trecho.de && indice < trecho.ate)
}

function limitesSemEspacoOuPontuacao(texto: string, de: number, ate: number): Trecho {
  while (de < ate && /[\s,;:.\-–—]/.test(texto[de] ?? '')) de += 1
  while (ate > de && /[\s,;:.\-–—]/.test(texto[ate - 1] ?? '')) ate -= 1
  return { de, ate }
}

/**
 * Palavras que embrulham a matéria em vez de serem a matéria.
 *
 * "lista de exercicios de fisica": o primeiro "de" pertence a "lista", e quem
 * manda é o último. Mas isso não vale sempre — "trabalho de historia da arte"
 * tem a matéria no meio, e pegar o último "de" daria "arte". Por isso a regra é
 * a lista fechada abaixo, e não "sempre o último": ela descreve o padrão real
 * (um recipiente genérico segurando a matéria) em vez de chutar.
 */
const RECIPIENTES_PT =
  /^(?:lista|listas|exercicio|exercicios|atividade|atividades|resumo|resumos|ficha|fichas|apostila|apostilas|capitulo|capitulos|pagina|paginas|questao|questoes|revisao|revisoes|caderno|relatorio|relatorios|projeto|projetos|slide|slides)\s+(?:de|da|do)\s+(.+)$/i

/** Descasca "lista de exercicios de fisica" até sobrar "fisica". */
function tirarRecipiente(nome: string): string {
  let atual = nome.trim()
  for (let volta = 0; volta < 4; volta++) {
    const casou = RECIPIENTES_PT.exec(normalizarBusca(atual))
    if (!casou) break
    // Corta no original pelo tamanho do que sobrou, para não perder o acento.
    const restante = casou[1] ?? ''
    atual = atual.slice(atual.length - restante.length).trim()
  }
  return atual
}

function reconhecerMateria(
  original: string,
  texto: string,
  idioma: Idioma,
  tipo: TipoEncontrado | undefined,
  data: DataEncontrada | undefined,
  hora: HoraEncontrada | undefined,
): MateriaEncontrada | undefined {
  if (idioma === 'en') {
    if (!tipo || tipo.de === 0) return undefined
    const trecho = limitesSemEspacoOuPontuacao(original, 0, tipo.de)
    if (trecho.de >= trecho.ate) return undefined
    return { nome: original.slice(trecho.de, trecho.ate), trecho, remocao: trecho }
  }

  const exp = /\b(?:de|da|do)\s+/g
  let resultado: RegExpExecArray | null
  while ((resultado = exp.exec(texto)) !== null) {
    const inicioPreposicao = resultado.index
    if (estaDentro(inicioPreposicao, data?.trecho) || estaDentro(inicioPreposicao, hora)) continue

    const inicioNome = inicioPreposicao + resultado[0].length
    let fimNome = original.length
    for (const limite of [data?.trecho, hora]) {
      if (limite && limite.de >= inicioNome && limite.de < fimNome) fimNome = limite.de
    }

    const trecho = limitesSemEspacoOuPontuacao(original, inicioNome, fimNome)
    if (trecho.de >= trecho.ate) continue
    const cru = original.slice(trecho.de, trecho.ate)
    const nome = idioma === 'pt' ? tirarRecipiente(cru) : cru
    // O trecho grifado acompanha o nome final, senão a tela marcaria "lista de
    // exercicios de fisica" inteiro como matéria.
    const inicioNomeFinal = trecho.ate - nome.length
    return {
      nome,
      trecho: { de: inicioNomeFinal, ate: trecho.ate },
      remocao: { de: inicioPreposicao, ate: trecho.ate },
    }
  }
  return undefined
}

function limparTitulo(texto: string, remocoes: Trecho[], idioma: Idioma): string {
  const unidades = texto.split('')
  for (const remocao of remocoes) {
    for (let i = Math.max(0, remocao.de); i < Math.min(unidades.length, remocao.ate); i++) unidades[i] = ' '
  }

  let titulo = unidades.join('').replace(/\s+/g, ' ').trim().replace(/^[,;:.\-–—\s]+|[,;:.\-–—\s]+$/g, '')
  const pontas = idioma === 'pt'
    ? /^(?:(?:de|da|do|pra|para|ate|até|em|no|na|as|às)(?:\s+|$))+|(?:(?:^|\s)(?:de|da|do|pra|para|ate|até|em|no|na|as|às))+$/gi
    : /^(?:(?:due|by|on|at|in|for|to|of)(?:\s+|$))+|(?:(?:^|\s)(?:due|by|on|at|in|for|to|of))+$/gi

  let anterior: string
  do {
    anterior = titulo
    titulo = titulo.replace(pontas, '').trim().replace(/^[,;:.\-–—\s]+|[,;:.\-–—\s]+$/g, '')
  } while (titulo !== anterior)
  return titulo
}

function capitalizar(texto: string): string {
  return texto.length === 0 ? texto : texto[0]?.toLocaleUpperCase() + texto.slice(1)
}

function tituloPadrao(tipo: TipoEncontrado | undefined, materia: string | undefined, idioma: Idioma): string {
  if (!tipo) return materia ? capitalizar(materia) : idioma === 'pt' ? 'Compromisso' : 'Task'

  if (idioma === 'pt') {
    const nomes: Record<TipoCompromisso, string> = {
      prova: 'Prova',
      trabalho: 'Trabalho',
      tarefa: 'Tarefa',
      leitura: 'Leitura',
      entrega: 'Entrega',
      outro: 'Compromisso',
    }
    return materia ? `${nomes[tipo.tipo]} de ${materia}` : nomes[tipo.tipo]
  }

  const palavraOriginal = tipo.palavra.replace(/\s+due$/, '')
  const nomes: Record<TipoCompromisso, string> = {
    prova: 'test',
    trabalho: 'project',
    tarefa: 'assignment',
    leitura: 'reading',
    entrega: 'assignment',
    outro: 'task',
  }
  const substantivos = /^(?:test|tests|exam|exams|quiz|quizzes|essay|essays|project|projects|presentation|presentations|homework|assignment|assignments|exercise|exercises)$/
  const nomeTipo = substantivos.test(palavraOriginal) ? palavraOriginal : nomes[tipo.tipo]
  return materia ? `${capitalizar(materia)} ${nomeTipo}` : capitalizar(nomeTipo)
}

function interpretarComRegras(textoOriginal: string, agora: Date, idioma: Idioma): Interpretacao {
  const texto = normalizarBusca(textoOriginal)
  const hoje = dataDe(agora)
  const tipo = reconhecerTipo(texto, idioma)
  const data = reconhecerData(texto, hoje, idioma)
  const hora = reconhecerHora(texto, idioma)
  const materia = reconhecerMateria(textoOriginal, texto, idioma, tipo, data, hora)

  const remocoes: Trecho[] = []
  if (tipo) remocoes.push(tipo)
  if (data) remocoes.push(data.trecho)
  if (hora) remocoes.push(hora)
  if (materia) remocoes.push(materia.remocao)

  let titulo = limparTitulo(textoOriginal, remocoes, idioma)
  if (!titulo) titulo = tituloPadrao(tipo, materia?.nome, idioma)

  const marcas: Marca[] = []
  if (tipo) marcas.push({ de: tipo.de, ate: tipo.ate, papel: 'tipo' })
  if (materia) marcas.push({ de: materia.trecho.de, ate: materia.trecho.ate, papel: 'materia' })
  if (data) marcas.push({ de: data.trecho.de, ate: data.trecho.ate, papel: 'data' })

  let vencimento = data?.vencimento
  if (vencimento?.tipo === 'data' && hora) {
    vencimento = { ...vencimento, hora: hora.hora }
    marcas.push({ de: hora.de, ate: hora.ate, papel: 'hora' })
  }
  marcas.sort((a, b) => a.de - b.de || a.ate - b.ate)

  const faltando: Interpretacao['faltando'] = []
  if (!vencimento) faltando.push('data')
  if (!materia) faltando.push('materia')

  const ausentes = Number(!tipo) + Number(!materia) + Number(!vencimento)
  const confianca = Math.max(0.1, 1 - ausentes * 0.25)
  const interpretacao: Interpretacao = { titulo, confianca, marcas, faltando }
  if (tipo) interpretacao.tipo = tipo.tipo
  if (materia) interpretacao.materiaNome = materia.nome
  if (vencimento) interpretacao.vencimento = vencimento
  return interpretacao
}

/**
 * Lê a frase e devolve o que dá para afirmar.
 *
 * `agora` entra como parâmetro (e não `new Date()`) porque "sexta que vem"
 * depende de que dia é hoje, e um interpretador que lê o relógio por dentro não
 * tem como ser testado.
 */
export function interpretar(_texto: string, _agora: Date, _idioma: Idioma): Interpretacao {
  try {
    if (_texto.trim().length === 0) {
      return {
        titulo: _idioma === 'pt' ? 'Compromisso' : 'Task',
        confianca: 0.1,
        marcas: [],
        faltando: ['data', 'materia'],
      }
    }
    return interpretarComRegras(_texto, _agora, _idioma)
  } catch {
    const tituloSeguro = typeof _texto === 'string' && _texto.trim() ? _texto.trim() : _idioma === 'en' ? 'Task' : 'Compromisso'
    return { titulo: tituloSeguro, confianca: 0.1, marcas: [], faltando: ['data', 'materia'] }
  }
}

/**
 * Interpreta tentando o idioma da interface primeiro, e os outros depois.
 *
 * O app é global, e a língua da INTERFACE não é necessariamente a língua em que
 * a pessoa escreve. Um estudante brasileiro com o iPhone em inglês digita
 * "prova de historia sexta que vem", e com uma leitura só ele receberia de volta
 * "Task, sem data" — o app pareceria burro por um motivo que não tem nada a ver
 * com o que ele pediu.
 *
 * O critério de desempate é a confiança, e o idioma preferido ganha os empates:
 * quem escreve na língua da interface é a maioria, e não deve pagar por quem não
 * escreve.
 */
export function interpretarMelhor(
  texto: string,
  agora: Date,
  preferido: Idioma,
  candidatos: readonly Idioma[] = ['pt', 'en'],
): Interpretacao {
  const ordem = [preferido, ...candidatos.filter((i) => i !== preferido)]
  let melhor: Interpretacao | null = null
  for (const idioma of ordem) {
    let atual: Interpretacao
    try {
      atual = interpretar(texto, agora, idioma)
    } catch {
      continue
    }
    if (!melhor || atual.confianca > melhor.confianca) melhor = atual
  }
  return melhor ?? { titulo: texto.trim(), confianca: 0.1, marcas: [], faltando: ['data', 'materia'] }
}
