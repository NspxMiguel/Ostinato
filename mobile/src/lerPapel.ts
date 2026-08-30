// Ler o papel: câmera quando existe, galeria quando não, e o OCR no aparelho.
//
// Mora aqui, e não dentro de uma tela, porque DUAS telas precisam: a captura de
// tarefa e a importação do horário. Duplicar isso significaria duas regras de
// permissão e duas maneiras de falhar.

import * as ImagePicker from 'expo-image-picker'
import { lerTexto, temLeitura } from '../modules/leitura/src/index.ts'

export type Papel =
  | { tipo: 'lido'; texto: string; linhas: number }
  | { tipo: 'cancelado' }
  | { tipo: 'indisponivel' }
  | { tipo: 'sem-permissao' }

/**
 * Câmera ou galeria, e o OCR no aparelho.
 *
 * As duas são caminhos de primeira classe, e não uma o remendo da outra: o
 * horário quase sempre já chegou por foto no WhatsApp e está no rolo. Tentar a
 * câmera e "cair" na galeria quando ela falha também não funcionaria — no
 * simulador a câmera não falha, ela abre uma tela cinza; e num iPad sem câmera
 * traseira a pessoa ficaria sem saber que existia outro caminho.
 */
export async function lerPapel(de: 'camera' | 'galeria' = 'camera'): Promise<Papel> {
  if (!temLeitura()) return { tipo: 'indisponivel' }

  let escolha: ImagePicker.ImagePickerResult

  if (de === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissao.granted) return { tipo: 'sem-permissao' }
    escolha = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false })
  } else {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissao.granted) return { tipo: 'sem-permissao' }
    escolha = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: false })
  }

  const uri = escolha.assets?.[0]?.uri
  if (escolha.canceled || !uri) return { tipo: 'cancelado' }

  const r = await lerTexto(uri)
  return { tipo: 'lido', texto: r.texto, linhas: r.linhas }
}

export { temLeitura }
