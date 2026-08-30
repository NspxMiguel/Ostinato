// Datas e distâncias como uma pessoa fala.

import type { DataISO, Idioma, RegraAviso } from '../../nucleo/modelo.ts'
import { LOCALE_DO_IDIOMA } from '../../nucleo/modelo.ts'
import { criarT } from '../../nucleo/i18n.ts'
import { dataDe, diferencaEmDias, instante, somarDias } from '../../nucleo/tempo.ts'

type T = ReturnType<typeof criarT>

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
  return quando.toLocaleString(LOCALE_DO_IDIOMA[idioma], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function horaCurta(quando: Date, idioma: Idioma): string {
  return quando.toLocaleTimeString(LOCALE_DO_IDIOMA[idioma], {
    hour: '2-digit',
    minute: '2-digit',
  })
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
  return t('data.com_hora', { data: dataPorExtenso(iso, hojeISO, t, idioma), hora })
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
    if (n === 0) return t('avisos.no_dia', { hora: regra.quando.aHora })
    return n === 1
      ? t('avisos.dia_antes', { hora: regra.quando.aHora })
      : t('avisos.dias_antes', { n, hora: regra.quando.aHora })
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
