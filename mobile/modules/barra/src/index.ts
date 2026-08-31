// A barra de abas nativa. Existe porque Liquid Glass de verdade não se monta do
// lado do JavaScript: o `UIGlassContainerEffect` exige que as peças de vidro
// sejam IRMÃS dentro do `contentView` dele, e uma árvore de componentes React
// aninha — que é o arranjo em que `spacing` não funde nada.
import { requireNativeView } from 'expo'
import type { StyleProp, ViewStyle } from 'react-native'

type Props = {
  rotulos: string[]
  /** O SF Symbol de cada aba, na mesma ordem de `rotulos`. */
  icones: string[]
  ativa: number
  aoTrocar: (e: { nativeEvent: { indice: number } }) => void
  style?: StyleProp<ViewStyle>
}

export const BarraNativa = requireNativeView<Props>('Barra')
