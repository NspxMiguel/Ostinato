import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { usarLoja } from './estado/loja.ts'
import { usarT } from './i18n.ts'

/**
 * Casca provisória. As telas entram aqui; por enquanto ela existe para o app
 * subir no simulador e provar que o núcleo, o armazenamento e o i18n conversam.
 */
export function Raiz() {
  const t = usarT()
  const base = usarLoja((e) => e.base)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    setPronto(true)
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text style={{ fontSize: 32, fontWeight: '700' }}>Giz</Text>
      <Text>{t('abas.hoje')}</Text>
      <Text>
        {Object.keys(base.materias).length} · {String(pronto)}
      </Text>
    </View>
  )
}
