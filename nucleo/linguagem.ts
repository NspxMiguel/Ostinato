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

const DIAS_ES: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
}

const DIAS_FR: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
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

  let regras: { expressao: RegExp; tipo: TipoCompromisso }[]
  if (idioma === 'pt') {
    regras = [
      { expressao: /\b(?:prova|teste|avaliacao|avaliacoes)\b/, tipo: 'prova' },
      { expressao: /\b(?:trabalho|seminario|apresentacao)\b/, tipo: 'trabalho' },
      // "questão/questões" é exercício, não leitura — "responder as questões
      // da página 14" tem "pagina" (leitura) e "questoes" (tarefa) na mesma
      // frase, e sem "questoes" aqui só sobrava "pagina" pra decidir. Achado
      // em 04/09/2026: "Biologia — todas as questões nas 14 a 19" saiu como
      // Leitura.
      { expressao: /\b(?:tarefa|exercicio|exercicios|licao|dever|questao|questoes)\b/, tipo: 'tarefa' },
      { expressao: /\b(?:ler|leitura|livro|capitulo|paginas)\b/, tipo: 'leitura' },
      { expressao: /\b(?:entregar|entrega|enviar)\b/, tipo: 'entrega' },
    ]
  } else if (idioma === 'en') {
    regras = [
      { expressao: /\b(?:test|tests|exam|exams|quiz|quizzes)\b/, tipo: 'prova' },
      { expressao: /\b(?:essay|essays|project|projects|presentation|presentations)\b/, tipo: 'trabalho' },
      { expressao: /\b(?:homework|assignment|assignments|exercise|exercises)\b/, tipo: 'tarefa' },
      { expressao: /\b(?:read|reading|pages|chapter|chapters)\b/, tipo: 'leitura' },
      { expressao: /\b(?:submit|turn\s+in|hand\s+in|due)\b/, tipo: 'entrega' },
    ]
  } else if (idioma === 'es') {
    regras = [
      { expressao: /\b(?:examen|prueba|control)\b/, tipo: 'prova' },
      { expressao: /\b(?:trabajo|proyecto|presentacion)\b/, tipo: 'trabalho' },
      { expressao: /\b(?:tarea|deberes|ejercicio)\b/, tipo: 'tarefa' },
      { expressao: /\b(?:leer|lectura|paginas|capitulo)\b/, tipo: 'leitura' },
      { expressao: /\b(?:entregar|entrega)\b/, tipo: 'entrega' },
    ]
  } else {
    regras = [
      { expressao: /\b(?:controle|examen|interro)\b/, tipo: 'prova' },
      { expressao: /\b(?:devoir|projet|expose)\b/, tipo: 'trabalho' },
      { expressao: /\b(?:exercice|devoirs)\b/, tipo: 'tarefa' },
      { expressao: /\b(?:lire|lecture|pages|chapitre)\b/, tipo: 'leitura' },
      { expressao: /\b(?:rendre|remettre)\b/, tipo: 'entrega' },
    ]
  }

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
  } else if (idioma === 'en') {
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
  } else if (idioma === 'es') {
    let resultado = executar(texto, /\b(?:para\s+)?(?:la\s+)?proxima\s+clase\b/)
    adicionar(resultado, resultado ? { tipo: 'aula', ocorrencia: 1 } : undefined)

    resultado = executar(texto, /\b(?:(?:para|hasta)\s+)?pasado\s+manana\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 2) : undefined))

    resultado = executar(texto, /\b(?:(?:para|hasta)\s+)?manana\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 1) : undefined))

    resultado = executar(texto, /\b(?:(?:para|hasta)\s+)?hoy\b/)
    adicionar(resultado, porData(resultado ? hoje : undefined))

    resultado = executar(texto, /\ben\s+(\d+)\s+dias?\b/)
    adicionar(resultado, porData(resultado ? somarQuantidadeDias(hoje, resultado[1]) : undefined))

    resultado = executar(texto, /\b(?:para\s+)?(?:la\s+)?proxima\s+semana\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 7) : undefined))

    resultado = executar(
      texto,
      /\b(?:(?:para|hasta)\s+)?(?:el\s+)?(?:(proximo)\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+(que\s+viene))?\b/,
    )
    if (resultado) {
      const alvo = DIAS_ES[resultado[2] ?? '']
      adicionar(
        resultado,
        alvo === undefined ? undefined : porData(proximoDiaSemana(hoje, alvo, Boolean(resultado[1] || resultado[3]))),
      )
    }

    resultado = executar(texto, /\b(?:(?:el|para)\s+)?(?:dia\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
    if (resultado) {
      const dia = Number(resultado[1])
      const mes = Number(resultado[2])
      const ano = Number(resultado[3])
      adicionar(resultado, porData(dataValida(ano, mes, dia) ? montarData(ano, mes, dia) : undefined))
    }

    resultado = executar(texto, /\b(?:(?:el|para)\s+)?(?:dia\s+)?(\d{1,2})\/(\d{1,2})\b/)
    if (resultado) {
      adicionar(resultado, porData(dataComAnoInferido(hoje, Number(resultado[2]), Number(resultado[1]))))
    }

    resultado = executar(texto, /\b(?:el\s+)?dia\s+(\d{1,2})\b/)
    if (resultado) adicionar(resultado, porData(dataNoProximoMesPossivel(hoje, Number(resultado[1]))))
  } else {
    let resultado = executar(texto, /\b(?:pour\s+)?(?:le\s+)?prochain\s+cours\b/)
    adicionar(resultado, resultado ? { tipo: 'aula', ocorrencia: 1 } : undefined)

    resultado = executar(texto, /\b(?:pour\s+)?apres(?:-|\s+)demain\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 2) : undefined))

    resultado = executar(texto, /\b(?:pour\s+)?demain\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 1) : undefined))

    resultado = executar(texto, /\b(?:pour\s+)?aujourd(?:['’]|\s*)hui\b/)
    adicionar(resultado, porData(resultado ? hoje : undefined))

    resultado = executar(texto, /\bdans\s+(\d+)\s+jours?\b/)
    adicionar(resultado, porData(resultado ? somarQuantidadeDias(hoje, resultado[1]) : undefined))

    resultado = executar(texto, /\b(?:pour\s+)?(?:la\s+)?semaine\s+prochaine\b/)
    adicionar(resultado, porData(resultado ? somarDias(hoje, 7) : undefined))

    resultado = executar(
      texto,
      /\b(?:pour\s+)?(?:le\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+(prochain|prochaine))?\b/,
    )
    if (resultado) {
      const alvo = DIAS_FR[resultado[1] ?? '']
      adicionar(resultado, alvo === undefined ? undefined : porData(proximoDiaSemana(hoje, alvo, Boolean(resultado[2]))))
    }

    resultado = executar(texto, /\b(?:(?:le|pour)\s+)?(?:jour\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
    if (resultado) {
      const dia = Number(resultado[1])
      const mes = Number(resultado[2])
      const ano = Number(resultado[3])
      adicionar(resultado, porData(dataValida(ano, mes, dia) ? montarData(ano, mes, dia) : undefined))
    }

    resultado = executar(texto, /\b(?:(?:le|pour)\s+)?(?:jour\s+)?(\d{1,2})\/(\d{1,2})\b/)
    if (resultado) {
      adicionar(resultado, porData(dataComAnoInferido(hoje, Number(resultado[2]), Number(resultado[1]))))
    }

    resultado = executar(texto, /\ble\s+(?:jour\s+)?(\d{1,2})\b/)
    if (resultado) adicionar(resultado, porData(dataNoProximoMesPossivel(hoje, Number(resultado[1]))))
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
  } else if (idioma === 'en') {
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
  } else if (idioma === 'es') {
    const resultado = executar(texto, /\ba\s+las\s+(\d{1,2})(?:h(\d{2})?|:(\d{2})|\s+y\s+(media))?\b/)
    if (resultado) adicionar(resultado, Number(resultado[1]), resultado[4] ? 30 : Number(resultado[2] ?? resultado[3] ?? 0))
  } else {
    const resultado = executar(texto, /\ba\s+(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/)
    if (resultado) adicionar(resultado, Number(resultado[1]), Number(resultado[2] ?? resultado[3] ?? 0))
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

/**
 * Onde o nome da matéria termina.
 *
 * São preposições de LUGAR e de complemento: "no caderno", "na folha", "para
 * segunda", "sobre a Revolução". Nenhuma delas aparece dentro do nome de uma
 * matéria, ao contrário de "de/da/do" — que ficam de fora desta lista porque
 * "história da arte" é o nome inteiro.
 *
 * "num"/"numa" (contração de "em um/uma") faltavam aqui e causavam o mesmo
 * estrago do "no caderno": "português num post it" virava o nome de matéria
 * inteiro em vez de parar em "português". Levantamento das outras contrações
 * de lugar do português que tinham o mesmo risco: "dum/duma" (de+um/uma) e
 * "pelo/pela/pelos/pelas" (por+o/a) — mesmo padrão, mesma correção.
 */
const COMPLEMENTO: Partial<Record<Idioma, RegExp>> = {
  pt: /\b(?:no|na|nos|nas|num|numa|dum|duma|pelo|pela|pelos|pelas|em|pra|pro|para|sobre|com|ate|usando|paginas?|pagina)\b/g,
  es: /\b(?:en|para|sobre|con|hasta|paginas?)\b/g,
  fr: /\b(?:dans|sur|pour|avec|jusqu)\b/g,
}

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

  const exp = idioma === 'es'
    ? /\b(?:del|de(?:\s+(?:la|el|las|los))?)\s+/g
    : idioma === 'fr'
      ? /(?:\bde\s+l['’]\s*|\bd['’]\s*|\b(?:du|des)\s+|\bde(?:\s+(?:la|le|les))?\s+)/g
      : /\b(?:de|da|do)\s+/g
  let resultado: RegExpExecArray | null
  while ((resultado = exp.exec(texto)) !== null) {
    const inicioPreposicao = resultado.index
    if (estaDentro(inicioPreposicao, data?.trecho) || estaDentro(inicioPreposicao, hora)) continue

    const inicioNome = inicioPreposicao + resultado[0].length
    let fimNome = original.length
    for (const limite of [data?.trecho, hora]) {
      if (limite && limite.de >= inicioNome && limite.de < fimNome) fimNome = limite.de
    }

    // O nome da matéria termina onde começa um COMPLEMENTO.
    //
    // Sem isto o nome ia até o fim da frase, e "tarefa de química no caderno"
    // criava uma matéria chamada "química no caderno" — aconteceu no iPhone dele
    // em 30/08/2026, e o estrago é permanente: a matéria fica na lista.
    //
    // `de`, `da` e `do` NÃO cortam, de propósito: eles aparecem dentro de nomes
    // de matéria de verdade — "história da arte", "língua portuguesa do Brasil".
    // Quem corta é o locativo e o complemento, que nunca fazem parte do nome.
    const corte = COMPLEMENTO[idioma]
    if (corte) {
      corte.lastIndex = 0
      const busca = normalizarBusca(original.slice(inicioNome, fimNome))
      const achou = corte.exec(busca)
      if (achou && achou.index > 0) fimNome = inicioNome + achou.index
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
  let pontas: RegExp
  if (idioma === 'pt') {
    pontas = /^(?:(?:de|da|do|pra|para|ate|até|em|no|na|as|às)(?:\s+|$))+|(?:(?:^|\s)(?:de|da|do|pra|para|ate|até|em|no|na|as|às))+$/gi
  } else if (idioma === 'en') {
    pontas = /^(?:(?:due|by|on|at|in|for|to|of)(?:\s+|$))+|(?:(?:^|\s)(?:due|by|on|at|in|for|to|of))+$/gi
  } else if (idioma === 'es') {
    pontas = /^(?:(?:de|del|para|hasta|en|el|la|los|las|a)(?:\s+|$))+|(?:(?:^|\s)(?:de|del|para|hasta|en|el|la|los|las|a))+$/gi
  } else {
    pontas = /^(?:(?:de|du|des|pour|dans|le|la|les|a|à|au|aux)(?:\s+|$))+|(?:(?:^|\s)(?:de|du|des|pour|dans|le|la|les|a|à|au|aux))+$/gi
  }

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

function tituloGenerico(idioma: Idioma): string {
  if (idioma === 'pt') return 'Compromisso'
  if (idioma === 'es') return 'Compromiso'
  if (idioma === 'fr') return 'Tâche'
  return 'Task'
}

function tituloPadrao(tipo: TipoEncontrado | undefined, materia: string | undefined, idioma: Idioma): string {
  if (!tipo) return materia ? capitalizar(materia) : tituloGenerico(idioma)

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

  if (idioma === 'es') {
    const nomes: Record<TipoCompromisso, string> = {
      prova: 'Examen',
      trabalho: 'Trabajo',
      tarefa: 'Tarea',
      leitura: 'Lectura',
      entrega: 'Entrega',
      outro: 'Compromiso',
    }
    return materia ? `${nomes[tipo.tipo]} de ${materia}` : nomes[tipo.tipo]
  }

  if (idioma === 'fr') {
    const nomes: Record<TipoCompromisso, string> = {
      prova: 'Contrôle',
      trabalho: 'Devoir',
      tarefa: 'Exercice',
      leitura: 'Lecture',
      entrega: 'Remise',
      outro: 'Tâche',
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
        titulo: tituloGenerico(_idioma),
        confianca: 0.1,
        marcas: [],
        faltando: ['data', 'materia'],
      }
    }
    return interpretarComRegras(_texto, _agora, _idioma)
  } catch {
    const tituloSeguro = typeof _texto === 'string' && _texto.trim() ? _texto.trim() : tituloGenerico(_idioma)
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
 *
 * O interpretador entende os quatro idiomas da interface. A ordem de
 * `candidatos` mantém português e inglês primeiro apenas como desempate para
 * quem ainda não escolheu espanhol ou francês como idioma preferido.
 */
export function interpretarMelhor(
  texto: string,
  agora: Date,
  preferido: Idioma,
  candidatos: readonly Idioma[] = ['pt', 'en', 'es', 'fr'],
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
