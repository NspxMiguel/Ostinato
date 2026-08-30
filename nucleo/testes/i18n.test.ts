import test from 'node:test'
import assert from 'node:assert/strict'
import { criarT } from '../i18n.ts'
import { MARCA } from '../marca.ts'

test('marca do aplicativo possui valores corretos', () => {
  assert.equal(MARCA.nome, 'Giz')
  assert.equal(MARCA.identificador, 'dev.nspx.giz')
})

test('traduções básicas em português', () => {
  const t = criarT('pt')
  assert.equal(t('abas.hoje'), 'Hoje')
  assert.equal(t('abas.agenda'), 'Agenda')
})

test('traduções básicas em inglês', () => {
  const t = criarT('en')
  assert.equal(t('abas.hoje'), 'Today')
  assert.equal(t('abas.agenda'), 'Schedule')
})

test('interpolação de variáveis', () => {
  const tPt = criarT('pt')
  const tEn = criarT('en')

  assert.equal(
    tPt('hoje.aviso_quando', { quando: 'às 10h' }),
    'Avisa você às 10h'
  )
  assert.equal(
    tEn('hoje.aviso_quando', { quando: 'at 10:00' }),
    'Alerts you at 10:00'
  )
})

test('fallback de chave inexistente', () => {
  const t = criarT('en')
  // Força uma chave inexistente para testar a robustez em tempo de execução
  const tInseguro = t as unknown as (chave: string) => string
  assert.equal(tInseguro('chave.inexistente'), 'chave.inexistente')
})
