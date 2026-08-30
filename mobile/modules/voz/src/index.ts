import type { Idioma } from '../../../../nucleo/modelo.ts'
import { LOCALE_DO_IDIOMA } from '../../../../nucleo/modelo.ts'
import { moduloOpcional } from '../../../src/modulosNativos.ts'
import type { EventSubscription } from 'expo-modules-core'

const modulo = moduloOpcional<any>('Voz')

/** O idioma do ditado, no formato que o iOS espera. */
export function localeDe(idioma: Idioma): string {
  return LOCALE_DO_IDIOMA[idioma]
}

export function temVoz(idioma: Idioma): boolean {
  try {
    return modulo?.disponivel?.(localeDe(idioma)) ?? false
  } catch {
    return false
  }
}

export async function pedirPermissaoDeVoz(): Promise<boolean> {
  if (!modulo) return false
  try {
    return (await modulo.permissao()) as boolean
  } catch {
    return false
  }
}

export type Ouvinte = {
  /** Chega a cada palavra, enquanto a pessoa fala. */
  aoOuvir: (texto: string, final: boolean) => void
  aoTerminar: (texto: string) => void
  aoFalhar: (motivo: string) => void
}

export function ouvir(idioma: Idioma, o: Ouvinte): () => Promise<string> {
  if (!modulo) {
    o.aoFalhar('ditado indisponível')
    return async () => ''
  }

  const inscricoes: EventSubscription[] = [
    modulo.addListener('aoOuvir', (e: { texto: string; final: boolean }) =>
      o.aoOuvir(e.texto, e.final),
    ),
    modulo.addListener('aoTerminar', (e: { texto: string }) => o.aoTerminar(e.texto)),
    modulo.addListener('aoFalhar', (e: { motivo: string }) => o.aoFalhar(e.motivo)),
  ]

  void modulo.comecar(localeDe(idioma)).catch((e: unknown) => {
    o.aoFalhar(e instanceof Error ? e.message : 'falha no ditado')
  })

  return async () => {
    const texto = ((await modulo.parar()) as string) ?? ''
    for (const i of inscricoes) i.remove()
    return texto
  }
}
