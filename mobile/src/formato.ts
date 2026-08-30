// Datas e distâncias como uma pessoa fala.

import type { DataISO } from '../../nucleo/modelo.ts'
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
export function diaPorExtenso(data: DataISO, idioma: 'pt' | 'en', t: T, hoje = dataDe(new Date())): string {
  const d = diferencaEmDias(hoje, data)
  if (d === 0) return t('agenda.hoje')
  if (d === 1) return t('agenda.amanha')
  return instante(data).toLocaleDateString(idioma === 'pt' ? 'pt-BR' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** "quinta, 3 de setembro, 13:30" — o formato longo, com hora. */
export function momentoPorExtenso(quando: Date, idioma: 'pt' | 'en'): string {
  return quando.toLocaleString(idioma === 'pt' ? 'pt-BR' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function horaCurta(quando: Date, idioma: 'pt' | 'en'): string {
  return quando.toLocaleTimeString(idioma === 'pt' ? 'pt-BR' : 'en-US', {
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
export function dataPorExtenso(iso: DataISO, hojeISO: DataISO, t: T, idioma: 'pt' | 'en'): string {
  if (iso === hojeISO) return t('data.hoje')
  if (iso === somarDias(hojeISO, 1)) return t('data.amanha')
  return instante(iso).toLocaleDateString(idioma === 'pt' ? 'pt-BR' : 'en-US', {
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
  idioma: 'pt' | 'en',
): string {
  return t('data.com_hora', { data: dataPorExtenso(iso, hojeISO, t, idioma), hora })
}
