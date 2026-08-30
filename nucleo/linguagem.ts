// Entender uma frase solta e virar compromisso.
//
// É a peça que os TRÊS jeitos de anotar compartilham: digitar corrido, falar, e
// fotografar o papel. Todos terminam em texto, e todos passam por aqui — assim
// a foto e a voz não ganham regras próprias para divergir depois.
//
// A regra que manda: quando não tiver certeza, dizer que não tem. Uma prova
// marcada no dia errado é pior do que uma pergunta a mais.

import type { DataISO, Hora, Idioma, TipoCompromisso } from './modelo.ts'

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

/**
 * Lê a frase e devolve o que dá para afirmar.
 *
 * `agora` entra como parâmetro (e não `new Date()`) porque "sexta que vem"
 * depende de que dia é hoje, e um interpretador que lê o relógio por dentro não
 * tem como ser testado.
 */
export function interpretar(_texto: string, _agora: Date, _idioma: Idioma): Interpretacao {
  throw new Error(NAO_IMPLEMENTADO)
}
