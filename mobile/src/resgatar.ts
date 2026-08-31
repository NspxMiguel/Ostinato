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
import type { Idioma } from '../../nucleo/i18n.ts'
import { interpretarMelhor, type Interpretacao } from '../../nucleo/linguagem.ts'
import {
  instrucoesDeFrase,
  instrucoesDeGrade,
  instrucoesDeTarefa,
  limparResposta,
  precisaDeResgateDeFrase,
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
 * A chave de tradução que explica por que a IA não entrou, ou `null` se entrou.
 *
 * Existe porque a versão anterior falhava em SILÊNCIO: quem estivesse com a
 * Apple Intelligence desligada via o texto cru aparecer e concluía que a IA não
 * fazia nada. Dizer "está baixando" ou "ligue nos Ajustes do iPhone" é a
 * diferença entre um app quebrado e um app esperando.
 */
export function motivoDaIa(): string | null {
  switch (estadoDoModelo()) {
    case 'pronto':
      return null
    case 'baixando':
      return 'resgate.ia_baixando'
    case 'apple-intelligence-desligada':
      return 'resgate.ia_desligada'
    default:
      return 'resgate.ia_sem_suporte'
  }
}

/**
 * Tenta melhorar um horário fotografado que saiu mal lido.
 *
 * Devolve o texto que deve ficar no campo — o normalizado quando o resgate
 * valeu, e o original quando não valeu. O `usou` serve para a tela dizer que a
 * IA entrou, porque texto mudando sozinho sem explicação assusta.
 */
export type Analise = {
  /** O que o parser leu, já com o resgate aplicado quando ele valeu. */
  resultado: ResultadoImportacao
  /** O texto correspondente — muda quando a IA reescreveu. */
  texto: string
  usou: boolean
  /** Chave de tradução quando a IA era necessária e não estava disponível. */
  aviso: string | null
}

/**
 * Lê o horário, e chama a IA do aparelho quando o algoritmo não deu conta.
 *
 * Isto acontece na hora de ANALISAR, e não na hora da foto, por dois motivos:
 * o texto colado à mão passa a ganhar o mesmo resgate que a foto, e a espera
 * cai num momento em que a pessoa já está esperando resposta.
 *
 * `confianca` é 1 quando o texto não veio de foto — sem OCR não há o que medir,
 * e a regra de "nenhuma aula lida" cobre esse caso sozinha.
 */
export async function analisarGrade(texto: string, confianca = 1): Promise<Analise> {
  const antes = importarGrade(texto)
  const gatilho =
    texto.trim().length >= 12 &&
    precisaDeResgateDeGrade({
      confianca,
      aulas: antes.aulas.length,
      ignoradas: antes.ignoradas.length,
    })
  if (!gatilho) return { resultado: antes, texto, usou: false, aviso: null }
  if (!temModelo()) return { resultado: antes, texto, usou: false, aviso: motivoDaIa() }

  const bruto = await perguntar(instrucoesDeGrade(), texto)
  if (!bruto) return { resultado: antes, texto, usou: false, aviso: null }

  const limpo = limparResposta(bruto)
  const depois = importarGrade(limpo)
  // O algoritmo continua sendo o juiz: o modelo só vence quando o resultado
  // dele passa pelo MESMO parser e sai com mais aula.
  if (!vale({ aulas: antes.aulas.length }, { aulas: depois.aulas.length })) {
    return { resultado: antes, texto, usou: false, aviso: null }
  }
  return { resultado: depois, texto: limpo, usou: true, aviso: null }
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

/**
 * Tenta entender uma frase que o interpretador não conseguiu ler.
 *
 * O juiz continua sendo o algoritmo: a frase reescrita só vence se, passando
 * pelo MESMO interpretador, sair com confiança maior. Modelo que reescreve
 * bonito e piora a leitura perde.
 */
export async function resgatarFrase(
  texto: string,
  agora: Date,
  idioma: Idioma,
): Promise<{ texto: string; usou: boolean }> {
  let antes: Interpretacao
  try {
    antes = interpretarMelhor(texto, agora, idioma)
  } catch {
    return { texto, usou: false }
  }
  const gatilho = precisaDeResgateDeFrase({
    confianca: antes.confianca,
    faltando: antes.faltando,
    texto,
  })
  if (!gatilho || !temModelo()) return { texto, usou: false }

  const bruto = await perguntar(instrucoesDeFrase(), texto)
  if (!bruto) return { texto, usou: false }

  const limpo = limparResposta(bruto).split('\n')[0]?.trim() ?? ''
  if (limpo.length < 4) return { texto, usou: false }

  try {
    const depois = interpretarMelhor(limpo, agora, idioma)
    if (depois.confianca <= antes.confianca) return { texto, usou: false }
    return { texto: limpo, usou: true }
  } catch {
    return { texto, usou: false }
  }
}
