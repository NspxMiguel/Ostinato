// O som do alarme, do lado do JavaScript.
//
// O que este arquivo esconde de quem chama: o arquivo que a pessoa escolheu não
// é o arquivo que toca. Todo áudio importado é reescrito em CAF e cortado em
// 30s, porque o iOS ignora — em silêncio — som de alerta que não seja CAF/AIFF/
// WAV ou que passe disso. Ver `ios/SomModule.swift`.

import * as DocumentPicker from 'expo-document-picker'
import { moduloOpcional } from '../../../src/modulosNativos.ts'

const modulo = moduloOpcional<any>('SomDoAlarme')

export function temSomProprio(): boolean {
  return !!modulo
}

/** Os sons já importados, pelo nome de arquivo (que é o que o alarme guarda). */
export function sonsImportados(): string[] {
  try {
    return (modulo?.importados?.() as string[]) ?? []
  } catch {
    return []
  }
}

/**
 * Abre o seletor de arquivos e importa o áudio escolhido.
 *
 * `null` quando a pessoa cancelou ou o arquivo não deu para ler — e nos dois
 * casos a escolha anterior continua valendo, que é o que ela espera.
 */
export async function importarSom(): Promise<string | null> {
  if (!modulo) return null
  const escolha = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
  })
  const arquivo = escolha.assets?.[0]
  if (escolha.canceled || !arquivo) return null
  const rotulo = (arquivo.name ?? 'som').replace(/\.[^.]+$/, '')
  try {
    return (await modulo.importar(arquivo.uri, rotulo)) as string
  } catch {
    return null
  }
}

export function removerSom(nome: string): boolean {
  try {
    return (modulo?.remover?.(nome) as boolean) ?? false
  } catch {
    return false
  }
}

/** Ouvir antes de escolher — senão a única prova viria no meio da madrugada. */
export async function ouvirSom(nome: string): Promise<boolean> {
  if (!modulo) return false
  try {
    return (await modulo.ouvir(nome)) as boolean
  } catch {
    return false
  }
}

export function pararSom(): void {
  try {
    modulo?.parar?.()
  } catch {
    // Parar um som que já parou não é erro.
  }
}

/** Um nome legível a partir do arquivo: "prova-1756...caf" -> "prova". */
export function rotuloDoSom(nome: string): string {
  return nome.replace(/-\d+\.caf$/, '').replace(/-/g, ' ')
}
