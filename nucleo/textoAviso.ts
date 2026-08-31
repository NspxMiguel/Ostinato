// O texto que chega no telefone.
//
// Fica no núcleo, e não na camada de notificação, por dois motivos: é testável
// sem simulador, e quando o Android entrar o texto já vem pronto e traduzido.

import type { Compromisso, Materia } from './modelo.ts'
import type { AvisoAgendado } from './planejador.ts'
import type { criarT } from './i18n.ts'

type T = ReturnType<typeof criarT>

export type TextoAviso = { titulo: string; corpo: string }

/**
 * A distância é contada do disparo até o vencimento, e arredondada para a unidade
 * que uma pessoa usaria: "em 3 dias", "amanhã", "em 2 horas". Dizer "em 71 horas"
 * é tecnicamente certo e humanamente inútil.
 */
export function textoDoAviso(
  aviso: AvisoAgendado,
  c: Compromisso,
  materia: Materia | undefined,
  t: T,
): TextoAviso {
  const tipo = t(`compromisso.tipo.singular.${c.tipo}` as never)
  const titulo = t('notificacao.titulo', { tipo, titulo: c.titulo })
  const sufixoMateria = materia ? ` · ${materia.nome}` : ''

  const faltamMin = Math.round((aviso.vencimentoEm.getTime() - aviso.quando.getTime()) / 60_000)

  // O singular tem chave propria em vez de {n}: "Em 1 horas" chega no telefone
  // da pessoa, e e onde um app parece inacabado.
  const corpo = (chave: 'minuto' | 'minutos' | 'hora' | 'horas' | 'dia' | 'dias', n?: number) =>
    t(`notificacao.corpo.${chave}` as never, { n: n ?? 1, materia: sufixoMateria })

  // Já passou do prazo.
  //
  // Ficou possível quando a faixa de silêncio passou a EMPURRAR avisos: um aviso
  // das 5h de um trabalho das 6h vai para as 7h, e chega depois. Antes isso caía
  // no ramo do "agora" — dizer "agora" sobre o que já passou é o app mentindo
  // no momento em que a pessoa mais precisa da verdade.
  if (faltamMin < 0) {
    return { titulo, corpo: t('notificacao.corpo.passou', { materia: sufixoMateria }) }
  }
  if (faltamMin <= 1) return { titulo, corpo: t('notificacao.corpo.agora', { materia: sufixoMateria }) }
  if (faltamMin < 60) return { titulo, corpo: corpo(faltamMin === 1 ? 'minuto' : 'minutos', faltamMin) }
  if (faltamMin < 60 * 20) {
    const horas = Math.round(faltamMin / 60)
    return { titulo, corpo: corpo(horas === 1 ? 'hora' : 'horas', horas) }
  }
  // "Amanhã" so ate 30 horas. Com a faixa larga demais, 38 horas viravam
  // "amanhã" quando o prazo e depois de amanha — e o aviso passa a mentir.
  if (faltamMin < 60 * 30) return { titulo, corpo: t('notificacao.corpo.amanha', { materia: sufixoMateria }) }
  const dias = Math.round(faltamMin / (60 * 24))
  return { titulo, corpo: corpo(dias === 1 ? 'dia' : 'dias', dias) }
}
