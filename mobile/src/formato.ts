// Datas e distâncias como uma pessoa fala.

import type { DataISO, Idioma, RegraAviso } from '../../nucleo/modelo.ts'
import { LOCALE_DO_IDIOMA } from '../../nucleo/modelo.ts'
import { criarT } from '../../nucleo/i18n.ts'
import { getCalendars } from 'expo-localization'
import { dataDe, diferencaEmDias, instante, somarDias } from '../../nucleo/tempo.ts'

type T = ReturnType<typeof criarT>

/** O fim do dia que o app usa quando ninguém escolheu hora. */
const FIM_DO_DIA = '23:59'

/**
 * O iPhone está em 12h ou 24h?
 *
 * `null` quando o sistema não diz — e aí a resposta certa é `undefined`, que
 * manda o `Intl` decidir pelo locale em vez de eu chutar.
 *
 * Isto existe porque formato de relógio é ajuste do APARELHO, não do app. O
 * idioma escolhido na interface decide as PALAVRAS ("quinta-feira", "setembro");
 * o interruptor "Hora de 24 horas" dos Ajustes do iPhone decide o RELÓGIO. Eu
 * tinha juntado os dois em `LOCALE_DO_IDIOMA`, e `pt-BR` força 24h: quem tem o
 * telefone em 12h lia 22:08 na tela e digitava 10:08 achando que era a mesma
 * coisa. Um alarme doze horas fora do lugar, sem nenhum erro à vista.
 */
function usa12Horas(): boolean | undefined {
  try {
    const usa24 = getCalendars()[0]?.uses24hourClock
    return usa24 === null || usa24 === undefined ? undefined : !usa24
  } catch {
    return undefined
  }
}

/** "22:08" ou "10:08 PM", conforme o iPhone. */
export function horaDoAparelho(quando: Date): string {
  return quando.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: usa12Horas(),
  })
}

/** Idem, a partir de "HH:MM" — o formato em que a grade e as regras guardam. */
export function horaDeTexto(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const d = new Date()
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  return horaDoAparelho(d)
}

/** "3 dias", "2 horas", "40 min" — a maior unidade que ainda diz algo. */
export function distancia(deMs: number, ateMs: number, t: T): string {
  const min = Math.max(0, Math.round(Math.abs(ateMs - deMs) / 60_000))
  if (min < 60) return t('tempo.minutos', { n: min })
  const horas = Math.round(min / 60)
  if (horas < 24) return horas === 1 ? t('tempo.hora') : t('tempo.horas', { n: horas })
  const dias = Math.round(horas / 24)
  return dias === 1 ? t('tempo.dia') : t('tempo.dias', { n: dias })
}

/** "Hoje", "Amanhã", ou "quinta, 3 de setembro". */
export function diaPorExtenso(data: DataISO, idioma: Idioma, t: T, hoje = dataDe(new Date())): string {
  const d = diferencaEmDias(hoje, data)
  if (d === 0) return t('agenda.hoje')
  if (d === 1) return t('agenda.amanha')
  return instante(data).toLocaleDateString(LOCALE_DO_IDIOMA[idioma], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** "quinta, 3 de setembro, 13:30" — o formato longo, com hora. */
export function momentoPorExtenso(quando: Date, idioma: Idioma): string {
  // Palavras no idioma do app, relógio no formato do aparelho.
  return quando.toLocaleString(LOCALE_DO_IDIOMA[idioma], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: usa12Horas(),
  })
}

export function horaCurta(quando: Date, _idioma: Idioma): string {
  return horaDoAparelho(quando)
}

/**
 * "Hoje", "Amanhã", ou "quinta, 3 de setembro".
 *
 * Nome de mês e de dia da semana vêm do sistema, e não de chaves de tradução:
 * ele acerta a gramática de cada idioma, e um terceiro idioma não custa mais
 * dezenove traduções para escrever e esquecer.
 */
export function dataPorExtenso(iso: DataISO, hojeISO: DataISO, t: T, idioma: Idioma): string {
  if (iso === hojeISO) return t('data.hoje')
  if (iso === somarDias(hojeISO, 1)) return t('data.amanha')
  return instante(iso).toLocaleDateString(LOCALE_DO_IDIOMA[idioma], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function quandoPorExtenso(
  iso: DataISO,
  hora: string,
  hojeISO: DataISO,
  t: T,
  idioma: Idioma,
): string {
  // 23:59 NÃO é hora: é o app dizendo "algum momento daquele dia".
  //
  // Ele reclamou em 31/08/2026: *"pq tem horario? eu nem cadastrei horario"*.
  // Estava certo. Quem anota "tarefa para amanhã" não escolheu 23:59 — esse é
  // o fim do dia que o app usa como padrão. Imprimir isso como "amanhã às
  // 11:59 PM" faz o app parecer que sabe algo que ninguém disse, e enche a
  // linha com um número que não quer dizer nada.
  //
  // Quem marca de propósito uma entrega às 23:59 vê "amanhã" — e é o certo:
  // para essa pessoa a informação também é o DIA.
  if (hora === FIM_DO_DIA) return dataPorExtenso(iso, hojeISO, t, idioma)

  // A hora passa pelo formatador do APARELHO, como em todo o resto.
  //
  // Ela chegava crua e ia direto para a tela: o Hoje mostrava a aula às
  // "8:00 AM" e, três linhas abaixo, a tarefa "amanhã às 23:59". Dois relógios
  // na mesma tela é o tipo de coisa que a pessoa nota sem saber nomear.
  return t('data.com_hora', {
    data: dataPorExtenso(iso, hojeISO, t, idioma),
    hora: horaDeTexto(hora),
  })
}

/**
 * "3 dias antes, às 20:00" / "2 horas antes".
 *
 * O plural é decidido aqui, e não na chave: "1 dias antes" é o tipo de detalhe
 * que faz um app parecer inacabado, e ele apareceria em três telas diferentes se
 * cada uma montasse o texto por conta própria.
 */
export function rotuloDeRegra(regra: RegraAviso, t: T): string {
  if (regra.quando.tipo === 'antesDaPrimeiraAula') {
    const h = regra.quando.horas
    return h === 1 ? t('avisos.antes_da_aula_1') : t('avisos.antes_da_aula', { n: h })
  }
  if (regra.quando.tipo === 'diasAntes') {
    const n = regra.quando.dias
    // Formatada pelo aparelho, e não crua: o cabeçalho dizia "às 22:11"
    // enquanto o campo logo abaixo dizia "10:11 PM". A mesma hora em dois
    // formatos na mesma tela faz a pessoa desconfiar de qual delas vale.
    const hora = horaDeTexto(regra.quando.aHora)
    if (n === 0) return t('avisos.no_dia', { hora })
    return n === 1 ? t('avisos.dia_antes', { hora }) : t('avisos.dias_antes', { n, hora })
  }
  const min = regra.quando.minutos
  if (min < 60) return t('avisos.minutos_antes', { n: min })
  const horas = Math.round(min / 60)
  return horas === 1 ? t('avisos.hora_antes') : t('avisos.horas_antes', { n: horas })
}

/**
 * "Amanhã às 20:00" -> "amanhã às 20:00", mas só em português.
 *
 * A mesma string começa uma linha ("Amanhã") e aparece no meio de outra
 * ("Avisa você amanhã às 20:00"). Duplicar a chave por causa de uma letra seria
 * pior: sobraria uma para esquecer de traduzir.
 *
 * Em inglês NÃO se faz isso: "Friday" é nome próprio e continua maiúsculo no
 * meio da frase. Baixar a inicial ali deixaria "Alerts you friday", que é erro
 * de português aplicado ao inglês.
 */
export function comInicialMinuscula(texto: string, idioma: Idioma): string {
  if (idioma !== 'pt' || texto.length === 0) return texto
  return texto[0]!.toLocaleLowerCase('pt-BR') + texto.slice(1)
}
