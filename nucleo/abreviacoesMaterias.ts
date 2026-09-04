// O dicionário de gírias e abreviações de matéria escolar — um por idioma.
//
// Pedido dele em 04/09/2026: cadastrou as matérias conforme o cronograma da
// escola — que usa a sigla oficial ("LPO") — e quer poder falar "português" na
// captura e o app saber que é a mesma coisa. `casarMateria` já casa nome exato,
// apelido salvo, abreviação por pedaços ("ed fis" → "educação física") e
// iniciais ("EF"), mas nenhum desses métodos GENÉRICOS liga "português" a
// "LPO": não são a mesma palavra abreviada, são duas siglas DIFERENTES para o
// mesmo assunto, e só um dicionário resolve isso — não tem algoritmo.
//
// Pedido de novo, no mesmo dia, ao ver que só existia em português: *"faz
// dicionario de pelo menos umas 20 linguas ai, pra todo mundo pode usa de
// boa, na vdd so as q tem nosso app ne"* — corrigido por ele mesmo na
// sequência para os quatro idiomas que o app já suporta (`Idioma` em
// modelo.ts), não vinte: escrever gíria de matéria para um idioma que o app
// não fala não serve pra ninguém, porque não tem como digitar nele.
//
// Cada grupo é um conjunto de formas que significam a MESMA matéria NAQUELE
// idioma. Todas já vêm em minúsculo e sem acento — a forma que `normalizar()`
// produz — porque quem chama (`materias.ts`) já normalizou os dois lados
// antes de comparar, e duplicar a normalização aqui só daria chance de os
// dois ficarem diferentes.
//
// Deliberadamente CONSERVADOR, e mais que isso: só entra aqui a sigla que o
// algoritmo genérico (`forca` em materias.ts — prefixo, iniciais, pedaço) NÃO
// alcança sozinho. "mat" já casa "matemática" por prefixo, "geo" já casa
// "geografia" por prefixo — e foi exatamente "geo" que pegou o teste: com
// Geografia E Geometria cadastradas, as duas casam "geo" por prefixo com a
// MESMA confiança (0.75), e a tela pergunta ao invés de chutar. Pôr "geo" no
// dicionário com confiança mais alta destruía esse empate de propósito e o
// app decidia sozinho entre duas matérias reais — o oposto do que a regra
// deste arquivo inteiro pede ("quando não tiver certeza, diz que não tem").
// Por isso: só entra aqui a sigla que NÃO é prefixo, iniciais nem pedaço do
// nome — é outra PALAVRA para a mesma coisa, que só um dicionário resolve.
// A mesma disciplina vale nos quatro idiomas — e por isso cada lista aqui é
// mais curta que "todo apelido que a escola usa": abreviação óbvia (three
// letras que começam igual ao nome) o algoritmo já resolve sozinho.
import type { Idioma } from './modelo.ts'

const PT: readonly (readonly string[])[] = [
  ['lingua portuguesa', 'portugues', 'lpo', 'lp', 'vernacula', 'gramatica'],
  ['educacao fisica', 'edfis', 'ef', 'ginastica'],
  ['ingles', 'li', 'lem'],
  ['espanhol', 'le', 'lem'],
  ['artes', 'ed art', 'educacao artistica'],
  ['ensino religioso', 'religiao', 'er'],
  ['informatica', 'tic', 'computacao'],
]

/**
 * Inglês (EUA/Reino Unido): as siglas de boletim americano não são prefixo
 * do nome ("PE" não começa com "phys ed" nem "physical education", "ELA" não
 * começa com "english language arts" pelas regras de iniciais porque
 * `iniciaisDe` já cobriria isso — o que falta é o SINÔNIMO, "language arts"
 * por "english").
 */
const EN: readonly (readonly string[])[] = [
  ['physical education', 'pe', 'gym'],
  ['english', 'language arts', 'ela'],
  ['mathematics', 'math', 'maths'],
  ['social studies', 'humanities'],
  ['computer science', 'cs', 'ict'],
  ['foreign language', 'world language', 'modern language'],
]

/**
 * Espanhol: o mesmo padrão do português, com as siglas que a escola de
 * língua espanhola usa em vez das brasileiras.
 */
const ES: readonly (readonly string[])[] = [
  ['lengua castellana', 'lengua', 'castellano', 'lc'],
  ['educacion fisica', 'ed fis', 'ef', 'gimnasia'],
  ['ingles', 'li'],
  ['ciencias sociales', 'sociales'],
  ['ciencias naturales', 'naturales', 'ccnn'],
  ['informatica', 'tic', 'computacion'],
  ['religion', 'er'],
]

/**
 * Francês: siglas do sistema escolar francês, que são iniciais de uma frase
 * inteira — "SVT" não é iniciais de "biologie", é iniciais de "sciences de
 * la vie et de la terre", que é como a matéria se chama lá.
 */
const FR: readonly (readonly string[])[] = [
  ['sciences de la vie et de la terre', 'svt', 'biologie'],
  ['education physique et sportive', 'eps', 'sport'],
  ['francais', 'lettres'],
  ['mathematiques', 'maths'],
  ['sciences economiques et sociales', 'ses', 'economie'],
  ['technologie', 'techno'],
  ['langue vivante', 'lv', 'lv1', 'lv2'],
]

const GRUPOS_POR_IDIOMA: Record<Idioma, readonly (readonly string[])[]> = {
  pt: PT,
  en: EN,
  es: ES,
  fr: FR,
}

/**
 * `alvo` e `forma` significam a mesma matéria pelo dicionário do idioma
 * dado?
 *
 * Os dois já chegam normalizados (minúsculo, sem acento) — é assim que
 * `materias.ts` os produz antes de comparar. Igualdade exata não entra aqui:
 * quem chama já testa isso antes, com confiança maior.
 */
export function mesmoGrupoDeMateria(alvo: string, forma: string, idioma: Idioma): boolean {
  if (alvo === forma) return false
  return GRUPOS_POR_IDIOMA[idioma].some((grupo) => grupo.includes(alvo) && grupo.includes(forma))
}
