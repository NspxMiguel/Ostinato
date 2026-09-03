// Os sons de alarme que o app carrega.
//
// Ele pediu "todos do iphone + alguns proprietários". A primeira metade não é
// possível e não adianta fingir: Radar, Farol, Ondas e companhia moram em
// /System/Library/Audio/UISounds, pertencem à Apple, e um app que os copiasse
// para dentro do próprio pacote seria reprovado na revisão da loja — além de
// não ter como lê-los em tempo de execução, porque a pasta é do sistema.
//
// Então o app traz o SEU conjunto, no espírito daqueles: um percussivo, um
// urgente, um de varredura, um suave. São gerados por
// `ferramentas/gerar-sons.py`, e por isso são reproduzíveis em vez de binários
// que alguém largou aqui.
//
// Quem quiser exatamente o toque do iPhone continua tendo a importação de
// arquivo, que já existia.

import type { ChaveI18n } from '../../../nucleo/i18n.ts'

/** O arquivo, o rótulo traduzido, e o módulo para tocar a prévia. */
export type SomDoApp = {
  arquivo: string
  chave: ChaveI18n
  fonte: number
}

// `require` tem que ser literal: o empacotador resolve em tempo de build, e um
// caminho montado em variável devolve undefined em silêncio.
export const SONS_DO_APP: readonly SomDoApp[] = [
  {
    arquivo: 'ostinato-sino.caf',
    chave: 'som.sino',
    fonte: require('../../assets/ostinato-sino.caf'),
  },
  {
    arquivo: 'ostinato-marimba.caf',
    chave: 'som.marimba',
    fonte: require('../../assets/ostinato-marimba.caf'),
  },
  {
    arquivo: 'ostinato-carrilhao.caf',
    chave: 'som.carrilhao',
    fonte: require('../../assets/ostinato-carrilhao.caf'),
  },
  {
    arquivo: 'ostinato-harpa.caf',
    chave: 'som.harpa',
    fonte: require('../../assets/ostinato-harpa.caf'),
  },
  {
    arquivo: 'ostinato-sonar.caf',
    chave: 'som.sonar',
    fonte: require('../../assets/ostinato-sonar.caf'),
  },
  {
    arquivo: 'ostinato-radar.caf',
    chave: 'som.radar',
    fonte: require('../../assets/ostinato-radar.caf'),
  },
  {
    arquivo: 'ostinato-farol.caf',
    chave: 'som.farol',
    fonte: require('../../assets/ostinato-farol.caf'),
  },
  {
    arquivo: 'ostinato-pulso.caf',
    chave: 'som.pulso',
    fonte: require('../../assets/ostinato-pulso.caf'),
  },
]

export function somDoApp(arquivo: string | null | undefined): SomDoApp | undefined {
  return SONS_DO_APP.find((s) => s.arquivo === arquivo)
}
