// O corpus do calendário roda contra o MESMO par que a tela usa de verdade:
// `lerCalendario` (o parser, em `importarCalendario.ts`) e a classificação
// `EfeitoNoDia` que ele já embute (via `classificar`, em
// `calendarioEscolar.ts`). Não existe um classificador paralelo aqui — seria
// exatamente o tipo de duplicação que diverge sozinha.
//
// Como nenhuma corrupção do corpus toca no TEXTO do evento (só na estrutura:
// cabeçalho, conector, dígito do dia, ordem, lixo entre linhas — ver
// `corpus-calendario/builder.ts`), o `efeito` de um evento encontrado é
// SEMPRE igual ao esperado quando o texto bate — `classificar` é uma função
// pura do texto, e o texto não muda. O que pode dar errado, então, é só uma
// destas três coisas por evento esperado:
//
//   correto     — achado, na data certa.
//   ausente     — não achado. Incompleto, mas seguro: nada de errado foi
//                 afirmado, o evento só não apareceu.
//   dataErrada  — achado, mas em outra data. Isto é o perigoso: alguém vê o
//                 evento certo no dia errado e não tem como saber.
//
// `dataErrada` fora dos casos marcados `silencioEsperado` é falha de teste —
// é a mesma disciplina do corpus da grade horária (`corpus.test.ts`): ponto
// cego é aceitável quando documentado, nunca quando aparece sem ninguém ter
// decidido isso de propósito.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerCalendario, type EventoLido } from '../importarCalendario.ts'
import { CORPUS, type CorpusCase } from './corpus-calendario/cases.ts'
import type { EventoEsperado } from './corpus-calendario/builder.ts'

type Resultado = 'correto' | 'ausente' | 'dataErrada'

function avaliarEvento(esperado: EventoEsperado, atuais: readonly EventoLido[]): Resultado {
  const achado = atuais.find((a) => a.texto === esperado.texto)
  if (!achado) return 'ausente'
  return achado.inicio === esperado.inicio && achado.fim === esperado.fim ? 'correto' : 'dataErrada'
}

type Avaliacao = { caso: CorpusCase; resultados: { esperado: EventoEsperado; resultado: Resultado }[] }

function avaliarCaso(caso: CorpusCase): Avaliacao {
  const atuais = lerCalendario(caso.texto, caso.ano)
  return {
    caso,
    resultados: caso.esperado.map((esperado) => ({ esperado, resultado: avaliarEvento(esperado, atuais) })),
  }
}

test('o corpus tem pelo menos 300 calendários', () => {
  assert.ok(CORPUS.length >= 300, `corpus tem ${CORPUS.length}, precisa de >= 300`)
})

test('nenhum nome de caso se repete', () => {
  const nomes = CORPUS.map((c) => c.name)
  assert.equal(new Set(nomes).size, nomes.length, 'há nomes duplicados no corpus')
})

test('todo caso tem pelo menos um evento esperado', () => {
  const vazios = CORPUS.filter((c) => c.esperado.length === 0)
  assert.equal(vazios.length, 0, `${vazios.length} caso(s) sem nenhum evento esperado: ${vazios.map((c) => c.name).join(', ')}`)
})

test('resumo do corpus inteiro', () => {
  const avaliacoes = CORPUS.map(avaliarCaso)
  const todos = avaliacoes.flatMap((a) => a.resultados)

  const corretos = todos.filter((r) => r.resultado === 'correto')
  const ausentes = todos.filter((r) => r.resultado === 'ausente')
  const errados = todos.filter((r) => r.resultado === 'dataErrada')

  const errosPorCaso = avaliacoes.filter((a) => a.resultados.some((r) => r.resultado === 'dataErrada'))
  const errosConhecidos = errosPorCaso.filter((a) => a.caso.silencioEsperado)
  const errosNovos = errosPorCaso.filter((a) => !a.caso.silencioEsperado)

  console.log('')
  console.log('═══ corpus do calendário escolar — resumo ═══')
  console.log(`calendários no corpus:         ${CORPUS.length}`)
  console.log(`eventos esperados no total:     ${todos.length}`)
  console.log(`  corretos (data certa):        ${corretos.length}`)
  console.log(`  ausentes (sumiu, seguro):      ${ausentes.length}`)
  console.log(`  data errada (perigoso):        ${errados.length}`)
  console.log(`casos com pelo menos 1 data errada: ${errosPorCaso.length}`)
  console.log(`  ponto cego DOCUMENTADO:          ${errosConhecidos.length}`)
  console.log(`  NÃO documentado (regressão):     ${errosNovos.length}`)
  console.log('══════════════════════════════════════════')
  if (errosNovos.length > 0) {
    console.log('casos com data errada fora do que era esperado:')
    for (const a of errosNovos) {
      const ruins = a.resultados.filter((r) => r.resultado === 'dataErrada')
      console.log(`  - ${a.caso.name}: ${ruins.map((r) => r.esperado.texto).join(' | ')}`)
    }
  }
  console.log('')

  assert.equal(
    errosNovos.length,
    0,
    `${errosNovos.length} caso(s) com data errada sem estar marcados como ponto cego conhecido`,
  )
})

test('nos casos limpos e reais (sem corrupção), todo evento esperado sai correto', () => {
  const semCorrupcao = CORPUS.filter((c) => c.name.startsWith('real-') || c.name.startsWith('limpo-'))
  assert.ok(semCorrupcao.length >= 200, `esperava >= 200 casos sem corrupção, achei ${semCorrupcao.length}`)

  const falhas: string[] = []
  for (const caso of semCorrupcao) {
    const avaliacao = avaliarCaso(caso)
    for (const r of avaliacao.resultados) {
      if (r.resultado !== 'correto') falhas.push(`${caso.name}: "${r.esperado.texto}" → ${r.resultado}`)
    }
  }
  if (falhas.length > 0) {
    assert.fail(`${falhas.length} evento(s) não saíram corretos em casos sem corrupção:\n${falhas.slice(0, 20).join('\n')}`)
  }
})

test('os pontos cegos documentados continuam existindo (senão a marcação está velha)', () => {
  const documentados = CORPUS.filter((c) => c.silencioEsperado)
  assert.ok(documentados.length > 0, 'o corpus precisa de pelo menos um caso de ponto cego documentado')

  const semDataErrada = documentados.filter((c) => {
    const avaliacao = avaliarCaso(c)
    return !avaliacao.resultados.some((r) => r.resultado === 'dataErrada')
  })
  assert.equal(
    semDataErrada.length,
    0,
    `${semDataErrada.length} caso(s) marcados como ponto cego já não produzem data errada — atualizar o corpus: ${semDataErrada.map((c) => c.name).join(', ')}`,
  )
})

test('corrupções que só derrubam a linha ou o mês inteiro (ruído de OCR, "de X a Y", lixo, mês abreviado) nunca produzem data errada — só ausência', () => {
  const seguras = CORPUS.filter(
    (c) =>
      !c.silencioEsperado &&
      (c.name.includes('ruido-de-ocr') ||
        c.name.includes('prefixo-de-no-intervalo') ||
        c.name.includes('linha-de-lixo') ||
        c.name.includes('mes-abreviado')),
  )
  assert.ok(seguras.length > 0, 'esperava casos desses três tipos de corrupção "segura"')
  for (const caso of seguras) {
    const avaliacao = avaliarCaso(caso)
    const errados = avaliacao.resultados.filter((r) => r.resultado === 'dataErrada')
    assert.equal(errados.length, 0, `"${caso.name}" produziu data errada, mas devia só perder o evento`)
  }
})
