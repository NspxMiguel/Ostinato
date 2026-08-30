import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Raiz } from './src/Raiz'

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Raiz />
    </SafeAreaProvider>
  )
}
