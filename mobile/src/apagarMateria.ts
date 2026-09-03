// Apagar uma matéria não é apagar um registro: é apagar o que só existe por
// causa dela.
//
// A regra vivia dentro da tela de Matéria. Com o deslizar da lista virou um
// segundo lugar que apaga matéria, e cascata escrita duas vezes é cascata que
// diverge — um dos lados esquece as faltas, e ninguém percebe até sobrar falta
// de uma matéria que não existe mais.

import type { Aula, Base, Falta, Nota } from '../../nucleo/modelo.ts'
import { vivos } from '../../nucleo/sync/registro.ts'

type TabelaEmCascata = 'aulas' | 'notas' | 'faltas' | 'materias'

/** O que vai junto — separado para poder ser DITO antes de apagar. */
export function oQueVaiJunto(base: Base, materiaId: string) {
  return {
    aulas: vivos(base.aulas).filter((a: Aula) => a.materiaId === materiaId),
    notas: vivos(base.notas).filter((n: Nota) => n.materiaId === materiaId),
    faltas: vivos(base.faltas).filter((f: Falta) => f.materiaId === materiaId),
  }
}

/**
 * Apaga a matéria e a sua cascata.
 *
 * O COMPROMISSO fica, sem matéria — "prova de química" continua sendo uma prova
 * que existe na sua semana, e apagá-la porque a matéria saiu seria destruir o
 * que a pessoa anotou.
 */
export function apagarMateria(
  base: Base,
  materiaId: string,
  remover: (tabela: TabelaEmCascata, id: string) => void,
) {
  const { aulas, notas, faltas } = oQueVaiJunto(base, materiaId)
  for (const a of aulas) remover('aulas', a.id)
  for (const n of notas) remover('notas', n.id)
  for (const f of faltas) remover('faltas', f.id)
  remover('materias', materiaId)
}
