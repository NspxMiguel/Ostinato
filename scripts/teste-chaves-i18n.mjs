/**
 * Teste de verificação de chaves de internacionalização (i18n).
 * Garante que todas as chaves usadas nas telas existam em português e em inglês,
 * e que não haja chaves declaradas em português faltando tradução em inglês.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

// Função recursiva para listar todos os arquivos de um diretório com extensões permitidas
function obterArquivos(diretorio, extensoes = ['.ts', '.tsx', '.js', '.jsx']) {
  if (!existsSync(diretorio)) return []
  const saida = []
  for (const nome of readdirSync(diretorio)) {
    if (nome === 'node_modules' || nome.startsWith('.')) continue
    const caminho = join(diretorio, nome)
    if (statSync(caminho).isDirectory()) {
      saida.push(...obterArquivos(caminho, extensoes))
    } else if (extensoes.some((ext) => nome.endsWith(ext))) {
      saida.push(caminho)
    }
  }
  return saida
}

// Ler o arquivo de i18n
const caminhoI18n = join(raiz, 'nucleo/i18n.ts')
if (!existsSync(caminhoI18n)) {
  console.error('Erro: Arquivo nucleo/i18n.ts não encontrado!')
  process.exit(1)
}

const conteudoI18n = readFileSync(caminhoI18n, 'utf8')
const indicePt = conteudoI18n.indexOf('  pt: {')
const indiceEn = conteudoI18n.indexOf('  en: {')

if (indicePt === -1 || indiceEn === -1) {
  console.error('Erro: Não foram encontrados os blocos pt/en em nucleo/i18n.ts')
  process.exit(1)
}

// Função para extrair chaves de uma seção de tradução
const extrairChaves = (trecho) => {
  const correspondencias = trecho.matchAll(/^\s{4}'([^']+)':/gm)
  return new Set([...correspondencias].map((m) => m[1]))
}

const chavesPt = extrairChaves(conteudoI18n.slice(indicePt, indiceEn))
const chavesEn = extrairChaves(conteudoI18n.slice(indiceEn))

// Buscar por chaves usadas no código
const chavesUsadas = new Map()
const diretoriosParaVarer = [
  join(raiz, 'nucleo'),
  join(raiz, 'mobile/src'),
]

const arquivosDoProjeto = []
for (const dir of diretoriosParaVarer) {
  if (existsSync(dir)) {
    arquivosDoProjeto.push(...obterArquivos(dir))
  }
}

for (const caminho of arquivosDoProjeto) {
  // Pula o próprio arquivo de tradução para evitar falsos positivos
  if (caminho === caminhoI18n) continue

  const texto = readFileSync(caminho, 'utf8')
  // Regex para t('chave') ou t("chave")
  const correspondencias = texto.matchAll(/\bt\(\s*(['"])([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)\1/g)
  for (const m of correspondencias) {
    const chave = m[2]
    if (chave && !chavesUsadas.has(chave)) {
      chavesUsadas.set(chave, caminho.slice(raiz.length + 1))
    }
  }
}

const semPt = [...chavesUsadas].filter(([k]) => !chavesPt.has(k))
const semEn = [...chavesUsadas].filter(([k]) => chavesPt.has(k) && !chavesEn.has(k))

console.log(`${chavesPt.size} chaves em pt, ${chavesEn.size} em en; ${chavesUsadas.size} usadas no código\n`)

let falhou = false

if (semPt.length > 0) {
  console.log(`  FALHA ${semPt.length} chave(s) usada(s) que NÃO existe(m) em pt (viram texto cru na tela):`)
  for (const [k, onde] of semPt) {
    console.log(`         ${k}   (${onde})`)
  }
  falhou = true
}

if (semEn.length > 0) {
  console.log(`  FALHA ${semEn.length} chave(s) sem tradução em inglês (o app cai para o português calado):`)
  for (const [k, onde] of semEn) {
    console.log(`         ${k}   (${onde})`)
  }
  falhou = true
}

// Além das regras do LootFlow, vamos verificar se há chaves declaradas em PT que faltam no EN bloco de declaração em geral
const faltantesNoEnDeclaradas = [...chavesPt].filter((k) => !chavesEn.has(k))
if (faltantesNoEnDeclaradas.length > 0) {
  console.log(`  FALHA ${faltantesNoEnDeclaradas.length} chave(s) declarada(s) em pt que falta(m) no bloco en:`)
  for (const k of faltantesNoEnDeclaradas) {
    console.log(`         ${k}`)
  }
  falhou = true
}

if (!falhou) {
  console.log('  ok   toda chave usada existe em pt e en')
}

process.exit(falhou ? 1 : 0)
