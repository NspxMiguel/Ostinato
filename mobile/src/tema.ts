// A paleta. Uma só, e todas as telas bebem daqui.
//
// Ostinato é lousa: o fundo escuro é o padrão da marca, e o claro é a variante. As
// cores das matérias são escolhidas pelo usuário e não saem desta lista.

export const cores = {
  fundo: '#14110F',
  cartao: '#1E1A17',
  cartaoAlto: '#2A2521',
  borda: '#3A332D',
  texto: '#F4EFE9',
  textoFraco: '#A79C90',
  marfim: '#F4EFE9',
  aviso: '#E8A33D',
  atrasado: '#D9534F',
  ok: '#5FB37A',
  destaque: '#7FB2E5',
} as const

export const espaco = { xs: 4, s: 8, m: 12, g: 16, gg: 24, ggg: 32 } as const

export const raio = { s: 8, m: 12, g: 16, pilula: 999 } as const

export const fonte = {
  titulo: { fontSize: 28, fontWeight: '700' as const, color: cores.texto },
  secao: { fontSize: 13, fontWeight: '600' as const, color: cores.textoFraco, letterSpacing: 0.6 },
  corpo: { fontSize: 16, color: cores.texto },
  apoio: { fontSize: 13, color: cores.textoFraco },
} as const

/** Cores sugeridas ao criar uma matéria. Distinguíveis também em preto e branco. */
export const CORES_DE_MATERIA = [
  '#E4572E',
  '#F4A259',
  '#8AC926',
  '#4FB477',
  '#4CC9F0',
  '#7B8CDE',
  '#C77DFF',
  '#F26CA7',
] as const
