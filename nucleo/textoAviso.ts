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

  if (faltamMin <= 1) return { titulo, corpo: t('notificacao.corpo.agora', { materia: sufixoMateria }) }
  if (faltamMin < 60)
    return { titulo, corpo: t('notificacao.corpo.minutos', { n: faltamMin, materia: sufixoMateria }) }
  if (faltamMin < 60 * 20)
    return {
      titulo,
      corpo: t('notificacao.corpo.horas', { n: Math.round(faltamMin / 60), materia: sufixoMateria }),
    }
  if (faltamMin < 60 * 40) return { titulo, corpo: t('notificacao.corpo.amanha', { materia: sufixoMateria }) }
  return {
    titulo,
    corpo: t('notificacao.corpo.dias', {
      n: Math.round(faltamMin / (60 * 24)),
      materia: sufixoMateria,
    }),
  }
}
