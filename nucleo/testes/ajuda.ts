// Montagem de bases de teste. Sem isto, cada teste vira 40 linhas de objeto literal.

import type {
  Aula,
  Base,
  Compromisso,
  DataISO,
  DiaSemana,
  Falta,
  Hora,
  Materia,
  Nota,
  Periodo,
  RegraAviso,
  TipoCompromisso,
  Vencimento,
} from '../modelo.ts'
import { ajustesPadrao, baseVazia } from '../modelo.ts'
import { instante } from '../tempo.ts'

export const APARELHO = 'teste'

let contador = 0
function proximoId(prefixo: string): string {
  contador++
  return `${prefixo}-${contador}`
}

export function reiniciarIds(): void {
  contador = 0
}

function envelope(id: string, quando = 1_000) {
  return { id, atualizadoEm: quando, removido: false, origem: APARELHO }
}

export function periodo(p: Partial<Periodo> = {}): Periodo {
  return {
    ...envelope(p.id ?? 'periodo-1'),
    nome: '2º semestre',
    inicio: '2026-08-03',
    fim: '2026-12-18',
    feriados: [],
    ativo: true,
    ...p,
  }
}

export function materia(nome: string, p: Partial<Materia> = {}): Materia {
  return {
    ...envelope(p.id ?? proximoId('materia')),
    periodoId: 'periodo-1',
    nome,
    apelidos: [],
    cor: '#333333',
    limiteFaltasPct: 25,
    ...p,
  }
}

export function aula(
  materiaId: string,
  diaSemana: DiaSemana,
  inicio: Hora,
  fim: Hora,
  p: Partial<Aula> = {},
): Aula {
  return {
    ...envelope(p.id ?? proximoId('aula')),
    materiaId,
    diaSemana,
    inicio,
    fim,
    semana: 'toda',
    ...p,
  }
}

export function compromisso(
  titulo: string,
  vencimento: Vencimento,
  p: Partial<Compromisso> = {},
): Compromisso {
  return {
    ...envelope(p.id ?? proximoId('comp')),
    criadoEm: p.criadoEm ?? instante('2026-08-24', '18:00').getTime(),
    tipo: (p.tipo ?? 'tarefa') as TipoCompromisso,
    titulo,
    vencimento,
    avisos: p.avisos ?? null,
    concluido: false,
    ...p,
  }
}

export function nota(materiaId: string, valor: number, p: Partial<Nota> = {}): Nota {
  return {
    ...envelope(p.id ?? proximoId('nota')),
    materiaId,
    titulo: 'prova',
    valor,
    maximo: 10,
    peso: 1,
    ...p,
  }
}

export function falta(materiaId: string, data: DataISO, p: Partial<Falta> = {}): Falta {
  return {
    ...envelope(p.id ?? proximoId('falta')),
    materiaId,
    data,
    aulas: 1,
    justificada: false,
    ...p,
  }
}

export function base(partes: {
  periodos?: Periodo[]
  materias?: Materia[]
  aulas?: Aula[]
  compromissos?: Compromisso[]
  notas?: Nota[]
  faltas?: Falta[]
}): Base {
  const b = baseVazia()
  for (const p of partes.periodos ?? []) b.periodos[p.id] = p
  for (const m of partes.materias ?? []) b.materias[m.id] = m
  for (const a of partes.aulas ?? []) b.aulas[a.id] = a
  for (const c of partes.compromissos ?? []) b.compromissos[c.id] = c
  for (const n of partes.notas ?? []) b.notas[n.id] = n
  for (const f of partes.faltas ?? []) b.faltas[f.id] = f
  return b
}

/** Ajustes sem repetição nenhuma, para o teste contar só o que ele pediu. */
/** Sem lista, devolve os padrões de fábrica — que é o que alguns testes querem. */
export function ajustesSimples(regras?: RegraAviso[]): ReturnType<typeof ajustesPadrao> {
  const a = ajustesPadrao()
  if (!regras) return a
  const padroes = { ...a.padroesAviso }
  for (const t of Object.keys(padroes) as TipoCompromisso[]) padroes[t] = regras
  return { ...a, padroesAviso: padroes }
}

export function regraDias(id: string, dias: number, aHora: Hora = '20:00'): RegraAviso {
  return { id, quando: { tipo: 'diasAntes', dias, aHora }, modo: 'normal' }
}
