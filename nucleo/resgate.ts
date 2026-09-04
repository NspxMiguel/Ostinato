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
  // NENHUMA aula lida chama o modelo, e a confiança não entra aqui.
  //
  // Esta linha corrige um erro meu. Eu tinha posto a confiança como primeira
  // porta para todos os casos, mas ela mede se as LETRAS foram lidas — não se a
  // TABELA foi entendida. Um horário impresso fotografado torto tem confiança
  // alta e estrutura destruída: o Vision lê cada palavra perfeitamente e as
  // colunas viram sopa. Era exatamente esse caso que ficava de fora, e é o mais
  // comum de todos. Com zero aula lida não há nada a perder chamando o modelo.
  if (aulas === 0) return true
  if (confianca >= CONFIANCA_BAIXA) return false
  // Mais lixo que aula lida: a tabela não fechou.
  return ignoradas > aulas
}

/**
 * Vale chamar o modelo para esta foto de tarefa?
 *
 * A confiança do Vision NÃO entra aqui — e essa é a correção. Ele mede se as
 * LETRAS foram lidas certo, não se a foto é uma anotação de uma tarefa só. Uma
 * foto de "Sala de Aula" (portal da escola, várias tarefas, nome do aluno,
 * professor, datas — tudo junto na mesma página) tem confiança ALTA porque
 * cada caractere foi lido perfeitamente, e mesmo assim vira um bloco só,
 * ilegível, com o nome do aluno grudado na primeira "tarefa" — foi
 * exatamente o que aconteceu em 04/09/2026: confiança alta, gate pulou a IA,
 * o texto cru (uma página inteira) foi parar direto no campo.
 *
 * Diferente da grade (`precisaDeResgateDeGrade`), aqui não existe algoritmo
 * fazendo o papel de juiz — não há "aulas lidas" para comparar. Por isso toda
 * foto de tarefa passa pela IA quando ela existe: o único filtro que sobra é
 * ter texto de verdade pra resgatar.
 */
export function precisaDeResgateDeTarefa(sinais: { confianca: number; texto: string }): boolean {
  return sinais.texto.trim().length >= 8
}

/**
 * O que o modelo pode fazer, dito no negativo.
 *
 * Modelo pequeno obedece proibição melhor do que obedece descrição, e a
 * proibição que importa é uma só: não inventar o que não estava na imagem.
 */
/**
 * A grade como o Vision a viu, em texto que preserva a forma.
 *
 * Uma célula por coluna, separada por ` | `, uma linha por linha do quadro. É
 * feio de ler e é exatamente o ponto: o modelo recebe a POSIÇÃO de cada coisa,
 * que é o que se perdia quando eu entregava o texto achatado.
 *
 * Célula vazia vira `-` em vez de sumir. Sem isso, uma linha com buraco no meio
 * — o intervalo, o dia sem aula — encurta e as colunas desalinham a partir dali,
 * que é o erro mais caro possível num horário: a aula certa no dia errado.
 */
export function tabelaComoTexto(tabela: readonly (readonly string[])[]): string {
  return tabela
    .map((linha) => linha.map((c) => (c.trim() === '' ? '-' : c.trim())).join(' | '))
    .join('\n')
}

export function instrucoesDeGrade(): string {
  return [
    'Você lê um horário escolar que já foi reconhecido como TABELA.',
    'Cada linha abaixo é uma linha do quadro; as colunas vêm separadas por " | " e "-" é célula vazia.',
    'Normalmente a primeira linha é o cabeçalho com os dias, e a primeira coluna é o horário.',
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
    'Pode ser letra de mão, rasura, OU um print de portal/app da escola (tipo',
    '"Google Classroom" ou "Sala de Aula") com menu, cabeçalho, nome do aluno,',
    'nome do professor e "Postado por" misturados com a tarefa de verdade.',
    'Devolva as tarefas, UMA POR LINHA, na forma:',
    'matéria — o que fazer — quando',
    'Regras absolutas:',
    '- NUNCA inclua nome de aluno, nome de professor, "Postado por" nem',
    '  cabeçalho/menu de página no resultado — isso não é a tarefa, é moldura da tela;',
    '- se o texto tiver VÁRIAS tarefas, devolva TODAS, uma por linha — nunca',
    '  descarte uma tarefa real pra sobrar só uma;',
    '- nome de plataforma ou material da escola (ex.: "Eureka", "SAS",',
    '  apostila, capítulo) É PARTE da tarefa, não é moldura — nunca apague;',
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

// ---------------------------------------------------------------------------
// A conversão do que o modelo devolve.
//
// Mora aqui, e não na tela, porque é onde um erro de UM dia jogaria a semana
// inteira para o lugar errado — e sem nada na tela indicando isso: as aulas
// apareceriam, bonitas, na segunda em vez do domingo.
//
// O modelo responde 1 = segunda … 7 = domingo, que é o ISO e é o que faz
// sentido pedir a ele. O app usa 0 = domingo … 6 = sábado, que é o do
// JavaScript. `% 7` faz a ponte, e o único caso que importa é o domingo.

/** Dia 1..7 como o modelo foi instruído a devolver. */
export function diaValido(n: unknown): boolean {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 7
}

/** "HH:MM" de verdade — o modelo às vezes escreve "8h" ou "das 8". */
export function horaValida(h: unknown): boolean {
  return typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h)
}

/** 1 = segunda … 7 = domingo  →  0 = domingo … 6 = sábado. */
export function diaDoModeloParaApp(dia: number): number {
  return dia % 7
}

/**
 * O caminho de volta: texto com `|` vira tabela outra vez.
 *
 * Existe por um defeito que só apareceu ao TESTAR o colar no simulador. A
 * grade que a foto produz é mostrada no campo como `07:25 | ERE | ALE`, e a
 * pessoa pode colar exatamente isso — mas a regra fechada só era consultada
 * quando a grade vinha no vetor da leitura. Texto colado, ainda que fosse a
 * mesma grade, ia direto para o modelo: mais lento, e capaz de inventar.
 *
 * Duas colunas no mínimo, senão qualquer frase com uma barra viraria tabela.
 */
export function tabelaDoTexto(texto: string): string[][] {
  const linhas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('|'))
  if (linhas.length < 2) return []
  const tabela = linhas.map((l) => l.split('|').map((c) => (c.trim() === '-' ? '' : c.trim())))
  return tabela.every((l) => l.length >= 2) ? tabela : []
}
