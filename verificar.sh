#!/usr/bin/env bash
# Tudo o que tem que passar antes de eu dizer que está pronto.
#
# Existe por um defeito de processo, não de código. Eu vinha rodando
# `npx tsc --noEmit -p .` e lendo "limpo" — mas o `tsconfig.json` da raiz só
# inclui `nucleo/**/*.ts`. As TELAS nunca foram conferidas, e foi assim que um
# `import` faltando chegou ao iPhone dele e derrubou o app ao abrir Ajustes.
#
# Um comando só, e ele confere os dois projetos. Verificação parcial que se
# anuncia como completa é pior que não verificar: ela produz confiança falsa.
set -euo pipefail
cd "$(dirname "$0")"

echo "→ tipos do núcleo"
npx tsc --noEmit -p .

echo "→ tipos do app (telas, componentes, módulos nativos)"
npx tsc --noEmit -p mobile

echo "→ testes"
node --test "nucleo/testes/*.test.ts"

echo "→ chaves de tradução"
node scripts/teste-chaves-i18n.mjs

echo "tudo certo"
