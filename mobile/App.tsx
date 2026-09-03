import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Raiz } from './src/Raiz'

export default function App() {
  return (
    // `GestureHandlerRootView` é OBRIGATÓRIO para o arrastar da lista funcionar,
    // e a falta dele não dá erro: o gesto simplesmente não acontece.
    //
    // É a mesma armadilha da permissão de alarme que nunca era pedida — a peça
    // que falta não reclama, ela só faz o recurso parecer quebrado.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Raiz />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
