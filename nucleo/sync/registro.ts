// O envelope que todo registro do Giz carrega.
//
// Estes quatro campos existem desde a primeira versão, mesmo com o sync desligado.
// São eles que permitem ligar o CloudKit (e depois o Firestore, no Android) sem
// reescrever o armazenamento: sem `atualizadoEm` não dá para saber quem escreveu por
// último, e sem `removido` um registro apagado num aparelho ressuscita no outro.

/** Identidade do aparelho que escreveu. Gerada uma vez e guardada no MMKV. */
export type IdAparelho = string

export type Registro = {
  id: string
  /** epoch em milissegundos. É o critério de desempate do merge. */
  atualizadoEm: number
  /** lápide: o registro continua existindo para poder propagar a remoção. */
  removido: boolean
  origem: IdAparelho
}

/** As coleções que o sync conhece. Uma por tipo de registro. */
export const TABELAS = [
  'periodos',
  'materias',
  'aulas',
  'compromissos',
  'notas',
  'faltas',
] as const

export type Tabela = (typeof TABELAS)[number]

/**
 * UUID v4. Usa o `crypto` da plataforma quando existe (Node, navegador, e o
 * Hermes com expo-crypto instalado) e cai num gerador próprio quando não existe —
 * o Hermes puro não tem `randomUUID`, e isso derrubaria o app na primeira gravação.
 */
export function criarId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const hex = '0123456789abcdef'
  let saida = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) saida += '-'
    else if (i === 14) saida += '4'
    else if (i === 19) saida += hex[8 + ((Math.random() * 4) | 0)] ?? '8'
    else saida += hex[(Math.random() * 16) | 0] ?? '0'
  }
  return saida
}

/** Cria o envelope de um registro novo. */
export function novoEnvelope(origem: IdAparelho, agora: number): Registro {
  return { id: criarId(), atualizadoEm: agora, removido: false, origem }
}

/** Marca um registro como editado agora, por este aparelho. */
export function tocar<T extends Registro>(r: T, origem: IdAparelho, agora: number): T {
  return { ...r, atualizadoEm: agora, origem }
}

/**
 * Apaga em lápide. O registro continua na base com `removido: true` para que o
 * outro aparelho aprenda que ele morreu; quem some da tela é filtrado na leitura.
 */
export function apagar<T extends Registro>(r: T, origem: IdAparelho, agora: number): T {
  return { ...r, removido: true, atualizadoEm: agora, origem }
}

/** Filtro de leitura: o resto do app nunca deve ver lápide. */
export function vivos<T extends Registro>(mapa: Record<string, T>): T[] {
  return Object.values(mapa).filter((r) => !r.removido)
}
