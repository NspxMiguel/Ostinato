// A grade em tabela vira aulas, sem modelo nenhum.
//
// Isto existe por uma MEDIÇÃO, e não por palpite. Depois de errar três vezes no
// escuro, rodei o Vision na foto do horário dele e olhei a saída crua: as
// colunas saem limpas e bem separadas — SEG em x=0,29, TER em 0,43, QUA em
// 0,57, QUI em 0,72, SEX em 0,87 — e a reconstrução por coordenadas devolve a
// grade certa, linha por linha.
//
// Ou seja: o modelo estava compensando uma entrada que eu tinha quebrado. Com a
// grade correta, um horário escolar é a coisa mais determinística que existe —
// uma linha de cabeçalho com os dias, uma coluna de horários, e o resto são
// células. Regra fechada resolve, e resolve igual todas as vezes.
//
// O modelo continua existindo para a grade que não tem essa forma. Mas ele
// deixa de ser o caminho normal, porque para o caminho normal ele é pior: mais
// lento, e capaz de inventar.

import type { AulaCrua } from './importarGrade.ts'

/** Os dias da semana como as escolas escrevem, nos quatro idiomas do app. */
const DIAS: [RegExp, number][] = [
  [/^(dom|sun|domingo|sunday|dim)/i, 0],
  [/^(seg|mon|segunda|monday|lun)/i, 1],
  [/^(ter|tue|terca|terça|tuesday|mar)/i, 2],
  [/^(qua|wed|quarta|wednesday|mie|mié|mer)/i, 3],
  [/^(qui|thu|quinta|thursday|jue|jeu)/i, 4],
  [/^(sex|fri|sexta|friday|vie|ven)/i, 5],
  [/^(sab|sáb|sat|sabado|sábado|saturday|sam)/i, 6],
]

function diaDe(texto: string): number | null {
  const t = texto.trim()
  if (t === '') return null
  for (const [re, n] of DIAS) if (re.test(t)) return n
  return null
}

/**
 * Duas horas numa célula: "07:25-08:00", "07:25 - 08:00", "7h25 às 8h".
 *
 * O separador é qualquer coisa que não seja dígito nem `:` — no OCR ele vem
 * como hífen, travessão, "às", ou some junto com um espaço perdido.
 */
export function horasDaCelula(texto: string): { inicio: string; fim: string } | null {
  const achadas = [...texto.matchAll(/(\d{1,2})\s*[:hH]\s*(\d{2})/g)].map(
    (m) => `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`,
  )
  if (achadas.length < 2) return null
  return { inicio: achadas[0]!, fim: achadas[1]! }
}

/** Uma hora só na célula, para o reparo de linha mutilada. */
function umaHoraDaCelula(texto: string): string | null {
  const m = texto.match(/(\d{1,2})\s*[:hH]\s*(\d{2})/)
  return m ? `${String(Number(m[1])).padStart(2, '0')}:${m[2]}` : null
}

/** Onde estão os dias: a linha com mais nomes de dia da semana. */
function linhaDoCabecalho(tabela: readonly (readonly string[])[]): number {
  let melhor = -1
  let quantos = 0
  tabela.forEach((linha, i) => {
    const n = linha.filter((c) => diaDe(c) !== null).length
    if (n > quantos) {
      quantos = n
      melhor = i
    }
  })
  // Menos de dois dias não é cabeçalho: é uma célula que por acaso começa com
  // "seg" — "seguranca do trabalho" é matéria de verdade em escola técnica.
  return quantos >= 2 ? melhor : -1
}

/**
 * Lê a grade. Devolve vazio quando ela não tem a forma de horário — e aí quem
 * chama passa a bola para o modelo.
 */
export function aulasDaTabela(tabela: readonly (readonly string[])[]): AulaCrua[] {
  const cabecalho = linhaDoCabecalho(tabela)
  if (cabecalho < 0) return []

  // Que coluna é que dia. A coluna do horário fica de fora naturalmente: ela
  // não casa com nenhum nome de dia.
  const diaDaColuna = new Map<number, number>()
  tabela[cabecalho]!.forEach((c, i) => {
    const d = diaDe(c)
    if (d !== null) diaDaColuna.set(i, d)
  })

  const saida: AulaCrua[] = []
  /** O fim da última linha lida, para reparar a próxima se ela vier quebrada. */
  let ultimoFim: string | null = null
  for (let i = cabecalho + 1; i < tabela.length; i++) {
    const linha = tabela[i]!
    // O horário da linha: a primeira célula que tenha duas horas. Quase sempre
    // é a primeira coluna, mas há escola que põe o horário no fim.
    let horas = linha.map(horasDaCelula).find((h) => h !== null) ?? null

    // Uma hora só, e a anterior terminou: a linha herda o fim da de cima.
    //
    // Isto não é chute, é uma propriedade que horário escolar TEM: as faixas
    // são contíguas, uma começa onde a outra acabou. E é o que salva a linha
    // que o OCR mutilou — na foto dele, "08:00 - 08:45" chegou como
    // ":00 - 08:45", e sem isto as cinco aulas daquela linha sumiam CALADAS,
    // que é o pior desfecho: a grade fica com um buraco e ninguém percebe.
    if (!horas && ultimoFim) {
      const uma = linha.map(umaHoraDaCelula).find((h) => h !== null)
      if (uma && uma > ultimoFim) horas = { inicio: ultimoFim, fim: uma }
    }
    if (!horas) continue
    ultimoFim = horas.fim

    for (const [coluna, dia] of diaDaColuna) {
      const materia = (linha[coluna] ?? '').trim()
      // Célula vazia é intervalo ou dia sem aula. Célula que é só pontuação
      // também: o OCR devolve "-" e "—" onde o papel tinha uma linha.
      if (materia === '' || /^[-–—.·]+$/.test(materia)) continue
      saida.push({
        diaSemana: dia as AulaCrua['diaSemana'],
        inicio: horas.inicio as AulaCrua['inicio'],
        fim: horas.fim as AulaCrua['fim'],
        materia,
        confianca: 1,
      })
    }
  }
  return saida
}
