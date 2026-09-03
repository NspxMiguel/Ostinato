// A paleta. Uma só, e todas as telas bebem daqui.
//
// Vem do redesenho de 30/08/2026. O que ela substitui, e por quê:
//
//   - o fundo marrom `#14110F` virou PRETO PURO. Em OLED o pixel preto não
//     acende: o fundo some de verdade e gasta menos bateria. Cinza-azulado
//     (`#0d1117`, `#111827`) é o que todo gerador devolve;
//   - as superfícies deixaram de ser cores opacas e viraram BRANCO COM ALFA. É o
//     que faz cartão sobre preto parecer luz em vez de tinta, e é o que o iOS faz;
//   - saíram `lucro`, `perda` e `ouro`, que eram vocabulário de um app de CS2 e
//     não significavam nada num app de escola;
//   - sobrou UMA cor de destaque, `#FFD60A`, e ela é reservada para AÇÃO —
//     botão de criar, contagem regressiva. Nunca decoração, e nunca navegação:
//     aba ativa é branco pleno, não amarelo.
//
// Vermelho e laranja ficam livres para ESTADO justamente porque o destaque é
// amarelo — se o destaque fosse vermelho, "atrasado" perderia a força.

/** Escuro: o padrão da marca. */
export const paletaEscura = {
  fundo: '#000000',
  /** Pílula não selecionada, campo, trilho de switch. */
  cartao: 'rgba(255,255,255,0.07)',
  /** Pílula selecionada, opção ativa de segmentado. */
  cartaoAlto: 'rgba(255,255,255,0.11)',
  /**
   * Fundo OPACO para folha e menu que flutuam sobre a tela.
   *
   * As cores de cartão são translúcidas de propósito — elas se apoiam no preto
   * da tela atrás. Num `Modal` transparente não há esse preto, e o conteúdo da
   * tela vaza através da folha.
   */
  fundoElevado: '#1C1C1E',
  /**
   * Fundo da linha em alerta, OPACO.
   *
   * É o vermelho de atraso a 8% sobre preto, já resolvido em um valor único —
   * e não uma camada translúcida. Dentro do arrastar a linha precisa ser opaca
   * para não deixar o painel da ação atravessar, e duas superfícies diferentes
   * ali (preto no círculo, vermelho no cartão) desenham uma faixa preta dentro
   * da moldura vermelha, que foi o que ele viu.
   */
  fundoAlerta: '#1A0908',
  borda: 'rgba(255,255,255,0.09)',
  texto: '#FFFFFF',
  textoFraco: 'rgba(255,255,255,0.62)',
  /** Rótulo de seção, ícone e rótulo inativos. */
  texto3: 'rgba(255,255,255,0.40)',
  /** Placeholder, desabilitado. */
  texto4: 'rgba(255,255,255,0.22)',
  destaque: '#FFD60A',
  /** Texto que fica POR CIMA do destaque. Preto nos dois temas. */
  sobreDestaque: '#000000',
  aviso: '#FF9F0A',
  atrasado: '#FF453A',
  ok: '#32D74B',
  vidro: 'rgba(30,30,30,0.6)',
  /** As duas pontas do degradê do cartão. Copiado do LootFlow, que é o app dele
      que ficou bonito: cartão chapado sobre preto vira mancha; o degradê de
      branco quase invisível dá volume sem virar cinza. */
  cartaoDe: 'rgba(255,255,255,0.055)',
  cartaoAte: 'rgba(255,255,255,0.012)',
  /** Alias antigo: era um marfim quebrado, hoje é o branco do tema. */
  marfim: '#FFFFFF',
} as const

/**
 * Claro: a variante.
 *
 * ESCRITA E AINDA NÃO LIGADA, de propósito e com motivo declarado: as telas
 * montam estilo com `StyleSheet.create` no topo do módulo, que lê a cor UMA vez
 * quando o arquivo carrega. Trocar de tema em tempo de execução exige mover
 * essas folhas para dentro dos componentes — refatoração das sete telas, não uma
 * troca de constante. Deixar a paleta pronta aqui é o que torna esse dia barato.
 */
export const paletaClara = {
  fundo: '#FFFFFF',
  cartao: 'rgba(0,0,0,0.045)',
  cartaoAlto: 'rgba(0,0,0,0.07)',
  fundoElevado: '#F2F2F7',
  fundoAlerta: '#FFF1F0',
  borda: 'rgba(0,0,0,0.09)',
  texto: '#000000',
  textoFraco: 'rgba(0,0,0,0.62)',
  texto3: 'rgba(0,0,0,0.40)',
  texto4: 'rgba(0,0,0,0.22)',
  destaque: '#FFD60A',
  sobreDestaque: '#000000',
  /** Só para TEXTO e link: o amarelo puro não tem contraste sobre branco. */
  destaqueEmTexto: '#8A6D00',
  aviso: '#FF9500',
  atrasado: '#FF3B30',
  ok: '#248A3D',
  vidro: 'rgba(255,255,255,0.6)',
  cartaoDe: 'rgba(0,0,0,0.03)',
  cartaoAte: 'rgba(0,0,0,0.008)',
  marfim: '#000000',
} as const

export const cores = paletaEscura

export const espaco = { xs: 4, s: 8, m: 12, g: 16, gg: 24, ggg: 32 } as const

export const raio = { s: 8, m: 12, g: 16, gg: 22, cartao: 26, pilula: 999 } as const

/**
 * A escala de tipo. Sem fonte customizada: o app usa a do sistema (SF Pro).
 *
 * Fonte customizada em app de iPhone custa três coisas — peso no binário, um
 * quadro em branco no primeiro desenho enquanto ela carrega, e a perda do
 * Dynamic Type. Geist e JetBrains Mono eram herança de web.
 *
 * Nenhum destes estilos fixa largura: português e francês correm ~30% mais
 * longos que inglês, e rótulo com largura fixa corta a palavra no meio.
 */
export const fonte = {
  /** "Hoje", "Agenda" — o título da tela. */
  titulo: { fontSize: 32, fontWeight: '700' as const, color: cores.texto, letterSpacing: -0.5 },
  /** Nome de compromisso, de matéria. */
  tituloItem: { fontSize: 18, fontWeight: '600' as const, color: cores.texto },
  corpo: { fontSize: 16, color: cores.texto },
  /** Metadado, data, o texto de apoio de uma linha. */
  apoio: { fontSize: 14, color: cores.textoFraco },
  /**
   * "Chegando", "Notas". Sentence case, NÃO caixa alta: caixa alta em rótulo de
   * seção é maneirismo de painel administrativo, e o iOS parou de fazer isso.
   */
  secao: { fontSize: 13, fontWeight: '600' as const, color: cores.texto3, letterSpacing: 0.2 },
  /** Legenda de widget, contador. */
  micro: { fontSize: 11, fontWeight: '500' as const, color: cores.textoFraco },
} as const

/**
 * As cores que o usuário escolhe para cada matéria.
 *
 * Aqui a cor É a informação — é o que distingue biologia de história numa lista
 * de doze linhas — e por isso esta lista não briga com a regra de "uma cor de
 * destaque": ela não é decoração nem ação, é identidade de item.
 *
 * Todas escolhidas para funcionar como bolinha de 8px sobre preto puro: nada
 * abaixo de ~55% de luminância, senão some.
 */
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
