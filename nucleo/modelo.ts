// O contrato do Ostinato. Tudo — telas, avisos, sync — fala destes tipos.
//
// Regra que não se quebra: este arquivo (e todo o `nucleo/`) é TypeScript puro.
// Nada de `react-native` aqui dentro. É isso que faz o Android e a web saírem
// quase de graça mais tarde.

import type { Registro } from './sync/registro.ts'

/** 0 = domingo … 6 = sábado (mesma numeração de `Date.getDay()`). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** "13:30" — sempre 24h, sempre no fuso do aparelho. */
export type Hora = string

/** "2026-09-03" — data civil, sem fuso. */
export type DataISO = string

// ─── Período letivo ──────────────────────────────────────────────────────────

export type Periodo = Registro & {
  nome: string
  inicio: DataISO
  fim: DataISO
  /** Dias sem aula. A resolução de "próxima aula de X" pula estes. */
  feriados: DataISO[]
  ativo: boolean
}

// ─── Matéria e grade horária ─────────────────────────────────────────────────

export type Materia = Registro & {
  periodoId: string
  nome: string
  /**
   * Os outros nomes da MESMA matéria.
   *
   * A escola dele chama a mesma coisa de três jeitos: "Informática",
   * "Computação", "TI". O horário vem com um, o professor fala outro, e o
   * estudante escreve o terceiro. Sem isto, cada nome viraria uma matéria nova,
   * e as notas e faltas se dividiriam entre elas sem ninguém perceber.
   */
  apelidos: string[]
  /** hex, ex. "#E4572E". É a cor do item na agenda e na grade. */
  cor: string
  professor?: string
  sala?: string
  /** Total de aulas previstas no período. Sem isso não dá para calcular falta. */
  cargaHoraria?: number
  /** Percentual de falta permitido. 25 é o padrão brasileiro. */
  limiteFaltasPct: number
}

/** Escola que alterna semana A/B. "toda" é o caso comum. */
export type SemanaAlternada = 'toda' | 'par' | 'impar'

export type Aula = Registro & {
  materiaId: string
  diaSemana: DiaSemana
  inicio: Hora
  fim: Hora
  sala?: string
  semana: SemanaAlternada
}

// ─── Compromisso ─────────────────────────────────────────────────────────────

export const TIPOS_COMPROMISSO = [
  'tarefa',
  'prova',
  'trabalho',
  'leitura',
  'entrega',
  'outro',
] as const
export type TipoCompromisso = (typeof TIPOS_COMPROMISSO)[number]

/**
 * As duas formas de dizer quando vence. A segunda é o pedido dele: em vez de
 * abrir o calendário e procurar o dia da próxima aula de matemática, você diz
 * "na próxima aula de matemática" e o app resolve contra a grade.
 */
export type Vencimento =
  | { tipo: 'data'; data: DataISO; hora?: Hora }
  | { tipo: 'aula'; materiaId: string; ocorrencia: number }

export const MODOS_AVISO = ['normal', 'insistente', 'alarme'] as const
export type ModoAviso = (typeof MODOS_AVISO)[number]

export type RegraAviso = {
  id: string
  /**
   * `diasAntes` é o "me avisa 3 dias antes, às 20h" — dia cheio, hora fixa.
   * `antesDe` é o "me avisa 2 horas antes" — relativo à hora exata do vencimento.
   */
  quando:
    | { tipo: 'diasAntes'; dias: number; aHora: Hora }
    | { tipo: 'antesDe'; minutos: number }
    /**
     * N horas antes do começo do DIA DE AULA em que a coisa vence — a primeira
     * aula do dia, e não a aula da matéria.
     *
     * É o alarme de última chance: ainda dá para fazer a tarefa antes de sair de
     * casa. Ancorar na aula da matéria erra o alvo — se matemática é às 8h e
     * geografia às 7h30, "uma hora antes de matemática" toca às 7h, no meio da
     * aula de geografia, e ninguém faz tarefa ali.
     */
    | { tipo: 'antesDaPrimeiraAula'; horas: number }
  modo: ModoAviso
  /** Só para insistente/alarme: de quanto em quanto tempo ele repete. */
  repetirCada?: number
  /** Quantas repetições ALÉM da primeira. Cada uma custa uma notificação do iOS. */
  repeticoes?: number
}

export type Compromisso = Registro & {
  materiaId?: string
  /**
   * Quando ele anotou. NÃO é `atualizadoEm` — este não muda ao editar.
   *
   * É a âncora de `vencimento.tipo === 'aula'`: "na próxima aula de matemática"
   * significa a próxima aula depois do momento em que você anotou. Resolver contra
   * o "agora" faria o prazo escorregar para a frente todo dia, e a tarefa nunca
   * venceria — que é o oposto do app.
   */
  criadoEm: number
  tipo: TipoCompromisso
  titulo: string
  detalhe?: string
  vencimento: Vencimento
  /** `null` = herda o padrão do tipo (o caso comum: ninguém configura nada). */
  avisos: RegraAviso[] | null
  concluido: boolean
  concluidoEm?: number
}

// ─── Notas e faltas ──────────────────────────────────────────────────────────

export type Nota = Registro & {
  materiaId: string
  titulo: string
  valor: number
  /** Nota máxima possível. 10 no Brasil, 100 em outros lugares. */
  maximo: number
  peso: number
}

export type Falta = Registro & {
  materiaId: string
  data: DataISO
  /** Quantas aulas daquele dia foram perdidas. */
  aulas: number
  justificada: boolean
}

// ─── A base inteira ──────────────────────────────────────────────────────────

export type Base = {
  periodos: Record<string, Periodo>
  materias: Record<string, Materia>
  aulas: Record<string, Aula>
  compromissos: Record<string, Compromisso>
  notas: Record<string, Nota>
  faltas: Record<string, Falta>
}

export function baseVazia(): Base {
  return { periodos: {}, materias: {}, aulas: {}, compromissos: {}, notas: {}, faltas: {} }
}

// ─── Ajustes (singleton, não é registro sincronizável por enquanto) ──────────

/**
 * Os idiomas da interface.
 *
 * O app não é só do Brasil. A estrutura foi feita para isso desde o começo —
 * chave por chave, com um script que falha o build quando falta tradução — e
 * cada idioma novo é um bloco a mais, não uma varredura pelas telas.
 */
export type Idioma = 'pt' | 'en' | 'es' | 'fr'

/** A ordem em que aparecem em Ajustes. */
export const IDIOMAS: readonly Idioma[] = ['pt', 'en', 'es', 'fr']

/** Como cada idioma se chama na própria língua. */
export const NOME_DO_IDIOMA: Record<Idioma, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
  fr: 'Français',
}

/** O locale que o sistema entende, para formatar data e hora. */
export const LOCALE_DO_IDIOMA: Record<Idioma, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
}

export type Ajustes = {
  /** `null` = seguir o idioma do sistema. */
  idioma: Idioma | null
  padroesAviso: Record<TipoCompromisso, RegraAviso[]>
  /**
   * O som do alarme: o nome de um arquivo importado, ou `null` para o do sistema.
   *
   * Guarda o NOME, e não o caminho: quem resolve o nome é o iOS, procurando na
   * bundle e em `Library/Sounds`. Nome que não resolve mais — som apagado — cai
   * no padrão em silêncio, então quem agenda confere antes se ele ainda existe.
   */
  somAlarme: string | null
  /**
   * Quanto o botão "Adiar" adia, em minutos. `0` tira o botão.
   *
   * Nove por herança do despertador do iPhone, e não por acaso: é o intervalo
   * que a pessoa já espera quando aperta adiar em qualquer alarme.
   */
  adiarMinutos: number
  /**
   * A faixa de horas em que nada toca — nem alarme.
   *
   * Existe porque o AlarmKit não tem como respeitar o Foco: ele foi feito para
   * furar. Ver `silencioNoturno.ts`.
   */
  silencioDe: Hora
  silencioAte: Hora
  limiteFaltasPadrao: number
  syncLigado: boolean
  /** Escola com semana A/B: qual semana do ano conta como "par". */
  inverterSemanaAlternada: boolean
  /**
   * Quem usa o app. Só o filtro do calendário da escola olha para isto — mas ele
   * não funciona sem: reunião de pais é do responsável, e prova do 1º ano não é
   * de quem está no 3º.
   */
  papel: Papel
  /**
   * O que a pessoa usa do app.
   *
   * Ninguém é obrigado a cadastrar a grade da escola para anotar uma prova. Quem
   * quer só um lembrete de tarefa desliga o resto e o app some com ele: a aba
   * fecha, a seção some da tela Hoje, e nada mais pede o que não vai ser usado.
   *
   * Os dois nascem LIGADOS: quem instala um app de agenda escolar quer a agenda
   * escolar, e desligar é a exceção. O que não pode existir é o muro — a Grade
   * exigia criar período letivo antes de deixar fazer qualquer coisa.
   */
  recursos: Recursos
  /**
   * As séries de quem usa. Lista porque um responsável pode ter dois filhos em
   * séries diferentes, e aí as duas valem.
   *
   * Guardadas na forma normalizada que `seriesCitadas` devolve — `3a serie`,
   * `ensino medio` — e não como a pessoa digitou, para a comparação não depender
   * de acento nem de maiúscula.
   */
  minhasSeries: string[]
}

/** Quem está usando o app. Muda o que é relevante, não o que é verdade. */
export type Papel = 'aluno' | 'responsavel'

/** As partes opcionais. Lembrete de compromisso não está aqui: é o app. */
export type Recursos = {
  /** A grade de aulas, e com ela o vencimento "na próxima aula de…". */
  grade: boolean
  /** Notas, média e faltas. */
  notas: boolean
  /**
   * Escola com semana A/B, em que a grade muda de uma semana para a outra.
   *
   * Nasce DESLIGADO: quase toda escola tem a mesma grade toda semana, e ele
   * olhou o controle na tela e perguntou o que era. Controle que a pessoa não
   * entende é pior que controle que não existe.
   */
  semanaAlternada: boolean
}

/** Ids fixos para os padrões: o usuário edita, e a edição substitui pelo id. */
function regra(
  id: string,
  quando: RegraAviso['quando'],
  modo: ModoAviso,
  repetir?: { cada: number; vezes: number },
): RegraAviso {
  const r: RegraAviso = { id, quando, modo }
  if (repetir) {
    r.repetirCada = repetir.cada
    r.repeticoes = repetir.vezes
  }
  return r
}

/**
 * O padrão que já serve sem ninguém configurar nada — que é o ponto: o app tem
 * que ser útil antes de você abrir Ajustes.
 */
export const PADROES_AVISO: Record<TipoCompromisso, RegraAviso[]> = {
  // Prova nao leva o alarme de ultima chance: nao existe "fazer a prova antes de
  // sair de casa". O que serve para prova e avisar com dias de antecedencia, para
  // dar tempo de estudar — e e o que esta abaixo.
  prova: [
    regra('prova-7d', { tipo: 'diasAntes', dias: 7, aHora: '20:00' }, 'normal'),
    regra('prova-3d', { tipo: 'diasAntes', dias: 3, aHora: '20:00' }, 'normal'),
    regra('prova-1d', { tipo: 'diasAntes', dias: 1, aHora: '20:00' }, 'insistente', { cada: 15, vezes: 3 }),
    regra('prova-2h', { tipo: 'antesDe', minutos: 120 }, 'alarme', { cada: 5, vezes: 5 }),
  ],
  trabalho: [
    // Alarme de ultima chance: ainda da para fazer antes de sair de casa.
    regra('trabalho-manha', { tipo: 'antesDaPrimeiraAula', horas: 2 }, 'alarme', { cada: 3, vezes: 4 }),
    regra('trabalho-5d', { tipo: 'diasAntes', dias: 5, aHora: '20:00' }, 'normal'),
    regra('trabalho-2d', { tipo: 'diasAntes', dias: 2, aHora: '20:00' }, 'normal'),
    regra('trabalho-1d', { tipo: 'diasAntes', dias: 1, aHora: '20:00' }, 'insistente', { cada: 20, vezes: 2 }),
    regra('trabalho-3h', { tipo: 'antesDe', minutos: 180 }, 'insistente', { cada: 15, vezes: 3 }),
  ],
  entrega: [
    // Alarme de ultima chance: ainda da para fazer antes de sair de casa.
    regra('entrega-manha', { tipo: 'antesDaPrimeiraAula', horas: 2 }, 'alarme', { cada: 3, vezes: 4 }),
    regra('entrega-5d', { tipo: 'diasAntes', dias: 5, aHora: '20:00' }, 'normal'),
    regra('entrega-2d', { tipo: 'diasAntes', dias: 2, aHora: '20:00' }, 'normal'),
    regra('entrega-1d', { tipo: 'diasAntes', dias: 1, aHora: '20:00' }, 'insistente', { cada: 20, vezes: 2 }),
    regra('entrega-3h', { tipo: 'antesDe', minutos: 180 }, 'insistente', { cada: 15, vezes: 3 }),
  ],
  tarefa: [
    // Alarme de ultima chance: ainda da para fazer antes de sair de casa.
    regra('tarefa-manha', { tipo: 'antesDaPrimeiraAula', horas: 2 }, 'alarme', { cada: 3, vezes: 4 }),
    regra('tarefa-1d', { tipo: 'diasAntes', dias: 1, aHora: '20:00' }, 'normal'),
    regra('tarefa-2h', { tipo: 'antesDe', minutos: 120 }, 'insistente', { cada: 15, vezes: 2 }),
  ],
  leitura: [
    regra('leitura-manha', { tipo: 'antesDaPrimeiraAula', horas: 2 }, 'alarme', { cada: 3, vezes: 4 }),
    regra('leitura-1d', { tipo: 'diasAntes', dias: 1, aHora: '20:00' }, 'normal'),
  ],
  outro: [regra('outro-1d', { tipo: 'diasAntes', dias: 1, aHora: '20:00' }, 'normal')],
}

export function ajustesPadrao(): Ajustes {
  return {
    idioma: null,
    // Aluno por padrão: é quem o app foi feito para atender, e responsável é o
    // caso derivado. Série vazia significa "ainda não perguntei", e a tela de
    // importação pergunta antes de filtrar qualquer coisa.
    papel: 'aluno',
    recursos: { grade: true, notas: true, semanaAlternada: false },
    minhasSeries: [],
    padroesAviso: PADROES_AVISO,
    somAlarme: null,
    adiarMinutos: 9,
    silencioDe: '22:00',
    silencioAte: '07:00',
    limiteFaltasPadrao: 25,
    syncLigado: false,
    inverterSemanaAlternada: false,
  }
}

/** Os avisos que valem para um compromisso: os dele, ou o padrão do tipo. */
export function avisosDe(c: Compromisso, ajustes: Ajustes): RegraAviso[] {
  return c.avisos ?? ajustes.padroesAviso[c.tipo] ?? []
}
