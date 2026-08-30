import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core'
import { Platform, View, type ViewProps } from 'react-native'
import * as React from 'react'

type Variante = 'regular' | 'clear'

interface VidroProps extends ViewProps {
  raio?: number
  variante?: Variante
  /** Vidro que reage ao toque, como os botoes do iOS 26. */
  interativo?: boolean
  /** `#RRGGBB` ou `#RRGGBBAA` que tinge o material. */
  tonalidade?: string
}

const disponivel = Platform.OS === 'ios'

const modulo = disponivel ? requireNativeModule('Vidro') : null
const VistaNativa = disponivel ? requireNativeViewManager<VidroProps>('Vidro') : null

/** true quando o material Liquid Glass do sistema existe (iOS 26+). */
export function temLiquidGlass(): boolean {
  try {
    return modulo?.temLiquidGlass?.() ?? false
  } catch {
    return false
  }
}

/**
 * Superficie de vidro do sistema. No Android, e no iOS antigo sem o modulo,
 * vira uma View comum — quem chama poe uma cor de fundo por baixo.
 */
export function Vidro({
  raio = 0,
  variante = 'regular',
  interativo = false,
  tonalidade,
  style,
  children,
  ...resto
}: VidroProps) {
  if (!VistaNativa) return <View style={style} {...resto}>{children}</View>
  return (
    <View style={style} {...resto}>
      <VistaNativa
        raio={raio}
        variante={variante}
        interativo={interativo}
        tonalidade={tonalidade}
        style={{ position: 'absolute', inset: 0 }}
      />
      {children}
    </View>
  )
}
