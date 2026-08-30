// A porta de entrada de fora do app, e o que ela aceita.
//
// `ostinato://anotar?texto=prova%20de%20mat%20sexta` abre a captura com a frase
// já escrita. É o que faz a Siri e os Atalhos funcionarem HOJE: a pessoa monta
// um atalho de uma linha ("Abrir URL"), dá o nome que quiser, e passa a ditar
// para a Siri — sem o app precisar de conta paga nem de extensão.
//
// É também o encaixe do que vem depois: Spotlight, Toque nas Costas, botão da
// Central de Controle e item na tela de bloqueio abrem uma URL, e todos caem
// aqui.
//
// A leitura mora no núcleo, e não na tela, por um motivo de segurança: isto é
// entrada de FORA do app, e entrada de fora se valida em código testável. Tudo
// o que não for exatamente reconhecido vira `null` — nunca um comando parecido.

export type Atalho =
  /** Abre a captura, opcionalmente já com o texto. */
  | { tipo: 'anotar'; texto?: string }
  /** Abre um compromisso específico. É o que o Spotlight vai usar. */
  | { tipo: 'abrir'; id: string }

export function lerAtalho(url: string | null | undefined): Atalho | null {
  if (!url) return null
  let alvo: URL
  try {
    alvo = new URL(url)
  } catch {
    return null
  }
  if (alvo.protocol !== 'ostinato:') return null

  const caminho = `${alvo.host}${alvo.pathname}`.replace(/\/+$/, '')

  if (caminho === 'anotar') {
    const texto = alvo.searchParams.get('texto') ?? alvo.searchParams.get('text')
    return texto ? { tipo: 'anotar', texto } : { tipo: 'anotar' }
  }
  if (caminho === 'abrir') {
    const id = alvo.searchParams.get('id')
    return id ? { tipo: 'abrir', id } : null
  }
  return null
}
