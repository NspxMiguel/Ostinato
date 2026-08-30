/**
 * Cobra a tradução completa, e falha o build quando falta.
 *
 * Chave sem tradução não quebra o app — ele cai para o português em silêncio, o
 * que é o comportamento certo para o usuário. Justamente por isso o defeito
 * passaria despercebido para sempre se ninguém cobrasse aqui.
 *
 * A checagem é por bloco de idioma PRESENTE no arquivo: um idioma que ainda não
 * existe não é cobrado, e um que existe é cobrado inteiro. Assim dá para abrir
 * um idioma novo sem travar o build, e não dá para deixá-lo pela metade.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

function obterArquivos(diretorio, extensoes = ['.ts', '.tsx']) {
  if (!existsSync(diretorio)) return []
  const saida = []
  for (const nome of readdirSync(diretorio)) {
    if (nome === 'node_modules' || nome.startsWith('.') || nome === 'ios' || nome === 'android') continue
    const caminho = join(diretorio, nome)
    if (statSync(caminho).isDirectory()) saida.push(...obterArquivos(caminho, extensoes))
    else if (extensoes.some((ext) => nome.endsWith(ext))) saida.push(caminho)
  }
  return saida
}

const caminhoI18n = join(raiz, 'nucleo/i18n.ts')
if (!existsSync(caminhoI18n)) {
  console.error('nucleo/i18n.ts não encontrado')
  process.exit(1)
}
const conteudo = readFileSync(caminhoI18n, 'utf8')

/** Onde cada bloco de idioma começa, na ordem em que aparecem. */
function blocos() {
  const marcas = [...conteudo.matchAll(/^ {2}([a-z]{2}): \{$/gm)]
  return marcas.map((m, i) => ({
    idioma: m[1],
    de: m.index,
    ate: i + 1 < marcas.length ? marcas[i + 1].index : conteudo.length,
  }))
}

function chavesDe(trecho) {
  return new Set([...trecho.matchAll(/^\s{4}'([^']+)':/gm)].map((m) => m[1]))
}

const idiomas = blocos()
if (idiomas.length === 0) {
  console.error('nenhum bloco de idioma encontrado em nucleo/i18n.ts')
  process.exit(1)
}

const porIdioma = new Map()
for (const b of idiomas) porIdioma.set(b.idioma, chavesDe(conteudo.slice(b.de, b.ate)))

const pt = porIdioma.get('pt')
if (!pt) {
  console.error('o bloco `pt` é a referência e não foi encontrado')
  process.exit(1)
}

// As chaves realmente usadas nas telas e no núcleo.
const usadas = new Set()
for (const arquivo of [...obterArquivos(join(raiz, 'mobile/src')), ...obterArquivos(join(raiz, 'nucleo'))]) {
  if (arquivo.endsWith('i18n.ts')) continue
  const texto = readFileSync(arquivo, 'utf8')
  for (const m of texto.matchAll(/\bt\(\s*'([a-z0-9_.]+)'/gi)) usadas.add(m[1])
}

const resumo = [...porIdioma]
  .map(([idioma, chaves]) => `${chaves.size} em ${idioma}`)
  .join(', ')
console.log(`${resumo}; ${usadas.size} usadas no código\n`)

const falhas = []

for (const chave of usadas) {
  if (!pt.has(chave)) falhas.push(`usada no código e ausente em pt: ${chave}`)
}

for (const [idioma, chaves] of porIdioma) {
  if (idioma === 'pt') continue
  for (const chave of pt) {
    if (!chaves.has(chave)) falhas.push(`falta em ${idioma}: ${chave}`)
  }
}

if (falhas.length > 0) {
  console.error(`  FALHA ${falhas.length} problema(s):`)
  for (const f of falhas.slice(0, 40)) console.error(`         ${f}`)
  if (falhas.length > 40) console.error(`         … e mais ${falhas.length - 40}`)
  process.exit(1)
}

console.log('  ok   toda chave usada existe, e todo idioma presente está completo')
