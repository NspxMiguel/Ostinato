// A costura entre a leitura, a decisão e a IA do aparelho.
//
// Fica separado das telas porque as DUAS telas precisam — o horário na Grade e
// a foto de tarefa na Captura — e porque a regra de quando chamar o modelo é
// pura e mora no núcleo. Aqui só tem I/O.
//
// O contrato que atravessa este arquivo inteiro: falhar aqui nunca piora nada.
// Modelo indisponível, modelo lento, modelo devolvendo bobagem — em todos os
// casos volta o que o algoritmo já tinha lido, e a pessoa nem fica sabendo.

import { importarGrade, type ResultadoImportacao } from '../../nucleo/importarGrade.ts'
import {
  instrucoesDeGrade,
  instrucoesDeTarefa,
  limparResposta,
  precisaDeResgateDeGrade,
  precisaDeResgateDeTarefa,
  vale,
} from '../../nucleo/resgate.ts'
import { estadoDoModelo, perguntar } from '../modules/modelo/src/index.ts'

/** Se a IA do aparelho está pronta agora. */
export function temModelo(): boolean {
  return estadoDoModelo() === 'pronto'
}

/**
 * Tenta melhorar um horário fotografado que saiu mal lido.
 *
 * Devolve o texto que deve ficar no campo — o normalizado quando o resgate
 * valeu, e o original quando não valeu. O `usou` serve para a tela dizer que a
 * IA entrou, porque texto mudando sozinho sem explicação assusta.
 */
export async function resgatarGrade(
  texto: string,
  confianca: number,
): Promise<{ texto: string; usou: boolean }> {
  const antes: ResultadoImportacao = importarGrade(texto)
  const gatilho = precisaDeResgateDeGrade({
    confianca,
    aulas: antes.aulas.length,
    ignoradas: antes.ignoradas.length,
  })
  if (!gatilho || !temModelo()) return { texto, usou: false }

  const bruto = await perguntar(instrucoesDeGrade(), texto)
  if (!bruto) return { texto, usou: false }

  const limpo = limparResposta(bruto)
  const depois = importarGrade(limpo)
  // O algoritmo continua sendo o juiz: o modelo só vence quando o resultado
  // dele passa pelo MESMO parser e sai com mais aula.
  if (!vale({ aulas: antes.aulas.length }, { aulas: depois.aulas.length })) {
    return { texto, usou: false }
  }
  return { texto: limpo, usou: true }
}

/**
 * Idem para a foto de uma anotação de tarefa.
 *
 * Aqui não existe parser para servir de juiz, então o critério é mais bruto: a
 * resposta tem que ter conteúdo e não pode ser maior que o original. Modelo que
 * responde mais do que recebeu está escrevendo, não consertando.
 */
export async function resgatarTarefa(
  texto: string,
  confianca: number,
): Promise<{ texto: string; usou: boolean }> {
  if (!precisaDeResgateDeTarefa({ confianca, texto }) || !temModelo()) {
    return { texto, usou: false }
  }
  const bruto = await perguntar(instrucoesDeTarefa(), texto)
  if (!bruto) return { texto, usou: false }

  const limpo = limparResposta(bruto)
  if (limpo.length < 4 || limpo.length > texto.length * 2) return { texto, usou: false }
  return { texto: limpo, usou: true }
}
