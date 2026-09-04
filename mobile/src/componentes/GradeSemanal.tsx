// A grade em forma de planilha: colunas são os dias, linhas são os horários.
//
// Pedido dele em 03/09/2026: *"melhorar opção tbm de colocar tabelas, mt
// confuso, poderia ter algo tipo meio q um excell tlg? melhor pra faze e
// entener a planilha"*. Antes, montar a grade era um campo de texto (colar
// linhas com `|`) mais um formulário de uma aula por vez — ninguém enxergava a
// semana inteira de uma vez, que é exatamente como toda escola entrega o
// horário.
//
// Este componente é só a APRESENTAÇÃO da planilha e o sanduíche de folhas que
// edita uma célula ou uma linha. Quem manda os dados — se eles vêm da grade
// salva ou de uma prévia de importação ainda não confirmada — é de quem chama:
// os dois usos moram em `Grade.tsx`, um lendo/escrevendo na loja, o outro
// lendo/escrevendo um estado local que só vira grade de verdade ao confirmar.
//
// A célula É tocável e abre uma ESCOLHA de matéria, nunca um campo de texto
// livre: matéria digitada duas vezes com grafia diferente virava duas matérias
// (ver `apelidos` em `nucleo/modelo.ts`), e aqui o risco é maior — doze células
// por semana, doze chances de digitar "Historia" e "História".
//
// Grade de linhas finas AQUI é intencional, ao contrário do resto do app: a
// regra de `ui.tsx` é "lista não tem cartão nem borda, separação é espaço" —
// mas isto não é uma lista, é uma tabela, e é o "Excel" que ele pediu. Sem
// linha entre as células, dia e horário se perdem um no outro.

import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { DiaSemana } from '../../../nucleo/modelo.ts'
import { horaDeMinutos, minutosDaHora } from '../../../nucleo/tempo.ts'
import { CORES_DE_MATERIA, cores, espaco, fonte, raio } from '../tema.ts'
import { usarT } from '../i18n.ts'
import type { ChaveI18n } from '../../../nucleo/i18n.ts'
import { horaDeTexto } from '../formato.ts'
import { Apoio, Bolinha, Botao, Fileira, Linha, Pilula, Titulo, Toque } from './ui.tsx'
import { SeletorDeHora } from './SeletorDeHora.tsx'

export type FaixaHoraria = { inicio: string; fim: string }

/** Uma opção do seletor de matéria: real (já existe) ou recém-criada. */
export type OpcaoMateria = { chave: string; nome: string; cor: string }

/** O que uma célula ocupada mostra. `chave` é o que identifica a ocupação — o
 * id da aula na grade salva, ou algo estável na prévia — e não precisa bater
 * com `OpcaoMateria.chave` de quem a preenche. */
export type CelulaOcupada = { chave: string; nome: string; cor: string; sub?: string }

const CHAVE_FAIXA = (f: FaixaHoraria) => `${f.inicio}|${f.fim}`
const MESMA_FAIXA = (a: FaixaHoraria, b: FaixaHoraria) => a.inicio === b.inicio && a.fim === b.fim

const LARGURA_HORA = 64
const LARGURA_DIA = 92
const ALTURA_LINHA = 56
const ALTURA_CABECALHO = 32

export function GradeSemanal({
  dias,
  faixas,
  obterCelula,
  materiasDisponiveis,
  aoEscolherMateria,
  aoLimparCelula,
  aoCriarMateria,
  aoAbrirDetalhes,
  aoSalvarFaixa,
  aoRemoverFaixa,
  aoAdicionarFaixa,
}: {
  dias: DiaSemana[]
  /** Já ordenadas — quem chama decide a ordem (pela hora de início). */
  faixas: FaixaHoraria[]
  obterCelula: (dia: DiaSemana, faixa: FaixaHoraria) => CelulaOcupada | undefined
  materiasDisponiveis: OpcaoMateria[]
  aoEscolherMateria: (dia: DiaSemana, faixa: FaixaHoraria, opcao: OpcaoMateria) => void
  aoLimparCelula: (dia: DiaSemana, faixa: FaixaHoraria) => void
  aoCriarMateria: (nome: string, cor: string) => OpcaoMateria
  /** Ausente = a folha da célula não mostra "mais detalhes" (é o caso da prévia:
   * sala e semana alternada só existem depois de confirmar a importação). */
  aoAbrirDetalhes?: (chaveOcupada: string) => void
  aoSalvarFaixa: (faixaAntiga: FaixaHoraria, novoInicio: string, novoFim: string) => void
  aoRemoverFaixa: (faixa: FaixaHoraria) => void
  aoAdicionarFaixa: (inicio: string, fim: string) => void
}) {
  const t = usarT()
  const margem = useSafeAreaInsets()

  // Folha da célula: escolher (ou trocar, ou tirar) a matéria daquele dia+hora.
  const [celulaAtiva, setCelulaAtiva] = useState<{ dia: DiaSemana; faixa: FaixaHoraria } | null>(
    null,
  )
  const [criandoMateria, setCriandoMateria] = useState(false)
  const [novoNomeMateria, setNovoNomeMateria] = useState('')
  const [novaCorMateria, setNovaCorMateria] = useState<string>(CORES_DE_MATERIA[0])

  const fecharCelula = () => {
    setCelulaAtiva(null)
    setCriandoMateria(false)
    setNovoNomeMateria('')
    setNovaCorMateria(CORES_DE_MATERIA[0])
  }

  // Folha da linha: criar, mover ou apagar uma faixa de horário inteira.
  // 'nova' é o modo de criação — não existe faixa anterior para comparar.
  const [faixaEditando, setFaixaEditando] = useState<FaixaHoraria | 'nova' | null>(null)
  const [inicioEditado, setInicioEditado] = useState('08:00')
  const [fimEditado, setFimEditado] = useState('09:40')

  const abrirEdicaoFaixa = (f: FaixaHoraria) => {
    setFaixaEditando(f)
    setInicioEditado(f.inicio)
    setFimEditado(f.fim)
  }

  const abrirNovaFaixa = () => {
    // Sugestão de horário: continua de onde a última faixa parou, com a mesma
    // duração da aula padrão do app (100 min). Sem faixa nenhuma ainda, cai no
    // mesmo padrão que o formulário completo já usa.
    const ultima = faixas[faixas.length - 1]
    const inicio = ultima ? ultima.fim : '08:00'
    const fim = ultima ? horaDeMinutos(minutosDaHora(ultima.fim) + 100) : '09:40'
    setFaixaEditando('nova')
    setInicioEditado(inicio)
    setFimEditado(fim)
  }

  const fecharFaixa = () => setFaixaEditando(null)

  const salvarFaixa = () => {
    if (faixaEditando === 'nova') {
      aoAdicionarFaixa(inicioEditado, fimEditado)
    } else if (faixaEditando) {
      aoSalvarFaixa(faixaEditando, inicioEditado, fimEditado)
    }
    fecharFaixa()
  }

  const ocupadaAtiva = celulaAtiva ? obterCelula(celulaAtiva.dia, celulaAtiva.faixa) : undefined

  return (
    <View style={{ gap: espaco.s }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Coluna de horário: FIXA. É a referência que não pode rolar junto —
            senão a pessoa perde de vista qual linha é qual horário. */}
        <View style={e.colunaHora}>
          <View style={{ height: ALTURA_CABECALHO }} />
          {faixas.map((f) => (
            <Toque key={CHAVE_FAIXA(f)} aoTocar={() => abrirEdicaoFaixa(f)} estilo={e.celulaHora}>
              <Text style={e.horaInicio}>{horaDeTexto(f.inicio)}</Text>
              <Text style={e.horaFim}>{horaDeTexto(f.fim)}</Text>
            </Toque>
          ))}
          <Toque aoTocar={abrirNovaFaixa} estilo={e.botaoNovaFaixa}>
            <Text style={e.maisTexto}>+</Text>
          </Toque>
        </View>

        {/* O indicador FICA ligado, de propósito: com só 4 de 5 dias cabendo na
            tela, escondê-lo faz a tabela parecer cortada/quebrada em vez de
            rolável — "meio esquisitinha", como ele descreveu em 04/09/2026. */}
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={{ flexDirection: 'row', height: ALTURA_CABECALHO }}>
              {dias.map((d) => (
                <View key={d} style={[e.celulaCabecalho, { width: LARGURA_DIA }]}>
                  <Text style={fonte.secao}>{t(`dia.abrev.${d}` as ChaveI18n)}</Text>
                </View>
              ))}
            </View>

            {faixas.map((f) => (
              <View key={CHAVE_FAIXA(f)} style={{ flexDirection: 'row' }}>
                {dias.map((d) => {
                  const ocupada = obterCelula(d, f)
                  return (
                    <Toque
                      key={d}
                      aoTocar={() => setCelulaAtiva({ dia: d, faixa: f })}
                      estilo={[e.celula, { width: LARGURA_DIA }]}
                    >
                      {ocupada ? (
                        <>
                          <Bolinha cor={ocupada.cor} />
                          <Text numberOfLines={2} style={e.celulaTexto}>
                            {ocupada.nome}
                          </Text>
                        </>
                      ) : (
                        <Text style={e.celulaLivre}>{t('grade.celula_livre')}</Text>
                      )}
                    </Toque>
                  )
                })}
              </View>
            ))}

            {/* Espaço vazio do mesmo tamanho do botão "+" da coluna fixa, para
                as duas colunas continuarem alinhadas linha a linha. */}
            <View style={{ height: ALTURA_LINHA }} />
          </View>
        </ScrollView>
      </View>

      <Apoio cor={cores.texto3}>{t('grade.tabela_dica')}</Apoio>

      {/* Folha: escolher a matéria de uma célula */}
      <Modal
        visible={celulaAtiva !== null}
        transparent
        animationType="slide"
        onRequestClose={fecharCelula}
      >
        <Pressable style={e.fundo} onPress={fecharCelula} />
        <View style={[e.folha, { paddingBottom: Math.max(margem.bottom, espaco.m) + espaco.m }]}>
          {celulaAtiva ? (
            <>
              <Text style={[fonte.secao, { textAlign: 'center' }]}>
                {t(`dia.abrev.${celulaAtiva.dia}` as ChaveI18n)} ·{' '}
                {horaDeTexto(celulaAtiva.faixa.inicio)}–{horaDeTexto(celulaAtiva.faixa.fim)}
              </Text>
              <Titulo>{t('grade.selecionar_materia')}</Titulo>

              {ocupadaAtiva ? (
                <Apoio>{ocupadaAtiva.nome}</Apoio>
              ) : (
                <Apoio cor={cores.texto3}>{t('grade.celula_livre')}</Apoio>
              )}

              {!criandoMateria ? (
                <Fileira>
                  {materiasDisponiveis.map((op) => (
                    <Pilula
                      key={op.chave}
                      texto={op.nome}
                      cor={op.cor}
                      ativa={ocupadaAtiva?.chave === op.chave}
                      aoTocar={() => {
                        aoEscolherMateria(celulaAtiva.dia, celulaAtiva.faixa, op)
                        fecharCelula()
                      }}
                    />
                  ))}
                  <Pilula
                    texto={`+ ${t('grade.nova_materia')}`}
                    aoTocar={() => setCriandoMateria(true)}
                  />
                </Fileira>
              ) : (
                <View style={{ gap: espaco.s }}>
                  <TextInput
                    style={e.input}
                    placeholder={t('grade.nome_materia')}
                    placeholderTextColor={cores.textoFraco}
                    value={novoNomeMateria}
                    onChangeText={setNovoNomeMateria}
                  />
                  <View style={e.linhaCores}>
                    {CORES_DE_MATERIA.map((cor) => (
                      <Pressable
                        key={cor}
                        style={[
                          e.circuloCor,
                          { backgroundColor: cor },
                          novaCorMateria === cor && e.circuloCorSelecionado,
                        ]}
                        onPress={() => setNovaCorMateria(cor)}
                      />
                    ))}
                  </View>
                  <Botao
                    texto={t('acao.salvar')}
                    aoTocar={() => {
                      if (!novoNomeMateria.trim()) return
                      const opcao = aoCriarMateria(novoNomeMateria.trim(), novaCorMateria)
                      aoEscolherMateria(celulaAtiva.dia, celulaAtiva.faixa, opcao)
                      fecharCelula()
                    }}
                  />
                </View>
              )}

              <View style={{ gap: espaco.s, marginTop: espaco.s }}>
                {ocupadaAtiva ? (
                  <Botao
                    texto={t('grade.limpar_celula')}
                    variante="discreto"
                    aoTocar={() => {
                      aoLimparCelula(celulaAtiva.dia, celulaAtiva.faixa)
                      fecharCelula()
                    }}
                  />
                ) : null}
                {ocupadaAtiva && aoAbrirDetalhes ? (
                  <Botao
                    texto={t('grade.mais_detalhes')}
                    variante="vazado"
                    aoTocar={() => {
                      aoAbrirDetalhes(ocupadaAtiva.chave)
                      fecharCelula()
                    }}
                  />
                ) : null}
                <Botao texto={t('acao.cancelar')} variante="vazado" aoTocar={fecharCelula} />
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      {/* Folha: criar, mover ou apagar uma linha (faixa de horário) */}
      <Modal
        visible={faixaEditando !== null}
        transparent
        animationType="slide"
        onRequestClose={fecharFaixa}
      >
        <Pressable style={e.fundo} onPress={fecharFaixa} />
        <View style={[e.folha, { paddingBottom: Math.max(margem.bottom, espaco.m) + espaco.m }]}>
          <Titulo>{t('grade.editar_faixa')}</Titulo>
          <Linha entre>
            <SeletorDeHora
              rotulo={t('grade.hora_inicio')}
              valor={inicioEditado}
              aoMudar={setInicioEditado}
            />
            <SeletorDeHora
              rotulo={t('grade.hora_fim')}
              valor={fimEditado}
              aoMudar={setFimEditado}
            />
          </Linha>
          <View style={{ gap: espaco.s, marginTop: espaco.s }}>
            <Botao texto={t('acao.salvar')} aoTocar={salvarFaixa} />
            {faixaEditando !== 'nova' ? (
              <Botao
                texto={t('grade.remover_faixa')}
                variante="discreto"
                aoTocar={() => {
                  if (faixaEditando) aoRemoverFaixa(faixaEditando)
                  fecharFaixa()
                }}
              />
            ) : null}
            <Botao texto={t('acao.cancelar')} variante="vazado" aoTocar={fecharFaixa} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

/** As faixas distintas presentes num conjunto de aulas, ordenadas pelo início. */
export function faixasDeAulas<T extends { inicio: string; fim: string }>(
  aulas: T[],
): FaixaHoraria[] {
  const vistas = new Map<string, FaixaHoraria>()
  for (const a of aulas) {
    const f = { inicio: a.inicio, fim: a.fim }
    vistas.set(CHAVE_FAIXA(f), f)
  }
  return [...vistas.values()].sort((a, b) => minutosDaHora(a.inicio) - minutosDaHora(b.inicio))
}

/** Mescla as faixas derivadas dos dados com as linhas extras (ainda vazias) que
 * a pessoa adicionou na mão, sem duplicar. */
export function mesclarFaixas(dasAulas: FaixaHoraria[], extras: FaixaHoraria[]): FaixaHoraria[] {
  const extrasNovas = extras.filter((ex) => !dasAulas.some((f) => MESMA_FAIXA(f, ex)))
  return [...dasAulas, ...extrasNovas].sort(
    (a, b) => minutosDaHora(a.inicio) - minutosDaHora(b.inicio),
  )
}

export { CHAVE_FAIXA, MESMA_FAIXA }

const e = StyleSheet.create({
  colunaHora: {
    width: LARGURA_HORA,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
  celulaHora: {
    height: ALTURA_LINHA,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
  horaInicio: {
    fontSize: 12,
    fontWeight: '600',
    color: cores.texto,
    fontVariant: ['tabular-nums'],
  },
  horaFim: { fontSize: 10, color: cores.texto3, fontVariant: ['tabular-nums'] },
  botaoNovaFaixa: {
    height: ALTURA_LINHA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maisTexto: { fontSize: 20, color: cores.texto3, fontWeight: '300' },
  celulaCabecalho: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
  celula: {
    height: ALTURA_LINHA,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: espaco.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
  celulaTexto: { fontSize: 11, fontWeight: '600', color: cores.texto, textAlign: 'center' },
  celulaLivre: { fontSize: 10, color: cores.texto4 },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  // OPACO, e não uma cor translúcida: a folha flutua sobre um Modal
  // transparente, sem o preto da tela por baixo para se apoiar — mesma lição
  // da roda de horas em `SeletorDeHora.tsx`.
  folha: {
    backgroundColor: cores.fundoElevado,
    borderTopLeftRadius: raio.g,
    borderTopRightRadius: raio.g,
    padding: espaco.g,
    gap: espaco.s,
  },
  input: {
    backgroundColor: cores.cartao,
    borderColor: cores.borda,
    borderWidth: 1,
    borderRadius: raio.m,
    padding: espaco.m,
    color: cores.texto,
    fontSize: 15,
  },
  linhaCores: { flexDirection: 'row', gap: espaco.s, paddingVertical: espaco.xs },
  circuloCor: { width: 32, height: 32, borderRadius: 16 },
  circuloCorSelecionado: { borderWidth: 3, borderColor: cores.texto },
})
