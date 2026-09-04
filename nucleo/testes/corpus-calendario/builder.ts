// A fábrica de calendários do corpus.
//
// Segue o mesmo princípio do `testes/corpus/builder.ts` (o corpus da grade
// horária): o texto do calendário E a lista esperada nascem da MESMA
// especificação. Ninguém digita a lista esperada à mão — ela é derivada, e é
// isso que impede o texto e a expectativa de um caso divergirem com o tempo.
//
// Uma diferença importante em relação ao corpus da grade: aqui a "verdade" de
// cada evento (seu `efeito`) não é escolhida à mão — ela é calculada chamando
// `classificar()` sobre o texto ORIGINAL, limpo, no momento em que o caso é
// construído. O que o corpus mede é se `lerCalendario`, rodando sobre o texto
// RENDERIZADO (às vezes sujo, às vezes bagunçado), ainda chega à mesma data e
// ao mesmo efeito. Divergir é o que vira "errado"; a pergunta seguinte é se
// esse erro é silencioso ou se o evento simplesmente sumiu (o que não é
// enganoso, só é incompleto).

import { classificar, type EfeitoNoDia } from '../../calendarioEscolar.ts'

export type EventoEsperado = {
  texto: string
  efeito: EfeitoNoDia
  inicio: string
  fim: string
}

/** Um evento tal como aparece no calendário de verdade: dia (ou intervalo) + texto. */
export type EventoSpec = { dia: number; ate?: number; texto: string }

export type MonthSpec = {
  mes: number // 1-12
  eventos: EventoSpec[]
}

const NOMES_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const doisDigitos = (n: number) => String(n).padStart(2, '0')
function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`
}

export type HeaderStyle =
  | 'maiusculoSimples' // "JANEIRO"
  | 'comDiasLetivos' // "MARÇO - 22 dias Letivos"
  | 'comSerieNoParenteses' // "JANEIRO - 2(3ª série)"
  | 'comDoisSegmentos' // "DEZEMBRO - 07(F2/EM) 08(F1) dias Letivos"
  | 'comSemanaDeDias' // "FEVEREIRO\nDom Seg Ter Qua Qui Sex Sáb"
  | 'minusculoComTraco' // "Março - início do trimestre"

function renderHeader(mes: number, style: HeaderStyle): string {
  const nome = NOMES_MES[mes - 1]!.toUpperCase()
  switch (style) {
    case 'maiusculoSimples':
      return nome
    case 'comDiasLetivos':
      return `${nome} - ${10 + mes} dias Letivos`
    case 'comSerieNoParenteses':
      return `${nome} - ${mes}(3ª série)`
    case 'comDoisSegmentos':
      return `${nome} - 0${mes}(F2/EM) 0${mes + 1}(F1) dias Letivos`
    case 'comSemanaDeDias':
      return `${nome}\nDom Seg Ter Qua Qui Sex Sáb`
    case 'minusculoComTraco':
      return `${NOMES_MES[mes - 1]} - referência ${mes}`
  }
}

export type ConnectorStyle = 'a' | 'à' | 'ate' | 'e-en-dash'

function renderConector(style: ConnectorStyle): string {
  if (style === 'a') return 'a'
  if (style === 'à') return 'à'
  if (style === 'ate') return 'até'
  return '–'
}

export type RenderOptions = {
  headerStyle?: HeaderStyle
  conectorStyle?: ConnectorStyle
  /** Cola dois eventos do mesmo dia numa linha só (mais um evento por baixo, sem dia). */
  eventoContinuadoNaLinhaDeBaixo?: boolean
  /** Embaralha a ordem dos eventos DENTRO do mês (não muda o mês em si, então não quebra nada). */
  embaralharOrdemDosEventos?: boolean
  /** Cada dia sai com "0" à esquerda quando for < 10 ("07" em vez de "7"). */
  zeroAEsquerda?: boolean

  // — as corrupções, usadas só nos casos "bagunçados" —
  /** Corta o nome do mês para 3 letras ("JAN" em vez de "JANEIRO") — o leitor não reconhece. */
  mesAbreviado?: boolean
  /** Remove o cabeçalho de um mês do meio do texto — os eventos dele caem no mês anterior. */
  omitirCabecalhoDoMes?: number
  /** Escreve "de X a Y" em vez de "X a Y" — o leitor não entende "de" como conectivo. */
  prefixoDeNoIntervalo?: boolean
  /** Troca um dígito do dia por uma letra parecida (OCR ruim: '1'→'l', '0'→'o'). */
  ruidoDeOcrNoDia?: boolean
  /** Insere uma linha de lixo puro (só pontuação) entre dois eventos. */
  linhaDeLixo?: boolean
}

/** Renderiza a especificação inteira, devolvendo o texto E a lista esperada. */
export function renderCalendario(
  meses: MonthSpec[],
  ano: number,
  options: RenderOptions = {},
): { texto: string; esperado: EventoEsperado[] } {
  const o = options
  const linhas: string[] = []
  const esperado: EventoEsperado[] = []

  const diaFmt = (n: number) => (o.zeroAEsquerda ? doisDigitos(n) : String(n))

  for (const mesSpec of meses) {
    if (o.omitirCabecalhoDoMes !== mesSpec.mes) {
      const header = o.mesAbreviado
        ? NOMES_MES[mesSpec.mes - 1]!.slice(0, 3).toUpperCase()
        : renderHeader(mesSpec.mes, o.headerStyle ?? 'maiusculoSimples')
      linhas.push(header)
    }

    const eventos = o.embaralharOrdemDosEventos
      ? [...mesSpec.eventos].sort(() => 0.5 - pseudoAleatorio(mesSpec.mes))
      : mesSpec.eventos

    eventos.forEach((ev, indice) => {
      const c = classificar(ev.texto)
      const fimDia = ev.ate ?? ev.dia
      esperado.push({
        texto: ev.texto,
        efeito: c.efeito,
        inicio: iso(ano, mesSpec.mes, ev.dia),
        fim: iso(ano, mesSpec.mes, fimDia),
      })

      let prefixoDia: string
      if (ev.ate && ev.ate !== ev.dia) {
        const conector = renderConector(o.conectorStyle ?? 'a')
        prefixoDia = o.prefixoDeNoIntervalo
          ? `de ${diaFmt(ev.dia)} ${conector} ${diaFmt(ev.ate)}`
          : `${diaFmt(ev.dia)} ${conector} ${diaFmt(ev.ate)}`
      } else {
        prefixoDia = diaFmt(ev.dia)
      }

      if (o.ruidoDeOcrNoDia) prefixoDia = comRuidoDeOcr(prefixoDia)

      if (o.linhaDeLixo && indice % 4 === 3) linhas.push('||| ___ ...')

      if (o.eventoContinuadoNaLinhaDeBaixo && ev.texto.includes(' — ')) {
        const [primeira, resto] = ev.texto.split(' — ')
        linhas.push(`${prefixoDia} ${primeira}`)
        linhas.push(resto!)
      } else {
        linhas.push(`${prefixoDia} ${ev.texto}`)
      }
    })
  }

  return { texto: linhas.join('\n'), esperado }
}

/** Aleatório determinístico só para embaralhar ordem sem depender de seed externa. */
function pseudoAleatorio(seed: number): number {
  const x = Math.sin(seed * 999) * 10000
  return x - Math.floor(x)
}

/** Troca dígitos por letras visualmente parecidas — o erro clássico de OCR. */
function comRuidoDeOcr(prefixoDia: string): string {
  return prefixoDia.replace(/1/g, 'l').replace(/0/g, 'o')
}
