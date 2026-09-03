// The corpus runs against the deterministic reader and measures three
// numbers, not one:
//
//   how many tables were read correctly,
//   how many were read wrong,
//   and — the number that matters just as much as the first — how many of
//   the wrong ones came back with the quality score warning that something
//   didn't add up.
//
// Getting it wrong and warning is acceptable: that's the app calling the
// model. Getting it wrong silently is not — that's a broken grid showing up
// looking certain. This test fails if that second number grows without
// someone deciding, on purpose, that a given case is a known blind spot
// (`shouldBeFlagged: false` in the corpus).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aulasDaTabela } from '../gradeDaTabela.ts'
import { qualidadeDaGrade, NOTA_MINIMA } from '../qualidadeDaGrade.ts'
import { CORPUS, type CorpusCase } from './corpus/cases.ts'
import type { AulaCrua } from '../importarGrade.ts'

type ComparableLesson = { diaSemana: number; inicio: string; fim: string; materia: string }

function keyOf(a: ComparableLesson): string {
  return `${a.diaSemana}|${a.inicio}|${a.fim}|${a.materia}`
}

function asSet(list: readonly ComparableLesson[]): string[] {
  return list.map(keyOf).sort()
}

function matches(atual: readonly AulaCrua[], expected: readonly ComparableLesson[]): boolean {
  const a = asSet(atual)
  const e = asSet(expected)
  return a.length === e.length && a.every((v, i) => v === e[i])
}

type Outcome = {
  caso: CorpusCase
  correct: boolean
  qualityScore: number
}

function evaluate(caso: CorpusCase): Outcome {
  const atual = aulasDaTabela(caso.table)
  const correct = matches(atual, caso.expected)
  const { nota } = qualidadeDaGrade(atual)
  return { caso, correct, qualityScore: nota }
}

test('the corpus has at least 100 tables', () => {
  assert.ok(CORPUS.length >= 100, `corpus has ${CORPUS.length}, needs >= 100`)
})

test('no case name repeats (otherwise the corpus inflates without covering anything new)', () => {
  const names = CORPUS.map((c) => c.name)
  const unique = new Set(names)
  assert.equal(unique.size, names.length, 'there are duplicate names in the corpus')
})

test('whole-corpus summary', () => {
  const outcomes = CORPUS.map(evaluate)

  const correct = outcomes.filter((r) => r.correct)
  const wrong = outcomes.filter((r) => !r.correct)
  const wrongAndFlagged = wrong.filter((r) => r.qualityScore < NOTA_MINIMA)
  const wrongAndSilent = wrong.filter((r) => r.qualityScore >= NOTA_MINIMA)

  // Known blind spots: cases marked on purpose as "this wrong read has no
  // way of being flagged". A silent read here is expected and documented in
  // the case name — not a regression.
  const knownSilent = wrongAndSilent.filter((r) => !r.caso.shouldBeFlagged)
  const newSilent = wrongAndSilent.filter((r) => r.caso.shouldBeFlagged)

  console.log('')
  console.log('═══ schedule-table corpus — summary ═══')
  console.log(`tables in the corpus:          ${CORPUS.length}`)
  console.log(`read correctly:                ${correct.length}/${CORPUS.length}`)
  console.log(`read wrong:                    ${wrong.length}/${CORPUS.length}`)
  console.log(`  wrong AND flagged:           ${wrongAndFlagged.length} (score < ${NOTA_MINIMA} — app calls the model)`)
  console.log(`  wrong AND silent:            ${wrongAndSilent.length} (score >= ${NOTA_MINIMA} — no warning at all)`)
  console.log(`    known, documented blind spot: ${knownSilent.length}`)
  console.log(`    NOT documented:               ${newSilent.length}`)
  console.log('═════════════════════════════════════')
  if (newSilent.length > 0) {
    console.log('wrong-and-silent cases that were NOT expected:')
    for (const r of newSilent) console.log(`  - ${r.caso.name} (score ${r.qualityScore.toFixed(2)})`)
  }
  console.log('')

  // What can't happen: a wrong, silent read that nobody decided on purpose
  // was a blind spot. That's a real regression.
  assert.equal(
    newSilent.length,
    0,
    `${newSilent.length} table(s) read wrong SILENTLY without being marked as a known blind spot`,
  )
})

test('every case marked as readable by the algorithm reads correctly', () => {
  const shouldRead = CORPUS.filter((c) => c.readableByAlgorithm)
  const failures = shouldRead.map(evaluate).filter((r) => !r.correct)
  if (failures.length > 0) {
    const detail = failures.map((f) => `  - ${f.caso.name}`).join('\n')
    assert.fail(`${failures.length} case(s) marked as readable, but the algorithm got them wrong:\n${detail}`)
  }
})

test('every case marked "needs the model and should be flagged" really does fall below the minimum score', () => {
  const needsModel = CORPUS.filter((c) => !c.readableByAlgorithm && c.shouldBeFlagged)
  assert.ok(needsModel.length > 0, 'the corpus needs at least one case that requires the model')
  const unflagged = needsModel.map(evaluate).filter((r) => r.qualityScore >= NOTA_MINIMA)
  if (unflagged.length > 0) {
    const detail = unflagged.map((f) => `  - ${f.caso.name} (score ${f.qualityScore.toFixed(2)})`).join('\n')
    assert.fail(`${unflagged.length} case(s) marked "needs the model" didn't lower the score:\n${detail}`)
  }
})

test('the known blind spot still exists and is still unflagged (otherwise the "silent" label is stale)', () => {
  const blindSpots = CORPUS.filter((c) => !c.readableByAlgorithm && !c.shouldBeFlagged)
  for (const c of blindSpots) {
    const r = evaluate(c)
    assert.equal(r.correct, false, `"${c.name}" is marked as a blind spot, but now reads correctly — update the corpus`)
  }
})
