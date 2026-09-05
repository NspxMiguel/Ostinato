// Correção que a própria pessoa fez, mandada pro servidor — SÓ quando ela
// ligou "Ajudar a treinar" nos Ajustes (`ajustes.ajudarATreinar`).
//
// Pedido em 05/09/2026: *"coloca pra ao usuario colocar um, ir ajudando a
// treinar, ou seja, quanto mais gente coloca foto, mais esperto o app fica,
// tanto calendario tanto aulas da semana e etc"*.
//
// Diferente de telemetria.ts (que nunca leva o que foi digitado), este
// arquivo manda TEXTO DE VERDADE — o nome de um evento de calendário, o nome
// de uma matéria. Por isso é opt-in, desligado por padrão, e vai para um
// endpoint SEPARADO (`ostinato-treino`, não `ostinato-logs`) — ver
// nucleo/legal.ts para o texto exato mostrado à pessoa antes de ligar.
//
// Nunca trava o app: fire-and-forget, com try/catch em volta.
import { usarLoja } from './estado/loja.ts'

const ENDPOINT = 'https://api.nspx.dev/ostinato-treino'

/**
 * `tipo` separa a origem (calendário vs grade) sem precisar de endpoint
 * próprio para cada uma — é só um rótulo para eu filtrar depois.
 */
export function enviarCorrecao(tipo: 'calendario' | 'grade', antes: string, depois: string): void {
  try {
    if (!usarLoja.getState().ajustes.ajudarATreinar) return
    // Nada a aprender de uma correção vazia ou idêntica ao que já estava lá.
    if (!antes.trim() || !depois.trim() || antes === depois) return
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, antes, depois }),
    }).catch(() => {})
  } catch {
    // Nem isto pode derrubar o app.
  }
}
