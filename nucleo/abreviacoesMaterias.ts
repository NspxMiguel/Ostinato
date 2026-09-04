// O dicionário de gírias e abreviações de matéria escolar brasileira.
//
// Pedido dele em 04/09/2026: cadastrou as matérias conforme o cronograma da
// escola — que usa a sigla oficial ("LPO") — e quer poder falar "português" na
// captura e o app saber que é a mesma coisa. `casarMateria` já casa nome exato,
// apelido salvo, abreviação por pedaços ("ed fis" → "educação física") e
// iniciais ("EF"), mas nenhum desses métodos GENÉRICOS liga "português" a
// "LPO": não são a mesma palavra abreviada, são duas siglas DIFERENTES para o
// mesmo assunto, e só um dicionário resolve isso — não tem algoritmo.
//
// Cada grupo é um conjunto de formas que significam a MESMA matéria. Todas já
// vêm em minúsculo e sem acento — a forma que `normalizar()` produz — porque
// quem chama (`materias.ts`) já normalizou os dois lados antes de comparar, e
// duplicar a normalização aqui só daria chance de os dois ficarem diferentes.
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
export const GRUPOS_DE_MATERIA: readonly (readonly string[])[] = [
  ['lingua portuguesa', 'portugues', 'lpo', 'lp', 'vernacula', 'gramatica'],
  ['educacao fisica', 'edfis', 'ef', 'ginastica'],
  ['ingles', 'li', 'lem'],
  ['espanhol', 'le', 'lem'],
  ['artes', 'ed art', 'educacao artistica'],
  ['ensino religioso', 'religiao', 'er'],
  ['informatica', 'tic', 'computacao'],
]

/**
 * `alvo` e `forma` significam a mesma matéria pelo dicionário?
 *
 * Os dois já chegam normalizados (minúsculo, sem acento) — é assim que
 * `materias.ts` os produz antes de comparar. Igualdade exata não entra aqui:
 * quem chama já testa isso antes, com confiança maior.
 */
export function mesmoGrupoDeMateria(alvo: string, forma: string): boolean {
  if (alvo === forma) return false
  return GRUPOS_DE_MATERIA.some((grupo) => grupo.includes(alvo) && grupo.includes(forma))
}
