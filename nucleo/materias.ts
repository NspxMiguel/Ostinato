// Achar de que matéria alguém está falando.
//
// O mesmo assunto tem nome demais: o horário diz "INF", o professor diz
// "Informática", o colega diz "computação" e o estudante escreve "info". Isto
// aqui é o que junta os quatro — e, quando não tem certeza, diz que não tem, em
// vez de chutar. Chutar errado joga uma prova na matéria errada.

import type { Idioma, Materia } from './modelo.ts'
import { vivos } from './sync/registro.ts'
import { mesmoGrupoDeMateria } from './abreviacoesMaterias.ts'

/** Minúsculas, sem acento, sem pontuação. É a forma que se compara. */
export function normalizar(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export type Casamento = {
  materia: Materia
  /** 1 nome exato · 0.9 apelido · 0.8 abreviação por pedaços · 0.75 prefixo · 0.7 iniciais. */
  confianca: number
  /** Como casou — a tela usa para explicar antes de aplicar. */
  por: 'nome' | 'apelido' | 'abreviacao' | 'prefixo'
}

/** Abaixo disto, o app pergunta em vez de decidir sozinho. */
export const CONFIANCA_MINIMA = 0.7

/** "Educação Física" -> "ef". Casa com o "EF" que o horário escreve. */
function iniciaisDe(nome: string): string {
  return normalizar(nome)
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0] ?? '')
    .join('')
}

/**
 * "ed fis" casa "educacao fisica": mesmo número de palavras, e cada pedaço é
 * começo da palavra correspondente.
 *
 * É assim que horário de escola abrevia — corta cada palavra, não pega só a
 * inicial. Exigir duas letras por pedaço evita que "e f" case com qualquer
 * nome de duas palavras.
 */
function casaPorPedacos(alvo: string, nome: string): boolean {
  const a = alvo.split(' ').filter(Boolean)
  const b = nome.split(' ').filter(Boolean)
  if (a.length === 0 || a.length !== b.length) return false
  // Uma palavra só exige três letras; com duas ("ma"), qualquer matéria que
  // comece igual casaria e a decisão viraria sorteio. Já "ed fis" tem duas
  // palavras confirmando uma à outra, e aí duas letras cada bastam.
  const minimo = a.length === 1 ? 3 : 2
  return a.every((p, i) => p.length >= minimo && (b[i] ?? '').startsWith(p))
}

/** O quanto essa forma escrita parece ser esse nome. 0 = não parece. */
function forca(
  alvo: string,
  forma: string,
  ehApelido: boolean,
  idioma: Idioma,
): { v: number; por: Casamento['por'] } {
  if (forma === alvo) return { v: ehApelido ? 0.9 : 1, por: ehApelido ? 'apelido' : 'nome' }
  // "português" e "lpo" não são a mesma palavra abreviada — são duas siglas
  // diferentes para a mesma matéria. Isso só o dicionário resolve, e o
  // dicionário é por idioma — sigla de escola americana não deveria casar
  // matéria digitada em português, e vice-versa.
  if (mesmoGrupoDeMateria(alvo, forma, idioma)) return { v: 0.85, por: 'apelido' }
  if (casaPorPedacos(alvo, forma)) return { v: 0.8, por: 'abreviacao' }
  const semEspaco = alvo.replace(/ /g, '')
  if (semEspaco.length >= 2 && iniciaisDe(forma) === semEspaco) {
    return { v: 0.7, por: 'abreviacao' }
  }
  // Prefixo só a partir de três letras: com duas, "ma" casaria com meio
  // dicionário e a decisão viraria chute.
  if (alvo.length >= 3 && (forma.startsWith(alvo) || alvo.startsWith(forma))) {
    return { v: 0.75, por: 'prefixo' }
  }
  return { v: 0, por: 'prefixo' }
}

/**
 * Quem é a matéria desse nome. Devolve os candidatos, do mais provável ao menos,
 * porque a tela precisa oferecer escolha quando o topo não convence.
 */
export function casarMateria(nome: string, materias: Materia[], idioma: Idioma = 'pt'): Casamento[] {
  const alvo = normalizar(nome)
  if (alvo === '') return []

  const saida: Casamento[] = []
  for (const m of materias) {
    if (m.removido) continue
    const formas: [string, boolean][] = [
      [normalizar(m.nome), false],
      ...(m.apelidos ?? []).map((a) => [normalizar(a), true] as [string, boolean]),
    ]
    let melhor: { v: number; por: Casamento['por'] } = { v: 0, por: 'prefixo' }
    for (const [forma, ehApelido] of formas) {
      const f = forca(alvo, forma, ehApelido, idioma)
      if (f.v > melhor.v) melhor = f
    }
    if (melhor.v > 0) saida.push({ materia: m, confianca: melhor.v, por: melhor.por })
  }

  return saida.sort(
    (a, b) => b.confianca - a.confianca || a.materia.nome.localeCompare(b.materia.nome),
  )
}

export type Resolucao =
  | { tipo: 'achou'; materia: Materia; por: Casamento['por'] }
  /** Achou candidatos, mas nenhum convincente. A tela PERGUNTA. */
  | { tipo: 'perguntar'; nome: string; candidatos: Materia[] }
  /** Nenhum candidato: é matéria nova. */
  | { tipo: 'nova'; nome: string }

/**
 * A decisão que o app toma sozinho, e a hora em que ele para e pergunta.
 *
 * Empate no topo também vira pergunta: com "Bio" casando "Biologia" e
 * "Bioquímica" pelo mesmo valor, escolher uma seria sorteio disfarçado de
 * inteligência.
 */
export function resolverMateria(
  nome: string,
  base: { materias: Record<string, Materia> },
  idioma: Idioma = 'pt',
): Resolucao {
  const candidatos = casarMateria(nome, vivos(base.materias), idioma)
  const melhor = candidatos[0]
  if (!melhor) return { tipo: 'nova', nome }

  const empatou = candidatos[1]?.confianca === melhor.confianca
  if (melhor.confianca >= CONFIANCA_MINIMA && !empatou) {
    return { tipo: 'achou', materia: melhor.materia, por: melhor.por }
  }
  return { tipo: 'perguntar', nome, candidatos: candidatos.map((c) => c.materia) }
}

/** Guarda o nome que a pessoa usou, para não perguntar de novo amanhã. */
export function comApelido(m: Materia, nome: string): Materia {
  const jaTem = [m.nome, ...(m.apelidos ?? [])].some((n) => normalizar(n) === normalizar(nome))
  return jaTem ? m : { ...m, apelidos: [...(m.apelidos ?? []), nome.trim()] }
}

/**
 * Isto tem cara de nome de matéria, ou é lixo de OCR grudado no resto do
 * texto?
 *
 * Achado em 04/09/2026: uma foto de portal escolar ("Sala de Aula") deixou
 * passar "Aula MIGUEL RAMTHUN MORETTI / ENSINO F... • Tarefa de Ciências
 * Postado por Fiama Cristina Kern Kava •" como se fosse nome de matéria — e
 * o app ofereceu "Criar" aquilo. Nome de matéria de verdade é curto e não
 * carrega "•" (marcador de lista), "Postado por" nem barra de navegação —
 * quando aparece algo assim, é melhor dizer "não sei" do que oferecer criar
 * uma matéria com o cabeçalho da tela inteiro.
 */
export function pareceNomeDeMateria(nome: string): boolean {
  const limpo = nome.trim()
  if (limpo.length === 0 || limpo.length > 40) return false
  if (limpo.includes('•') || /postado por/i.test(limpo)) return false
  return limpo.split(/\s+/).length <= 6
}
