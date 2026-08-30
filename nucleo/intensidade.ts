// Três escolhas em vez de um editor de regras.
//
// A tela de ajustes pedia que a pessoa montasse cada aviso à mão: quantos dias
// antes, a que hora, em que modo, repetindo de quantos em quantos minutos,
// vezes quantas — e isso multiplicado pelos seis tipos de compromisso. Ninguém
// configura isso. A pessoa olha, cansa e sai com o padrão, que era o único
// caminho que já funcionava.
//
// O que a Apple faz nesse lugar é oferecer poucas opções nomeadas pelo RESULTADO
// e esconder o resto atrás de "personalizar". É o que este arquivo dá.
//
// Puro, sem I/O: é testável e atravessa para Android sem mudança.

import type { ModoAviso, RegraAviso, TipoCompromisso } from './modelo.ts'
import { PADROES_AVISO } from './modelo.ts'

export const NIVEIS = ['leve', 'padrao', 'puxado'] as const
export type Nivel = (typeof NIVEIS)[number]

/** O que a tela mostra quando as regras não batem com nenhum nível. */
export type NivelOuLivre = Nivel | 'personalizado'

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

/** Prova não leva alarme de última chance: não existe "fazer a prova antes de sair". */
const semAlarmeDeManha = (tipo: TipoCompromisso) => tipo === 'prova'

/**
 * As regras de um tipo num dado nível.
 *
 * `padrao` devolve exatamente o que o app já usava — trocar de nível e voltar
 * para "padrão" tem que restaurar o comportamento original, senão o seletor
 * destrói configuração em vez de oferecer escolha.
 */
export function avisosPorIntensidade(tipo: TipoCompromisso, nivel: Nivel): RegraAviso[] {
  if (nivel === 'padrao') return PADROES_AVISO[tipo].map((r) => ({ ...r }))

  if (nivel === 'leve') {
    // Um aviso na véspera, e nada mais. Para quem já se organiza e só quer não
    // ser pego de surpresa.
    return [regra(`${tipo}-leve-1d`, { tipo: 'diasAntes', dias: 1, aHora: '20:00' }, 'normal')]
  }

  // Puxado: começa mais cedo, insiste mais, e termina em alarme.
  const lista: RegraAviso[] = [
    regra(`${tipo}-puxado-7d`, { tipo: 'diasAntes', dias: 7, aHora: '20:00' }, 'normal'),
    regra(`${tipo}-puxado-3d`, { tipo: 'diasAntes', dias: 3, aHora: '20:00' }, 'normal'),
    regra(
      `${tipo}-puxado-1d`,
      { tipo: 'diasAntes', dias: 1, aHora: '20:00' },
      'insistente',
      { cada: 15, vezes: 4 },
    ),
    regra(`${tipo}-puxado-3h`, { tipo: 'antesDe', minutos: 180 }, 'insistente', { cada: 10, vezes: 4 }),
  ]
  if (!semAlarmeDeManha(tipo)) {
    lista.unshift(
      regra(
        `${tipo}-puxado-manha`,
        { tipo: 'antesDaPrimeiraAula', horas: 2 },
        'alarme',
        { cada: 3, vezes: 5 },
      ),
    )
  }
  return lista
}

/** Assinatura de um conjunto de regras: o que decide se dois conjuntos são o mesmo. */
function assinatura(regras: RegraAviso[]): string {
  return regras
    .map((r) => {
      const q = r.quando
      const quando =
        q.tipo === 'diasAntes'
          ? `d${q.dias}@${q.aHora}`
          : q.tipo === 'antesDe'
            ? `m${q.minutos}`
            : `h${q.horas}`
      return `${quando}:${r.modo}:${r.repetirCada ?? 0}x${r.repeticoes ?? 0}`
    })
    // A ordem em que as regras foram criadas não muda o comportamento: o
    // planejador ordena por data de disparo. Comparar sem ordenar diria
    // "personalizado" só porque a pessoa removeu e recriou a mesma regra.
    .sort()
    .join('|')
}

/**
 * Qual nível descreve as regras atuais — ou `personalizado` se nenhum descreve.
 *
 * `padrao` é testado PRIMEIRO porque há empate real: leitura já avisava uma vez
 * só, então o padrão dela é idêntico ao nível leve. No empate, dizer "Padrão" é
 * mais honesto — a pessoa não escolheu "leve", ela nunca mexeu.
 */
export function intensidadeDe(tipo: TipoCompromisso, regras: RegraAviso[]): NivelOuLivre {
  const alvo = assinatura(regras)
  for (const nivel of ['padrao', 'leve', 'puxado'] as const) {
    if (assinatura(avisosPorIntensidade(tipo, nivel)) === alvo) return nivel
  }
  return 'personalizado'
}
