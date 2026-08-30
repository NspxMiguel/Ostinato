// Importação tolerante de grades copiadas de PDF, planilha, mensagem ou OCR.
//
// O texto que chega aqui raramente é uma tabela perfeita. Por isso a leitura é
// feita em camadas: primeiro tabelas com dias nas colunas, depois listas por dia
// e, por fim, uma aula solta por linha.

import type { DiaSemana, Hora } from './modelo.ts'

export type AulaCrua = {
  materia: string
  diaSemana: DiaSemana
  inicio: Hora
  fim: Hora
  sala?: string
  confianca: number
}

export type ResultadoImportacao = {
  aulas: AulaCrua[]
  materias: string[]
  ignoradas: string[]
  formato: string
}

type Faixa = { de: number; ate: number }

type DiaEncontrado = Faixa & {
  dia: DiaSemana
}

type HorarioEncontrado = Faixa & {
  inicio: Hora
  fim: Hora
  fimInformado: boolean
}

const DIAS: Record<string, DiaSemana> = {
  dom: 0,
  domingo: 0,
  sun: 0,
  sunday: 0,
  seg: 1,
  segunda: 1,
  'segunda-feira': 1,
  '2a': 1,
  '2o': 1,
  mon: 1,
  monday: 1,
  ter: 2,
  terca: 2,
  'terca-feira': 2,
  '3a': 2,
  '3o': 2,
  tue: 2,
  tues: 2,
  tuesday: 2,
  qua: 3,
  quarta: 3,
  'quarta-feira': 3,
  '4a': 3,
  '4o': 3,
  wed: 3,
  wednesday: 3,
  qui: 4,
  quinta: 4,
  'quinta-feira': 4,
  '5a': 4,
  '5o': 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  sex: 5,
  sexta: 5,
  'sexta-feira': 5,
  '6a': 5,
  '6o': 5,
  fri: 5,
  friday: 5,
  sab: 6,
  sabado: 6,
  sat: 6,
  saturday: 6,
}

function escaparExpressao(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const NOMES_DOS_DIAS = Object.keys(DIAS)
  .sort((a, b) => b.length - a.length)
  .map(escaparExpressao)
  .join('|')

const EXPRESSAO_DIA = new RegExp(`(^|[^a-z0-9])(${NOMES_DOS_DIAS})(?=$|[^a-z0-9])`, 'i')
const PADRAO_HORA =
  '(?:(?:[01]?\\d|2[0-3])(?::[0-5]\\d|h(?:[0-5]\\d)?)|(?:[01]\\d|2[0-3])[0-5]\\d)'
const EXPRESSAO_HORARIO = new RegExp(
  `(^|[^a-z0-9])(${PADRAO_HORA})(?:\\s*(?:-|–|—|ate|as|a)\\s*(${PADRAO_HORA}))?(?=$|[^a-z0-9])`,
  'i',
)

/** Mantém cada caractere na mesma posição para que os índices sirvam no original. */
function textoParaBusca(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ª/g, 'a')
    .replace(/[º°]/g, 'o')
    .toLowerCase()
}

function reconhecerDiaInteiro(valor: string): DiaSemana | undefined {
  const chave = textoParaBusca(valor).trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
  return DIAS[chave]
}

function encontrarDia(valor: string): DiaEncontrado | undefined {
  const encontrado = EXPRESSAO_DIA.exec(textoParaBusca(valor))
  if (!encontrado || encontrado.index === undefined) return undefined
  const prefixo = encontrado[1] ?? ''
  const nome = encontrado[2]
  if (!nome) return undefined
  const dia = DIAS[nome.toLowerCase()]
  if (dia === undefined) return undefined
  const de = encontrado.index + prefixo.length
  return { dia, de, ate: de + nome.length }
}

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0')
}

function normalizarHora(valor: string): Hora | undefined {
  const limpo = valor.trim().toLowerCase()
  let horas: number
  let minutos: number

  if (limpo.includes(':')) {
    const partes = limpo.split(':')
    const parteHoras = partes[0]
    const parteMinutos = partes[1]
    if (!parteHoras || !parteMinutos || partes.length !== 2) return undefined
    horas = Number(parteHoras)
    minutos = Number(parteMinutos)
  } else if (limpo.includes('h')) {
    const partes = limpo.split('h')
    const parteHoras = partes[0]
    if (!parteHoras || partes.length !== 2) return undefined
    horas = Number(parteHoras)
    minutos = partes[1] ? Number(partes[1]) : 0
  } else if (/^\d{4}$/.test(limpo)) {
    horas = Number(limpo.slice(0, 2))
    minutos = Number(limpo.slice(2))
  } else {
    return undefined
  }

  if (!Number.isInteger(horas) || !Number.isInteger(minutos)) return undefined
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return undefined
  return `${doisDigitos(horas)}:${doisDigitos(minutos)}`
}

function minutosDaHora(hora: Hora): number {
  const partes = hora.split(':')
  const horas = Number(partes[0] ?? 0)
  const minutos = Number(partes[1] ?? 0)
  return horas * 60 + minutos
}

function horaDeMinutos(total: number): Hora {
  const noDia = ((total % 1440) + 1440) % 1440
  return `${doisDigitos(Math.floor(noDia / 60))}:${doisDigitos(noDia % 60)}`
}

function encontrarHorario(valor: string): HorarioEncontrado | undefined {
  const encontrado = EXPRESSAO_HORARIO.exec(textoParaBusca(valor))
  if (!encontrado || encontrado.index === undefined) return undefined
  const prefixo = encontrado[1] ?? ''
  const inicio = normalizarHora(encontrado[2] ?? '')
  if (!inicio) return undefined
  const fimLido = encontrado[3] ? normalizarHora(encontrado[3]) : undefined
  if (encontrado[3] && !fimLido) return undefined

  const de = encontrado.index + prefixo.length
  return {
    inicio,
    fim: fimLido ?? horaDeMinutos(minutosDaHora(inicio) + 50),
    fimInformado: fimLido !== undefined,
    de,
    ate: encontrado.index + encontrado[0].length,
  }
}

function removerFaixas(valor: string, faixas: Faixa[]): string {
  let resultado = valor
  const ordenadas = [...faixas].sort((a, b) => b.de - a.de)
  for (const faixa of ordenadas) {
    resultado = resultado.slice(0, faixa.de) + resultado.slice(faixa.ate)
  }
  return resultado
}

function limparMateria(valor: string): string {
  return valor
    .replace(/^\s*(?:aula\s+de|disciplina|materia)\s*[:\-]?\s*/i, '')
    .replace(/^[\s:;|,/\\\-–—]+|[\s:;|,/\\\-–—]+$/g, '')
    .replace(/^(?:das?|as|ate)\s+/i, '')
    .replace(/\s+(?:das?|as|ate)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function separarMateriaESala(valor: string): { materia: string; sala?: string } {
  const expressaoSala = /\b(?:sala|room)\s*[:#-]?\s*([A-Za-zÀ-ÿ0-9]+(?:[-.][A-Za-zÀ-ÿ0-9]+)*)/i
  const encontrada = expressaoSala.exec(valor)
  const sala = encontrada?.[1]?.trim()
  const semSala = encontrada
    ? valor.slice(0, encontrada.index) + valor.slice(encontrada.index + encontrada[0].length)
    : valor
  const materia = limparMateria(semSala)
  return sala ? { materia, sala } : { materia }
}

function ehCelulaSemAula(valor: string): boolean {
  const chave = textoParaBusca(valor).replace(/[^a-z0-9]/g, '')
  return chave === '' || chave === 'x' || chave === 'intervalo' || chave === 'recreio' || chave === 'almoco'
}

function analisarAula(
  linha: string,
  diaForcado?: DiaSemana,
  confiancaBase = 0.95,
): AulaCrua | undefined {
  const diaEncontrado = diaForcado === undefined ? encontrarDia(linha) : undefined
  const diaSemana = diaForcado ?? diaEncontrado?.dia
  const horario = encontrarHorario(linha)
  if (diaSemana === undefined || !horario) return undefined

  const faixas: Faixa[] = [horario]
  if (diaEncontrado) faixas.push(diaEncontrado)
  const restante = removerFaixas(linha, faixas)
  const { materia, sala } = separarMateriaESala(restante)
  if (!materia || ehCelulaSemAula(materia)) return undefined

  const confianca = Math.max(0, Math.min(1, confiancaBase - (horario.fimInformado ? 0 : 0.12)))
  const aula: AulaCrua = {
    materia,
    diaSemana,
    inicio: horario.inicio,
    fim: horario.fim,
    confianca,
  }
  if (sala) aula.sala = sala
  return aula
}

function separarColunas(linha: string): string[] {
  const colunas = linha.includes('\t') ? linha.split('\t') : linha.trim().split(/\s{2,}/)
  const limpas = colunas.map((coluna) => coluna.trim())
  while (limpas[0] === '') limpas.shift()
  while (limpas.at(-1) === '') limpas.pop()
  return limpas
}

function diasDoCabecalho(colunas: string[]): DiaSemana[] | undefined {
  const dias: DiaSemana[] = []
  for (const coluna of colunas) {
    const dia = reconhecerDiaInteiro(coluna)
    if (dia !== undefined) dias.push(dia)
  }
  return dias.length >= 2 ? dias : undefined
}

function ehCabecalho(linha: string): boolean {
  if (encontrarHorario(linha)) return false
  const palavras = textoParaBusca(linha).replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
  return palavras.some((palavra) =>
    ['horario', 'horarios', 'grade', 'turma', 'disciplina', 'disciplinas', 'materia', 'materias'].includes(
      palavra,
    ),
  )
}

function adicionarAulaDaTabela(
  aulas: AulaCrua[],
  materiaBruta: string,
  diaSemana: DiaSemana,
  horario: HorarioEncontrado,
): void {
  if (ehCelulaSemAula(materiaBruta)) return
  const { materia, sala } = separarMateriaESala(materiaBruta)
  if (!materia) return
  const aula: AulaCrua = {
    materia,
    diaSemana,
    inicio: horario.inicio,
    fim: horario.fim,
    confianca: horario.fimInformado ? 0.94 : 0.82,
  }
  if (sala) aula.sala = sala
  aulas.push(aula)
}

function chaveDaMateria(nome: string): string {
  return textoParaBusca(nome).replace(/[^a-z0-9]/g, '')
}

function consolidarMaterias(aulas: AulaCrua[]): string[] {
  const porChave = new Map<string, { nome: string; tamanho: number }>()
  for (const aula of aulas) {
    const chave = chaveDaMateria(aula.materia)
    const atual = porChave.get(chave)
    const tamanho = aula.materia.trim().length
    if (!atual) porChave.set(chave, { nome: aula.materia, tamanho })
    else if (tamanho > atual.tamanho) porChave.set(chave, { nome: aula.materia, tamanho })
  }

  // Segunda passada: a mesma matéria costuma aparecer abreviada na tabela ("MAT")
  // e por extenso na mensagem da coordenação ("Matemática"). Junta quando a forma
  // curta é começo da longa e tem pelo menos três letras — abaixo disso ("Ed",
  // "Fi") o prefixo casaria com coisa demais e juntaria matérias diferentes.
  const chaves = [...porChave.keys()].sort((a, b) => a.length - b.length)
  const apelido = new Map<string, string>()
  for (const curta of chaves) {
    if (curta.length < 3 || apelido.has(curta)) continue
    for (const longa of chaves) {
      if (longa === curta || longa.length <= curta.length) continue
      if (apelido.has(longa)) continue
      if (longa.startsWith(curta)) {
        apelido.set(curta, longa)
        break
      }
    }
  }

  for (const [curta, longa] of apelido) {
    const de = porChave.get(curta)
    const para = porChave.get(longa)
    if (de && para) porChave.delete(curta)
  }

  const resolver = (nomeCru: string): string => {
    let chave = chaveDaMateria(nomeCru)
    let voltas = 0
    while (apelido.has(chave) && voltas < 8) {
      chave = apelido.get(chave) as string
      voltas++
    }
    return porChave.get(chave)?.nome ?? nomeCru
  }

  for (const aula of aulas) {
    aula.materia = resolver(aula.materia)
  }
  return [...porChave.values()].map((item) => item.nome)
}

function escolherFormato(formatos: Set<string>): string {
  if (formatos.size === 0) return ''
  if (formatos.size > 1) return 'misto'
  return formatos.values().next().value ?? ''
}

function importarGradeInternamente(texto: string): ResultadoImportacao {
  if (texto.trim() === '') return { aulas: [], materias: [], ignoradas: [], formato: '' }

  const aulas: AulaCrua[] = []
  const ignoradas: string[] = []
  const formatos = new Set<string>()
  let diasTabela: DiaSemana[] | undefined

  for (const original of texto.split(/\r?\n/)) {
    const linha = original.trim()
    if (!linha) continue

    const colunas = separarColunas(original)
    const novoCabecalho = diasDoCabecalho(colunas)
    if (novoCabecalho) {
      diasTabela = novoCabecalho
      formatos.add('tabela-por-dia')
      continue
    }

    if (diasTabela) {
      const horario = encontrarHorario(colunas[0] ?? '')
      if (horario && colunas.length > 1) {
        for (let indice = 0; indice < diasTabela.length; indice++) {
          const dia = diasTabela[indice]
          const materia = colunas[indice + 1]
          if (dia !== undefined && materia !== undefined) {
            adicionarAulaDaTabela(aulas, materia, dia, horario)
          }
        }
        formatos.add('tabela-por-dia')
        continue
      }
    }

    const diaNoInicio = encontrarDia(linha)
    if (diaNoInicio?.de === 0) {
      const depoisDoDia = linha.slice(diaNoInicio.ate)
      const marcador = depoisDoDia.match(/^\s*:\s*/)
      if (marcador) {
        const conteudo = depoisDoDia.slice(marcador[0].length)
        const quantidadeAntes = aulas.length
        for (const trecho of conteudo.split(/\s*\/\s*/)) {
          const aula = analisarAula(trecho, diaNoInicio.dia, 0.94)
          if (aula) aulas.push(aula)
        }
        if (aulas.length > quantidadeAntes) {
          formatos.add('lista-por-dia')
          continue
        }
        ignoradas.push(linha)
        continue
      }
    }

    const aula = analisarAula(linha)
    if (aula) {
      aulas.push(aula)
      formatos.add('aula-por-linha')
      continue
    }

    if (!ehCabecalho(linha)) ignoradas.push(linha)
  }

  const materias = consolidarMaterias(aulas)
  return { aulas, materias, ignoradas, formato: escolherFormato(formatos) }
}

/**
 * Converte texto livre em aulas revisáveis. Entrada ruim nunca interrompe a tela:
 * se algo inesperado acontecer, o texto volta como ignorado para correção manual.
 */
export function importarGrade(texto: string): ResultadoImportacao {
  try {
    return importarGradeInternamente(texto)
  } catch {
    const linha = typeof texto === 'string' ? texto.trim() : ''
    return {
      aulas: [],
      materias: [],
      ignoradas: linha ? [linha] : [],
      formato: '',
    }
  }
}
