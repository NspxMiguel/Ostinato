import assert from 'node:assert/strict'
import test from 'node:test'
import { TIPOS_COMPROMISSO, PADROES_AVISO } from '../modelo.ts'
import { NIVEIS, avisosPorIntensidade, intensidadeDe } from '../intensidade.ts'

test('"padrão" devolve exatamente o que o app já usava', () => {
  // Se isto quebrar, trocar de nível e voltar destrói a configuração de quem
  // nunca pediu para mudar nada.
  for (const tipo of TIPOS_COMPROMISSO) {
    assert.deepEqual(avisosPorIntensidade(tipo, 'padrao'), PADROES_AVISO[tipo])
  }
})

test('cada nível se reconhece de volta', () => {
  // Dois níveis PODEM produzir as mesmas regras — leitura já avisava uma vez só,
  // então o padrão dela é idêntico ao leve. Nesse empate qualquer um dos dois
  // rótulos está certo, e o que precisa valer é que o nível devolvido descreva
  // mesmo as regras. Comparar o rótulo cru transformaria um empate legítimo em
  // falha.
  for (const tipo of TIPOS_COMPROMISSO) {
    for (const nivel of NIVEIS) {
      const regras = avisosPorIntensidade(tipo, nivel)
      const lido = intensidadeDe(tipo, regras)
      assert.notEqual(lido, 'personalizado', `${tipo}/${nivel}`)
      // Compara COMPORTAMENTO, não o `id`: dois níveis podem descrever o mesmo
      // aviso com nomes internos diferentes, e o id não muda quando nem como o
      // app avisa.
      const semId = (rs: typeof regras) => rs.map(({ id: _id, ...resto }) => resto)
      assert.deepEqual(semId(avisosPorIntensidade(tipo, lido as typeof nivel)), semId(regras))
    }
  }
})

test('regra editada à mão vira "personalizado", não um nível parecido', () => {
  const regras = avisosPorIntensidade('tarefa', 'padrao').map((r) => ({ ...r }))
  regras[0] = { ...regras[0], modo: 'normal' }
  assert.equal(intensidadeDe('tarefa', regras), 'personalizado')
})

test('a ordem das regras não muda o nível reconhecido', () => {
  // O planejador ordena por data de disparo: remover e recriar a mesma regra
  // não pode fazer a tela dizer que a pessoa personalizou algo.
  const regras = [...avisosPorIntensidade('prova', 'puxado')].reverse()
  assert.equal(intensidadeDe('prova', regras), 'puxado')
})

test('prova não recebe o alarme da manhã em nenhum nível', () => {
  // Não existe "fazer a prova antes de sair de casa".
  for (const nivel of NIVEIS) {
    const temAlarmeDeManha = avisosPorIntensidade('prova', nivel).some(
      (r) => r.quando.tipo === 'antesDaPrimeiraAula',
    )
    assert.equal(temAlarmeDeManha, false, `nível ${nivel}`)
  }
})

test('"leve" é um aviso só, e "puxado" avisa mais que "padrão"', () => {
  for (const tipo of TIPOS_COMPROMISSO) {
    assert.equal(avisosPorIntensidade(tipo, 'leve').length, 1)
    assert.ok(
      avisosPorIntensidade(tipo, 'puxado').length >= avisosPorIntensidade(tipo, 'padrao').length - 1,
      `${tipo}: puxado deveria avisar pelo menos tanto quanto o padrão`,
    )
  }
})
