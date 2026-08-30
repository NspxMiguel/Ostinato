// A bateria que prova a semântica do sync SEM CloudKit, sem conta paga e sem
// simulador. Se ela passa, o CloudKit é só transporte — e é essa a aposta de
// escrever o sync desde o começo em vez de reescrever depois.

import test from 'node:test'
import assert from 'node:assert/strict'
import type { Base, Materia } from '../modelo.ts'
import { baseVazia } from '../modelo.ts'
import { FilaDeSaida } from '../sync/fila.ts'
import { mesclarRegistro } from '../sync/mesclar.ts'
import { PortaNula, type PortaDeNuvem } from '../sync/porta.ts'
import { NuvemFalsa, PortaMemoria } from '../sync/portaMemoria.ts'
import { sincronizar, type EstadoSync } from '../sync/sincronizar.ts'

type Aparelho = { nome: string; estado: EstadoSync; porta: PortaMemoria }

function aparelho(nome: string, nuvem: NuvemFalsa, opcoes: { tamanhoDoLote?: number } = {}): Aparelho {
  return {
    nome,
    estado: { base: baseVazia(), fila: new FilaDeSaida(), marca: null },
    porta: new PortaMemoria(nuvem, { nome, ...opcoes }),
  }
}

function escrever(ap: Aparelho, m: Materia, quando: number): void {
  const registro: Materia = { ...m, atualizadoEm: quando, origem: ap.nome }
  ap.estado.base.materias[m.id] = registro
  ap.estado.fila.enfileirar('materias', m.id, quando)
}

function apagar(ap: Aparelho, id: string, quando: number): void {
  const atual = ap.estado.base.materias[id]
  if (!atual) throw new Error('não existe')
  ap.estado.base.materias[id] = { ...atual, removido: true, atualizadoEm: quando, origem: ap.nome }
  ap.estado.fila.enfileirar('materias', id, quando)
}

async function sincronizarAparelho(ap: Aparelho): Promise<void> {
  const r = await sincronizar(ap.estado, ap.porta)
  ap.estado = r.estado
}

function materia(id: string, nome: string): Materia {
  return {
    id,
    atualizadoEm: 0,
    removido: false,
    origem: 'x',
    periodoId: 'p',
    nome,
    apelidos: [],
    cor: '#000',
    limiteFaltasPct: 25,
  }
}

function retrato(b: Base): string {
  return JSON.stringify(
    Object.values(b.materias)
      .sort((x, y) => x.id.localeCompare(y.id))
      .map((m) => [m.id, m.nome, m.removido, m.atualizadoEm]),
  )
}

test('dois aparelhos escrevendo coisas diferentes convergem', async () => {
  const nuvem = new NuvemFalsa()
  const a = aparelho('a', nuvem)
  const b = aparelho('b', nuvem)

  escrever(a, materia('m1', 'Matemática'), 100)
  escrever(b, materia('m2', 'Português'), 110)

  await sincronizarAparelho(a)
  await sincronizarAparelho(b)
  await sincronizarAparelho(a)

  assert.equal(retrato(a.estado.base), retrato(b.estado.base))
  assert.equal(Object.keys(a.estado.base.materias).length, 2)
  assert.equal(a.estado.fila.tamanho, 0, 'a fila esvazia quando o servidor confirma')
})

test('edição concorrente no mesmo registro: o mais novo vence nos dois lados', async () => {
  const nuvem = new NuvemFalsa()
  const a = aparelho('a', nuvem)
  const b = aparelho('b', nuvem)

  escrever(a, materia('m1', 'Mat'), 100)
  await sincronizarAparelho(a)
  await sincronizarAparelho(b)

  escrever(a, { ...materia('m1', 'Matemática'), atualizadoEm: 200 }, 200)
  escrever(b, { ...materia('m1', 'MATEMATICA'), atualizadoEm: 300 }, 300)

  await sincronizarAparelho(a)
  await sincronizarAparelho(b)
  await sincronizarAparelho(a)

  assert.equal(a.estado.base.materias.m1?.nome, 'MATEMATICA')
  assert.equal(retrato(a.estado.base), retrato(b.estado.base))
})

test('apagar num aparelho enquanto o outro edita antes: a remoção vence', async () => {
  const nuvem = new NuvemFalsa()
  const a = aparelho('a', nuvem)
  const b = aparelho('b', nuvem)

  escrever(a, materia('m1', 'Física'), 100)
  await sincronizarAparelho(a)
  await sincronizarAparelho(b)

  escrever(b, { ...materia('m1', 'Física II'), atualizadoEm: 150 }, 150)
  apagar(a, 'm1', 200)

  await sincronizarAparelho(b)
  await sincronizarAparelho(a)
  await sincronizarAparelho(b)

  assert.equal(a.estado.base.materias.m1?.removido, true)
  assert.equal(retrato(a.estado.base), retrato(b.estado.base))
})

test('edição depois da remoção ressuscita — é o que o relógio manda', async () => {
  const nuvem = new NuvemFalsa()
  const a = aparelho('a', nuvem)
  const b = aparelho('b', nuvem)

  escrever(a, materia('m1', 'Química'), 100)
  await sincronizarAparelho(a)
  await sincronizarAparelho(b)

  apagar(a, 'm1', 150)
  escrever(b, { ...materia('m1', 'Química Orgânica'), atualizadoEm: 200 }, 200)

  await sincronizarAparelho(a)
  await sincronizarAparelho(b)
  await sincronizarAparelho(a)

  assert.equal(a.estado.base.materias.m1?.removido, false)
  assert.equal(a.estado.base.materias.m1?.nome, 'Química Orgânica')
  assert.equal(retrato(a.estado.base), retrato(b.estado.base))
})

test('empate no relógio: apagar ganha de editar', () => {
  const editado: Materia = { ...materia('m1', 'A'), atualizadoEm: 500, origem: 'zz' }
  const apagado: Materia = { ...materia('m1', 'B'), atualizadoEm: 500, origem: 'aa', removido: true }
  assert.equal(mesclarRegistro(editado, apagado).valor.removido, true)
  assert.equal(mesclarRegistro(apagado, editado).valor.removido, true)
})

test('empate total: os dois lados chegam à MESMA conclusão sem conversar', () => {
  const x: Materia = { ...materia('m1', 'X'), atualizadoEm: 500, origem: 'aparelho-a' }
  const y: Materia = { ...materia('m1', 'Y'), atualizadoEm: 500, origem: 'aparelho-b' }
  assert.equal(mesclarRegistro(x, y).valor.nome, mesclarRegistro(y, x).valor.nome)
  assert.equal(mesclarRegistro(x, y).valor.nome, 'X', 'origem menor vence, e isso é estável')
})

test('aparelho offline por 10 mudanças: nada se perde ao voltar', async () => {
  const nuvem = new NuvemFalsa()
  const a = aparelho('a', nuvem)
  const b = aparelho('b', nuvem)

  b.porta.offline = true
  for (let i = 0; i < 10; i++) {
    escrever(b, materia(`b${i}`, `Matéria B${i}`), 100 + i)
    await sincronizarAparelho(b)
  }
  assert.equal(b.estado.fila.tamanho, 10, 'tudo continua pendente enquanto está offline')

  escrever(a, materia('a1', 'Do outro lado'), 300)
  await sincronizarAparelho(a)

  b.porta.offline = false
  await sincronizarAparelho(b)
  await sincronizarAparelho(a)

  assert.equal(b.estado.fila.tamanho, 0)
  assert.equal(Object.keys(a.estado.base.materias).length, 11)
  assert.equal(retrato(a.estado.base), retrato(b.estado.base))
})

test('erro no meio do envio não esvazia a fila', async () => {
  const nuvem = new NuvemFalsa()
  const a = aparelho('a', nuvem)
  escrever(a, materia('m1', 'Arte'), 100)

  const quebrada: PortaDeNuvem = {
    nome: 'quebrada',
    disponivel: async () => true,
    puxar: async () => ({ mudancas: [], marca: '', temMais: false }),
    empurrar: async () => {
      throw new Error('rede caiu')
    },
  }
  const r = await sincronizar(a.estado, quebrada)
  assert.equal(r.relatorio.erro, 'rede caiu')
  assert.equal(r.estado.fila.tamanho, 1, 'a mudança continua pendente')
})

test('a porta nula deixa o app inteiro e guarda a fila para o dia da conta paga', async () => {
  const a = { estado: { base: baseVazia(), fila: new FilaDeSaida(), marca: null } as EstadoSync }
  a.estado.base.materias.m1 = { ...materia('m1', 'Latim'), atualizadoEm: 100 }
  a.estado.fila.enfileirar('materias', 'm1', 100)

  const r = await sincronizar(a.estado, new PortaNula())
  assert.equal(r.relatorio.disponivel, false)
  assert.equal(r.estado.fila.tamanho, 1)
  assert.equal(Object.keys(r.estado.base.materias).length, 1, 'o dado local continua lá')
})

test('lote pequeno força paginação e ainda converge', async () => {
  const nuvem = new NuvemFalsa()
  const a = aparelho('a', nuvem)
  const b = aparelho('b', nuvem, { tamanhoDoLote: 3 })

  for (let i = 0; i < 25; i++) escrever(a, materia(`m${i}`, `M${i}`), 100 + i)
  await sincronizarAparelho(a)
  await sincronizarAparelho(b)

  assert.equal(Object.keys(b.estado.base.materias).length, 25)
  assert.equal(retrato(a.estado.base), retrato(b.estado.base))
})

test('cem rodadas aleatórias: as duas bases terminam idênticas', async () => {
  const nuvem = new NuvemFalsa()
  const a = aparelho('a', nuvem)
  const b = aparelho('b', nuvem)
  const aparelhos = [a, b]

  // Gerador determinístico: teste que falha uma vez em cada dez execuções não
  // serve para provar nada.
  let semente = 42
  const sorte = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648
    return semente / 2147483648
  }

  let relogio = 1000
  for (let volta = 0; volta < 100; volta++) {
    const ap = aparelhos[sorte() < 0.5 ? 0 : 1]!
    const id = `m${Math.floor(sorte() * 8)}`
    relogio += Math.floor(sorte() * 3)

    const acao = sorte()
    if (acao < 0.6 || !ap.estado.base.materias[id]) {
      escrever(ap, materia(id, `nome-${volta}`), relogio)
    } else if (acao < 0.8) {
      apagar(ap, id, relogio)
    }

    ap.porta.offline = sorte() < 0.25
    await sincronizarAparelho(ap)
    ap.porta.offline = false
  }

  // Todo mundo volta para a rede e sincroniza até parar de mudar.
  for (let i = 0; i < 4; i++) {
    await sincronizarAparelho(a)
    await sincronizarAparelho(b)
  }

  assert.equal(retrato(a.estado.base), retrato(b.estado.base))
  assert.equal(a.estado.fila.tamanho, 0)
  assert.equal(b.estado.fila.tamanho, 0)
})

test('a fila não perde uma edição feita durante o envio', () => {
  const fila = new FilaDeSaida()
  fila.enfileirar('materias', 'm1', 100)
  const emVoo = fila.pendentes()

  // O usuário edita de novo enquanto o envio está no ar.
  fila.enfileirar('materias', 'm1', 150)

  fila.confirmar(emVoo)
  assert.equal(fila.tamanho, 1, 'a edição nova continua pendente')
  assert.equal(fila.pendentes()[0]?.enfileiradoEm, 150)
})
