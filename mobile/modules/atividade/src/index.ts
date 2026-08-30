import { moduloOpcional } from '../../../src/modulosNativos.ts'

const modulo = moduloOpcional<any>('Atividade')

export function temAtividade(): boolean {
  try {
    return modulo?.disponivel?.() ?? false
  } catch {
    return false
  }
}

export type Proxima = {
  /** O tipo já traduzido: "Prova", "Entrega". */
  tipo: string
  titulo: string
  materia: string
  /** Instante do vencimento. A contagem regressiva é feita pelo sistema. */
  venceEm: Date
  cor: string
}

/** Liga (ou atualiza) a Live Activity da próxima entrega. */
export async function mostrarProxima(p: Proxima): Promise<string | null> {
  if (!modulo) return null
  try {
    return (await modulo.mostrar(
      p.tipo,
      p.titulo,
      p.materia,
      p.venceEm.getTime() / 1000,
      p.cor,
    )) as string
  } catch {
    // Atividade recusada (usuário desligou, ou versão antiga do iOS) não é motivo
    // para derrubar nada: é um enfeite em cima do aviso, não o aviso.
    return null
  }
}

export async function esconderAtividade(): Promise<number> {
  if (!modulo) return 0
  try {
    return (await modulo.esconder()) as number
  } catch {
    return 0
  }
}

export type ItemDoResumo = {
  id: string
  titulo: string
  materia: string
  tipo: string
  /** Epoch em SEGUNDOS. O widget formata — o idioma e o fuso são decididos lá. */
  venceEm: number
  cor: string
  atrasado: boolean
}

/**
 * Deposita o resumo que o widget de tela de início lê, e pede recarga.
 *
 * Devolve `false` quando o App Group não existe no binário — que é o modo de
 * falha silencioso deste caminho: sem o grupo o widget aparece na galeria e
 * desenha vazio, sem erro em lugar nenhum.
 */
export function salvarResumo(itens: ItemDoResumo[]): boolean {
  if (!modulo) return false
  try {
    return (
      (modulo.salvarResumo?.(
        JSON.stringify({ itens, atualizadoEm: Date.now() / 1000 }),
      ) as boolean) ?? false
    )
  } catch {
    return false
  }
}
