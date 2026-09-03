// A costura entre a leitura, a decisão e a IA do aparelho.
//
// Fica separado das telas porque as DUAS telas precisam — o horário na Grade e
// a foto de tarefa na Captura — e porque a regra de quando chamar o modelo é
// pura e mora no núcleo. Aqui só tem I/O.
//
// O contrato que atravessa este arquivo inteiro: falhar aqui nunca piora nada.
// Modelo indisponível, modelo lento, modelo devolvendo bobagem — em todos os
// casos volta o que o algoritmo já tinha lido, e a pessoa nem fica sabendo.

import {
  importarGrade,
  type AulaCrua,
  type ResultadoImportacao,
} from '../../nucleo/importarGrade.ts'
import type { Idioma } from '../../nucleo/i18n.ts'
import { interpretarMelhor, type Interpretacao } from '../../nucleo/linguagem.ts'
import {
  diaDoModeloParaApp,
  diaValido,
  horaValida,
  instrucoesDeFrase,
  tabelaComoTexto,
  tabelaDoTexto,
  instrucoesDeGrade,
  instrucoesDeTarefa,
  limparResposta,
  precisaDeResgateDeFrase,
  precisaDeResgateDeGrade,
  precisaDeResgateDeTarefa,
  vale,
} from '../../nucleo/resgate.ts'
import { aulasDaTabela } from '../../nucleo/gradeDaTabela.ts'
import { NOTA_MINIMA, qualidadeDaGrade } from '../../nucleo/qualidadeDaGrade.ts'
import { estadoDoModelo, lerGradeComModelo, perguntar } from '../modules/modelo/src/index.ts'

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
export async function analisarGrade(
  texto: string,
  _confianca = 1,
  tabela: readonly (readonly string[])[] = [],
): Promise<Analise> {
  // A grade em tabela é lida por REGRA, antes de qualquer modelo.
  //
  // Com a grade correta, um horário é a coisa mais determinística que existe:
  // uma linha de dias, uma coluna de horas, e o resto são células. O modelo
  // estava compensando uma entrada que eu tinha quebrado — e para o caminho
  // normal ele é pior: mais lento, e capaz de inventar aula que não existe.
  // Texto colado que JÁ é grade conta como tabela: é o mesmo dado, e mandar
  // para o modelo o que a regra resolve na hora é só desperdício com risco.
  const grade = tabela.length > 1 ? tabela : tabelaDoTexto(texto)
  if (grade.length > 1) {
    const daTabela = aulasDaTabela(grade)
    // A regra só encerra quando o resultado dela se sustenta.
    //
    // Ele apontou o buraco: *"mas tem q passar pela ia, vai q o cara escreve na
    // mao"*. Grade escrita à mão, ou em prosa, produz uma tabela torta que a
    // regra às vezes lê PELA METADE — e meia leitura encerrando o caminho é
    // pior que nenhuma, porque nunca chega no modelo, que é quem sabe ler
    // texto solto.
    //
    // Então a qualidade decide: boa, a regra ganha e é instantânea; ruim, o
    // modelo tenta, e fica quem ler melhor.
    if (daTabela.length > 0 && (qualidadeDaGrade(daTabela).nota >= NOTA_MINIMA || !temModelo())) {
      return {
        resultado: {
          aulas: daTabela,
          materias: [...new Set(daTabela.map((a) => a.materia))],
          ignoradas: [],
          formato: 'tabela',
        },
        texto,
        usou: false,
        aviso: null,
      }
    }
  }

  const doAlgoritmo = importarGrade(texto)
  if (texto.trim().length < 12) {
    return { resultado: doAlgoritmo, texto, usou: false, aviso: null }
  }
  if (!temModelo()) {
    return { resultado: doAlgoritmo, texto, usou: false, aviso: motivoDaIa() }
  }

  // A IA é o LEITOR agora, não o resgate.
  //
  // Pedido dele em 30/08/2026: *"coloca logo a merda da ia local para
  // interpretar foto, n funciona por algoritmo nao"*. Ele tem razão, e o motivo
  // é que horário escolar não tem formato: cada escola imprime do seu jeito, com
  // célula mesclada, matéria abreviada e coluna que não fecha. Regex acerta o
  // formato que eu previ e erra todo o resto — e quem usa não tem como saber em
  // qual dos dois caiu. Condicionar a IA a "o algoritmo falhou de um jeito
  // específico" era eu decidindo por ele, e ele já disse duas vezes que não.
  // A TABELA vai na frente do texto solto.
  //
  // É o conserto do que ele reclamou: o modelo recebia o texto já achatado, com
  // a grade perdida, e nenhum modelo recupera uma tabela que virou linha corrida.
  // Quando o Vision devolve a tabela, é ela que vai — com as colunas marcadas.
  const entrada = tabela.length > 1 ? tabelaComoTexto(tabela) : texto
  const doModelo = await lerGradeComModelo(entrada)
  if (!doModelo || doModelo.length === 0) {
    return { resultado: doAlgoritmo, texto, usou: false, aviso: null }
  }

  const aulas = doModelo
    .filter(
      (a) => diaValido(a.dia) && horaValida(a.inicio) && horaValida(a.fim) && a.materia.trim() !== '',
    )
    .map((a) => ({
      diaSemana: diaDoModeloParaApp(a.dia) as AulaCrua['diaSemana'],
      inicio: a.inicio as AulaCrua['inicio'],
      fim: a.fim as AulaCrua['fim'],
      materia: a.materia.trim(),
      // Alta de propósito: o que veio do modelo já passou pela peneira acima, e
      // a prévia usa este número para decidir o que destacar como duvidoso.
      confianca: 0.9,
    }))

  // O modelo pode inventar, e a peneira acima corta o que não é hora nem dia.
  // Se sobrou menos do que o algoritmo já tinha lido, o algoritmo fica: o
  // objetivo é ler MAIS, não trocar de método por trocar.
  // O modelo compete com o MELHOR que veio antes — a regra ou o parser antigo —
  // e vence por qualidade, não por quantidade: quinze aulas erradas não valem
  // mais que cinco certas.
  const daRegra = grade.length > 1 ? aulasDaTabela(grade) : []
  const anterior = daRegra.length > doAlgoritmo.aulas.length ? daRegra : doAlgoritmo.aulas
  if (qualidadeDaGrade(aulas).nota <= qualidadeDaGrade(anterior).nota) {
    return {
      resultado: daRegra.length > doAlgoritmo.aulas.length
        ? {
            aulas: daRegra,
            materias: [...new Set(daRegra.map((a) => a.materia))],
            ignoradas: [],
            formato: 'tabela',
          }
        : doAlgoritmo,
      texto,
      usou: false,
      aviso: null,
    }
  }

  const materias = [...new Set(aulas.map((a) => a.materia))]
  return {
    resultado: { aulas, materias, ignoradas: [], formato: 'ia' },
    texto,
    usou: true,
    aviso: null,
  }
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
