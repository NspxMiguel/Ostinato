// Quando a IA do aparelho entra — e, mais importante, quando ela NÃO entra.
//
// Ele desenhou a condição em 30/08/2026: *"ia local. pensei em colocar em 2
// ocasioes, no colar horario, e no enviar foto de tarefa, mas com uma condição,
// letra manuscrita ou texto rasurado. pq isso nao da pra ler direito. ja letra
// de computador, prints eu imagino q de de boa."*
//
// A condição está certa e é a parte difícil deste arquivo. Para print e texto
// de computador o Vision já acerta, é determinístico e instantâneo; passar isso
// por um modelo só adiciona chance de ele INVENTAR uma aula que não estava na
// foto — e uma aula inventada num horário escolar é pior que uma aula faltando,
// porque ninguém confere o que parece certo.
//
// O sinal que separa os dois casos é a CONFIANÇA do Vision, que o módulo de
// leitura agora devolve. Letra de mão e texto rasurado derrubam ela; print não.
// É medição, não adivinhação sobre o que a pessoa fotografou.
//
// E o modelo nunca devolve estrutura: ele devolve TEXTO NORMALIZADO, que volta
// para o mesmo `importarGrade` de sempre. O algoritmo continua sendo o dono da
// leitura, e o modelo vira só um tradutor de bagunça para tabela.
//
// Puro, sem I/O: dá para testar a decisão inteira sem aparelho e sem modelo.

/** Abaixo disto o OCR está claramente apanhando da letra. */
export const CONFIANCA_BAIXA = 0.62

/**
 * Vale chamar o modelo para este horário?
 *
 * Duas portas, e as duas precisam estar abertas:
 *
 *  1. o OCR sofreu (confiança baixa) — é a condição dele, letra de mão ou rasura;
 *  2. o algoritmo REALMENTE não deu conta — poucas aulas, muita linha ignorada.
 *
 * A segunda porta existe porque foto ruim que ainda assim foi lida certa não
 * precisa de resgate: gastar o modelo ali só atrasa e arrisca.
 */
export function precisaDeResgateDeGrade(sinais: {
  confianca: number
  aulas: number
  ignoradas: number
}): boolean {
  const { confianca, aulas, ignoradas } = sinais
  if (confianca >= CONFIANCA_BAIXA) return false
  if (aulas === 0) return true
  // Mais lixo que aula lida: a tabela não fechou.
  return ignoradas > aulas
}

/**
 * Vale chamar o modelo para esta foto de tarefa?
 *
 * Aqui não há "aulas lidas" para medir, então sobra a confiança e o tamanho: um
 * texto de duas palavras mal lido não tem o que resgatar, e um vazio menos ainda.
 */
export function precisaDeResgateDeTarefa(sinais: { confianca: number; texto: string }): boolean {
  if (sinais.confianca >= CONFIANCA_BAIXA) return false
  return sinais.texto.trim().length >= 8
}

/**
 * O que o modelo pode fazer, dito no negativo.
 *
 * Modelo pequeno obedece proibição melhor do que obedece descrição, e a
 * proibição que importa é uma só: não inventar o que não estava na imagem.
 */
export function instrucoesDeGrade(): string {
  return [
    'Você conserta texto de OCR de um horário escolar fotografado.',
    'A foto tinha letra de mão ou rasura, então o texto chegou quebrado.',
    'Devolva SOMENTE a tabela corrigida, uma aula por linha, colunas separadas por TAB:',
    'DIA<TAB>HH:MM<TAB>HH:MM<TAB>MATÉRIA',
    'Regras absolutas:',
    '- não invente aula, matéria nem horário que não esteja no texto;',
    '- linha que você não entender, apague em vez de chutar;',
    '- não escreva explicação, comentário, título nem marcação de código.',
  ].join('\n')
}

/** Idem para a foto de tarefa: uma tarefa por linha, sem enfeite. */
export function instrucoesDeTarefa(): string {
  return [
    'Você conserta texto de OCR de uma anotação escolar fotografada.',
    'A foto tinha letra de mão ou rasura, então o texto chegou quebrado.',
    'Devolva SOMENTE as tarefas, uma por linha, em português, na forma:',
    'matéria — o que fazer — quando',
    'Regras absolutas:',
    '- não invente tarefa, data nem matéria que não esteja no texto;',
    '- linha que você não entender, apague em vez de chutar;',
    '- não escreva explicação, comentário, título nem marcação de código.',
  ].join('\n')
}

/**
 * Limpa o que o modelo devolveu.
 *
 * Modelo instruído a não escrever marcação escreve marcação assim mesmo, e uma
 * cerca de código sobrando faz o `importarGrade` ignorar a primeira e a última
 * linha sem dizer por quê.
 */
export function limparResposta(bruto: string): string {
  return bruto
    .replace(/^\s*```[a-z]*\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .split('\n')
    .filter((l) => !/^\s*(aqui está|here is|segue|resultado:)/i.test(l))
    .join('\n')
    .trim()
}

/**
 * O resgate melhorou de verdade?
 *
 * O modelo só vence quando lê MAIS aula que o algoritmo sozinho. Empate fica
 * com o algoritmo — ele é determinístico, e determinístico é o que dá para
 * depurar quando ele erra.
 */
export function vale(antes: { aulas: number }, depois: { aulas: number }): boolean {
  return depois.aulas > antes.aulas
}

// ---------------------------------------------------------------------------
// A frase da captura — ditada ou digitada.
//
// Pedido dele em 30/08/2026: *"tbm usar ia, quando tiver ,uito complicado de
// entender oq o cara falou ou escreveu pra agenda.."*
//
// Aqui o sinal já existia e é melhor que o da foto: o interpretador devolve uma
// CONFIANÇA e a lista do que ficou faltando. Não é preciso adivinhar se a frase
// era difícil — ele diz.
//
// E vale a mesma disciplina da foto, por um motivo mais forte ainda: o modelo
// não resolve data. Ele reescreve a frase mantendo "sexta", "amanhã", "próxima
// aula" do jeito que estão, e quem converte isso em dia do calendário continua
// sendo `linguagem.ts`. Modelo de aparelho errando aritmética de calendário é
// comum, e uma prova marcada no dia errado é pior que uma prova sem data.

/** O mesmo corte que a tela já usa para decidir abrir o formulário. */
export const CONFIANCA_DE_FRASE = 0.5

/**
 * Vale chamar o modelo para esta frase?
 *
 * Frase curta não entra: "mat" tem confiança baixa por não dizer nada, e não há
 * o que reescrever — o que falta ali é informação, não clareza.
 */
export function precisaDeResgateDeFrase(sinais: {
  confianca: number
  faltando: readonly string[]
  texto: string
}): boolean {
  if (sinais.texto.trim().length < 12) return false
  if (sinais.confianca < CONFIANCA_DE_FRASE) return true
  // Confiança alta mas com título e matéria perdidos é sinal de frase torta:
  // o interpretador achou uma data e se apoiou nela.
  return sinais.faltando.includes('materia') && sinais.faltando.includes('titulo')
}

/**
 * As instruções para reescrever a frase.
 *
 * O exemplo vale mais que a explicação para um modelo pequeno, e por isso vem
 * um de entrada e um de saída — inclusive um com fala hesitante, que é o caso
 * do ditado.
 */
export function instrucoesDeFrase(): string {
  return [
    'Você reescreve uma frase bagunçada sobre uma tarefa escolar.',
    'Devolva UMA linha só, na forma: <tipo> de <matéria> para <quando> - <o que fazer>',
    'Exemplo de entrada: "ahn tipo... o professor de bio passou uns exercício pra sexta"',
    'Exemplo de saída: tarefa de biologia para sexta - exercícios',
    'Regras absolutas:',
    '- NÃO calcule datas: mantenha "amanhã", "sexta", "semana que vem" como estão;',
    '- não invente matéria, prazo nem tipo que não esteja na frase;',
    '- se a frase não disser quando, omita a parte do "para";',
    '- não escreva explicação, comentário nem marcação de código.',
  ].join('\n')
}
