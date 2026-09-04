// O período letivo que o app inventa quando ninguém cadastrou nenhum.
//
// Sem período, a grade não resolve data nenhuma: "na próxima aula de X" não tem
// calendário onde procurar, e a tela Hoje fica vazia sem saber explicar por quê.
// Mas exigir nome e duas datas de semestre ANTES de a pessoa poder anotar que
// tem matemática na terça é pedir a burocracia antes do valor.
//
// O padrão ABRAÇA HOJE, de propósito: um período que já terminou faria tudo
// continuar sem funcionar, e aí o botão teria mentido.

import type { Base, Periodo } from '../../nucleo/modelo.ts'
import { vivos } from '../../nucleo/sync/registro.ts'

type Guardar = (tabela: 'periodos', valor: Record<string, unknown>) => string

/** O ano corrente inteiro. A pessoa ajusta depois, se quiser. */
export function criarPeriodoPadrao(guardar: Guardar): string {
  const ano = new Date().getFullYear()
  return guardar('periodos', {
    nome: String(ano),
    inicio: `${ano}-01-01`,
    fim: `${ano}-12-31`,
    feriados: [],
    ativo: true,
  })
}

/** O id do período ativo, criando um se não houver. */
export function garantirPeriodo(base: Base, guardar: Guardar): string {
  const existente = vivos(base.periodos).find((p: Periodo) => p.ativo)
  return existente ? existente.id : criarPeriodoPadrao(guardar)
}
