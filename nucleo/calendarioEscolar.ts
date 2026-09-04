// Filtrar o calendário que a escola publica.
//
// O calendário de uma escola tem dezenas de linhas e a maioria não é sobre o
// aluno: "Retorno zeladores", "Início direção coordenações", "Formação para
// auxiliares de classe". Importar tudo enche a agenda de ruído; importar de
// menos esconde um feriado e o app passa a marcar tarefa para um dia sem aula.
//
// A CHAVE é não classificar por assunto. "Reunião" não diz nada: reunião de pais
// interessa, reunião de planejamento não. A pergunta que separa é sempre a
// mesma:
//
//     ISSO MUDA O MEU DIA?
//
// E ela tem só três respostas possíveis — não tem aula, tenho que estar lá, ou
// não é comigo. Repare que "Recesso escolar dos professores" é evento de
// funcionário e mesmo assim vira "não tem aula" para o aluno: o que manda é o
// EFEITO, não de quem é o evento.
//
// Nada aqui apaga linha sozinho. A função classifica e diz por quê; quem decide
// é a tela, mostrando o que vai entrar e o que vai ficar de fora.

import type { Papel } from './modelo.ts'

export type { Papel }

export type EfeitoNoDia =
  /** Não tem aula: feriado, recesso, escola fechada. Vira feriado do período. */
  | 'semAula'
  /** Uma avaliação: prova, simulado, recuperação. */
  | 'avaliacao'
  /** Presença esperada: reunião de pais, entrega de boletim. */
  | 'presenca'
  /** Acontece na escola e é aberto: festa, palestra, feira. */
  | 'evento'
  /** Primeiro dia de aula do ano ou do segmento. Marco, não vira feriado. */
  | 'inicioAula'
  /** Último dia de aula do ano ou do segmento. */
  | 'fimAula'
  /** Começa um trimestre, bimestre ou semestre. */
  | 'inicioPeriodoLetivo'
  /** Termina um trimestre, bimestre ou semestre. */
  | 'fimPeriodoLetivo'
  /** Assunto de quem trabalha lá. Não entra, mas continua visível na lista. */
  | 'interno'

export type LinhaClassificada = {
  texto: string
  efeito: EfeitoNoDia
  /** As séries citadas na linha. Vazio = vale para a escola inteira. */
  series: string[]
  /** Para quem a linha é dirigida, quando dá para saber. */
  para: Papel | 'escola' | 'funcionarios'
  /** A frase que explica a decisão. Vai para a tela: filtro sem porquê é magia. */
  porque: string
}

function normal(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Cargos que aparecem no calendário e nunca descrevem um aluno. */
const CARGOS = [
  'zelador',
  'secretaria',
  'administrativ',
  'direcao',
  'coordena',
  'auxiliares de classe',
  'vigias',
  'recepcao',
  'colaboradores',
  'contratacao',
  'professores do contraturno',
  'plantao do contraturno',
]

/** O que fecha a escola, ou tira a aula, mesmo quando o evento é de funcionário. */
const FECHA_A_ESCOLA = [
  'feriado',
  'recesso',
  'ferias',
  'colegio fechado',
  'escola fechada',
  'sem aula',
  'ponto facultativo',
  'suspensao de aula',
  'nao havera aula',
  'nao tem aula',
]

const AVALIACAO = ['prova', 'simulado', 'avaliacao', 'recuperacao', 'exame', 'vestibular', 'enem']
const PRESENCA = ['reuniao de pais', 'entrega de boletim', 'conselho de classe com pais']

/**
 * Início e fim de aula, e de trimestre/bimestre/semestre.
 *
 * Vêm ANTES do teste de cargo por um motivo: "Início das aulas da 3ª série do
 * Ensino Médio" não cita cargo nenhum, mas sem esta lista caía em
 * "sem sinal" — e sumia da agenda de todo mundo, inclusive do próprio marco
 * que um aluno mais quer saber: quando começam as aulas dele.
 */
const INICIO_AULA = /inicio (?:d[aoe]s? )?aulas|inicio do ano letivo|retorno (?:as|para as) aulas|volta (?:as|às) aulas|primeiro dia de aula/
const FIM_AULA = /ultimo dia (?:de aula|letivo|d[oa] (?:ei|f1|f2|em|infantil|fundamental))/
const INICIO_PERIODO = /inicio (?:do|da) \d\s*[ºªo]?\s*(?:trimestre|bimestre|semestre)/
const FIM_PERIODO = /(?:fim|termino|encerramento) (?:do|da) \d\s*[ºªo]?\s*(?:trimestre|bimestre|semestre)/
/**
 * O que acontece na escola e o aluno quer saber.
 *
 * Esportivo entra junto por pedido dele: jogos internos, interclasse e
 * campeonato são exatamente o tipo de linha que o aluno procura no calendário e
 * que um filtro focado em "prova e feriado" descartaria.
 *
 * `retiro` fica de fora desta lista de propósito — no calendário da escola dele
 * ele aparece como "Retiro com todos os colaboradores", que é confraternização
 * de funcionário. Retiro DE ALUNO existe, e é por isso que a linha ainda passa
 * pelo teste de cargo antes: quem decide é quem está citado.
 */
const EVENTO = [
  'festa',
  'festival',
  'palestra',
  'feira',
  'mostra',
  'formatura',
  'gincana',
  'jogos',
  'interclasse',
  'campeonato',
  'torneio',
  'olimpiada',
  'amistoso',
  'excursao',
  'passeio',
  'acampamento',
  'apresentacao',
  'sarau',
  'aula de campo',
]

/**
 * As séries citadas no texto.
 *
 * Aceita as formas que a escola realmente escreve — "3ª série", "3o ano",
 * "Ensino Médio", "Educação Infantil", "Contraturno" — e devolve tudo em
 * minúsculas sem acento, que é como a comparação acontece.
 */
export function seriesCitadas(texto: string): string[] {
  const t = normal(texto)
  const achadas = new Set<string>()

  for (const m of t.matchAll(/(\d)\s*[ºoª]?\s*(?:serie|ano)/g)) achadas.add(`${m[1]}a serie`)
  // "do 2º e Ensino Médio" — o número solto ao lado de um segmento também conta.
  //
  // Sem `\b` no fim de propósito: `º` já é caractere de não-palavra, então não
  // existe fronteira entre ele e o espaço seguinte, e a âncora nunca casaria.
  // Negativo em "trimestre/bimestre/semestre": "2º trimestre" não é a 2ª
  // série, é um recorte de tempo do ano letivo — sem esta exceção "Início do
  // 2º trimestre" virava um evento só da 2ª série e sumia da agenda de todo
  // mundo mais.
  for (const m of t.matchAll(/(?:^|[^\d])(\d)\s*[ºª](?![\wº])(?!\s*(?:trimestre|bimestre|semestre))/g)) {
    achadas.add(`${m[1]}a serie`)
  }
  if (/ensino medio|\bem\b/.test(t)) achadas.add('ensino medio')
  if (/educacao infantil|infantil/.test(t)) achadas.add('educacao infantil')
  if (/fundamental/.test(t)) achadas.add('fundamental')
  if (/contraturno/.test(t)) achadas.add('contraturno')

  return [...achadas]
}

/**
 * O que uma linha do calendário significa para quem usa o app.
 *
 * A ordem das perguntas é o algoritmo, e ela não é arbitrária: "fecha a escola"
 * vem ANTES de "é assunto de funcionário" porque recesso de professor é as duas
 * coisas, e a que importa para o aluno é a primeira.
 */
export function classificar(texto: string): LinhaClassificada {
  const t = normal(texto)
  const series = seriesCitadas(texto)

  if (FECHA_A_ESCOLA.some((p) => t.includes(p))) {
    return {
      texto,
      efeito: 'semAula',
      series,
      para: 'escola',
      porque: 'nao-tem-aula',
    }
  }

  if (AVALIACAO.some((p) => t.includes(p))) {
    return { texto, efeito: 'avaliacao', series, para: 'aluno', porque: 'avaliacao' }
  }

  if (PRESENCA.some((p) => t.includes(p))) {
    return { texto, efeito: 'presenca', series, para: 'responsavel', porque: 'presenca-de-responsavel' }
  }

  // Marco de calendário — vem antes do teste de cargo: nenhum destes cita
  // função de funcionário, mas também não têm palavra de evento aberto, e sem
  // este bloco caíam direto em "sem sinal".
  if (INICIO_AULA.test(t)) {
    return { texto, efeito: 'inicioAula', series, para: 'escola', porque: 'inicio-de-aula' }
  }
  if (FIM_AULA.test(t)) {
    return { texto, efeito: 'fimAula', series, para: 'escola', porque: 'fim-de-aula' }
  }
  if (INICIO_PERIODO.test(t)) {
    return { texto, efeito: 'inicioPeriodoLetivo', series, para: 'escola', porque: 'inicio-de-periodo-letivo' }
  }
  if (FIM_PERIODO.test(t)) {
    return { texto, efeito: 'fimPeriodoLetivo', series, para: 'escola', porque: 'fim-de-periodo-letivo' }
  }

  if (CARGOS.some((p) => t.includes(p)) || /formacao (com|para|de) professores|reuniao de planejamento|formacao pedagogica/.test(t)) {
    return { texto, efeito: 'interno', series, para: 'funcionarios', porque: 'assunto-de-funcionario' }
  }

  // Este teste vem DEPOIS do de cargo: "Retiro com todos os colaboradores" é
  // confraternização de funcionário, e "Festa junina" é da escola. A diferença
  // está em quem a linha cita, não na palavra do evento.
  if (EVENTO.some((p) => t.includes(p))) {
    return { texto, efeito: 'evento', series, para: 'escola', porque: 'evento-aberto' }
  }

  // Sem sinal nenhum: fica de fora, mas visível. Descartar calado é como o app
  // perde a confiança de quem importou.
  return { texto, efeito: 'interno', series, para: 'escola', porque: 'sem-sinal' }
}

/**
 * A linha entra na agenda desta pessoa?
 *
 * `minhasSeries` são as séries dela — normalmente uma, mas um responsável com
 * dois filhos tem duas, e é por isso que é lista.
 */
export function ehParaMim(
  linha: LinhaClassificada,
  papel: Papel,
  minhasSeries: string[],
): boolean {
  if (linha.efeito === 'interno') return false

  // Reunião de pais não é do aluno, e prova não é do responsável — mas o
  // responsável PRECISA saber da prova do filho, então avaliação passa para os
  // dois. O contrário não vale: aluno não precisa da reunião de pais.
  if (linha.efeito === 'presenca' && papel !== 'responsavel') return false

  // Sem série citada, a linha é da escola inteira.
  if (linha.series.length === 0) return true

  const minhas = minhasSeries.map(normal)
  return linha.series.some((s) => minhas.includes(s))
}
