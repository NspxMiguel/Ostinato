// Log de erro real, mandado pra fora — pra ele poder olhar o que quebrou sem
// precisar do aparelho na mão.
//
// Pedido em 04/09/2026: *"telemetria dos users quero, tipo toda vez ele
// manda um log pro servidor, dai dps tu checa os logs e vai vendo os erros e
// arrumando"*.
//
// Regras deste arquivo:
//   - NUNCA trava o app. Toda chamada é fire-and-forget, com try/catch em
//     volta — um log que falha não pode virar um segundo erro;
//   - NUNCA manda dado pessoal. Nome, matéria, título de tarefa, texto de
//     OCR — nada disso sai daqui. Só a MENSAGEM do erro, onde ele aconteceu,
//     e um id aleatório do aparelho (não é o dele, é um UUID gerado local);
//   - o endpoint é configurável e pode estar fora do ar sem quebrar nada —
//     `fetch` que falha é engolido, silencioso.
import { idDesteAparelho } from './estado/armazenamento.ts'
import { VERSAO } from './versao.ts'

/** Onde os logs chegam. Servidor caseiro (Raspberry Pi), atrás do túnel —
 * ver PEDIDOS.md. Ainda NÃO está no ar (04/09/2026): o endpoint existe no
 * código, mas o servidor que recebe ainda não foi ligado. */
const ENDPOINT = 'https://api.nspx.dev/ostinato-logs'

/**
 * Manda um erro pro servidor. Fire-and-forget: quem chama não espera, e se
 * falhar (sem rede, servidor fora do ar), morre em silêncio.
 */
export function registrarErro(onde: string, erro: unknown): void {
  try {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    const pilha = erro instanceof Error ? (erro.stack ?? '').split('\n').slice(0, 6).join('\n') : ''
    const corpo = {
      aparelho: idDesteAparelho(),
      versao: VERSAO,
      onde,
      mensagem,
      pilha,
      quando: new Date().toISOString(),
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    }).catch(() => {})
  } catch {
    // Nem o log pode derrubar o app.
  }
}

/**
 * Liga o coletor global — todo erro JS não tratado (fora de um try/catch)
 * passa por aqui. Chamar uma vez, cedo, no Raiz.tsx.
 */
export function ligarTelemetria(): void {
  const original = ErrorUtils.getGlobalHandler()
  ErrorUtils.setGlobalHandler((erro, ehFatal) => {
    registrarErro(ehFatal ? 'fatal' : 'nao-tratado', erro)
    original(erro, ehFatal)
  })
}
