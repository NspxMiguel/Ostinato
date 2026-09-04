import { useCallback, useEffect, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type {
  Aula,
  Compromisso,
  Materia,
  ModoAviso,
  RegraAviso,
  TipoCompromisso,
  Vencimento,
} from '../../../nucleo/modelo.ts'
import { LOCALE_DO_IDIOMA, TIPOS_COMPROMISSO, avisosDe } from '../../../nucleo/modelo.ts'
import { criarFonte, espaco, raio, usarCores, type Paleta } from '../tema.ts'
import { SeletorDeData } from '../componentes/SeletorDeData.tsx'
import { momentoPorExtenso, rotuloDeRegra } from '../formato.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarIdioma, usarT } from '../i18n.ts'
import type { ChaveI18n, criarT } from '../../../nucleo/i18n.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import { previaDeVencimento } from '../../../nucleo/vencimento.ts'
import { dataDe } from '../../../nucleo/tempo.ts'
import {
  Apoio,
  Botao,
  Cartao,
  Etiqueta,
  Fileira,
  Linha,
  Pilula,
  Secao,
  Tela,
  Titulo,
} from '../componentes/ui.tsx'


export function NovoCompromisso({
  id,
  rascunho,
  aoFechar,
  aoMudarPendencia,
}: {
  id?: string
  /**
   * O que a captura por texto/foto/voz já entendeu, para a folha nascer
   * preenchida em vez de em branco.
   *
   * Existe porque "Adjust in the form" jogava tudo fora: a pessoa escrevia
   * "math exam today 11:56pm", via a prévia acertar tipo e data, tocava para
   * ajustar um detalhe — e a folha abria vazia, pedindo para escrever tudo de
   * novo. Ignorado quando `id` está presente: editar um compromisso existente
   * usa o dado salvo, não um rascunho de fora.
   */
  rascunho?: Partial<Compromisso>
  aoFechar: () => void
  /**
   * Avisa quem apresenta a folha de que existe coisa preenchida e não salva.
   *
   * Existe porque a folha do iOS fecha ARRASTANDO, e o arrastar não passa por
   * nenhum botão daqui: sem este aviso, quem escorrega o dedo perde o
   * formulário inteiro sem uma pergunta. Medido em 03/09/2026, perdendo um.
   */
  aoMudarPendencia?: (pendente: boolean) => void
}) {
  const t = usarT()
  const cores = usarCores()
  const fonte = criarFonte(cores)
  const e = criarEstilo(cores)
  const idioma = usarIdioma()
  const base = usarLoja((e) => e.base)
  const ajustes = usarLoja((e) => e.ajustes)
  const guardar = usarLoja((e) => e.guardar)
  const remover = usarLoja((e) => e.remover)

  const periodo = periodoAtivo(base)
  const compromissoExistente = id ? base.compromissos[id] : undefined

  // O que semeia os campos: o compromisso salvo ao editar, o rascunho da
  // captura por texto/foto/voz ao ajustar, ou nada ao criar do zero. Os dois
  // primeiros nunca coexistem — `rascunho` só chega quando não há `id`.
  const partida = compromissoExistente ?? rascunho

  // O criadoEm deve ser preservado ao editar para ancorar 'próxima aula'
  const [criadoEm] = useState<number>(compromissoExistente?.criadoEm ?? Date.now())
  const [tipo, setTipo] = useState<TipoCompromisso>(partida?.tipo ?? 'tarefa')
  const [titulo, setTitulo] = useState(partida?.titulo ?? '')
  const [detalhe, setDetalhe] = useState(partida?.detalhe ?? '')
  const [materiaId, setMateriaId] = useState<string>(partida?.materiaId ?? '')
  const [vencimento, setVencimento] = useState<Vencimento>(
    partida?.vencimento ?? { tipo: 'data', data: dataDe(new Date()), hora: '23:59' },
  )
  const [avisos, setAvisos] = useState<RegraAviso[] | null>(partida?.avisos ?? null)

  // O que conta como "tem coisa aqui dentro".
  //
  // Ao EDITAR, é ter mexido em algo. Ao CRIAR, é ter escrito qualquer coisa —
  // tipo e vencimento nascem preenchidos por padrão e não valem como trabalho
  // da pessoa, senão toda folha recém-aberta pediria confirmação para fechar.
  const pendente = compromissoExistente
    ? tipo !== compromissoExistente.tipo ||
      titulo !== compromissoExistente.titulo ||
      detalhe !== (compromissoExistente.detalhe ?? '') ||
      materiaId !== (compromissoExistente.materiaId ?? '') ||
      JSON.stringify(vencimento) !== JSON.stringify(compromissoExistente.vencimento) ||
      JSON.stringify(avisos) !== JSON.stringify(compromissoExistente.avisos ?? null)
    : titulo.trim() !== '' || detalhe.trim() !== '' || materiaId !== '' || avisos !== null

  useEffect(() => {
    aoMudarPendencia?.(pendente)
    // Ao desmontar, a folha já foi embora: nada mais está pendente.
    return () => aoMudarPendencia?.(false)
  }, [pendente, aoMudarPendencia])

  const materiasVivas = vivos(base.materias)
  const materiaSelecionada = materiaId ? base.materias[materiaId] : undefined

  // Verifica se a matéria escolhida possui alguma aula cadastrada na grade
  const materiaTemAula = materiaId
    ? vivos(base.aulas).some((a: Aula) => a.materiaId === materiaId)
    : false

  const handleSelecionarMateria = (mId: string) => {
    setMateriaId(mId)
    // Se trocou para matéria sem aulas e o vencimento estava em 'aula', volta para 'data'
    if (vencimento.tipo === 'aula' && mId !== vencimento.materiaId) {
      const tem = vivos(base.aulas).some((a: Aula) => a.materiaId === mId)
      if (!tem) {
        setVencimento({ tipo: 'data', data: dataDe(new Date()), hora: '23:59' })
      } else {
        setVencimento({ tipo: 'aula', materiaId: mId, ocorrencia: vencimento.ocorrencia })
      }
    }
  }

  // Prévia em tempo real para a opção 'aula'
  const previa =
    vencimento.tipo === 'aula'
      ? previaDeVencimento(
          vencimento.materiaId,
          vencimento.ocorrencia,
          base,
          periodo,
          new Date(),
        )
      : null

  // Compromisso temporário para calcular avisos default
  const tempCompromisso: Compromisso = {
    id: id ?? 'temp',
    criadoEm,
    tipo,
    titulo,
    detalhe,
    materiaId: materiaId || undefined,
    vencimento,
    avisos,
    concluido: compromissoExistente?.concluido ?? false,
    atualizadoEm: Date.now(),
    removido: false,
    origem: '',
  }
  const regrasEfetivas = avisosDe(tempCompromisso, ajustes)

  const salvar = () => {
    if (!titulo.trim()) return

    guardar('compromissos', {
      ...(id ? { id } : {}),
      criadoEm,
      tipo,
      titulo: titulo.trim(),
      detalhe: detalhe.trim() || undefined,
      materiaId: materiaId || undefined,
      vencimento,
      avisos,
      concluido: compromissoExistente?.concluido ?? false,
    })
    aoFechar()
  }

  const apagar = () => {
    if (id) {
      remover('compromissos', id)
    }
    aoFechar()
  }

  const adicionarNovaRegra = () => {
    const novaRegra: RegraAviso = {
      id: `aviso-${Date.now()}`,
      quando: { tipo: 'diasAntes', dias: 1, aHora: '20:00' },
      modo: 'normal',
    }
    setAvisos([...(avisos ?? regrasEfetivas), novaRegra])
  }

  const removerRegra = (index: number) => {
    const lista = [...(avisos ?? regrasEfetivas)]
    lista.splice(index, 1)
    setAvisos(lista)
  }

  const atualizarRegra = (index: number, nova: RegraAviso) => {
    const lista = [...(avisos ?? regrasEfetivas)]
    lista[index] = nova
    setAvisos(lista)
  }

  return (
    <Tela titulo={id ? t('novo_compromisso.titulo_tela_editar') : t('novo_compromisso.titulo_tela_novo')}>
      {/* Sem isto, tocar Save logo depois de escrever no Título só fecha o
          teclado — o toque é engolido e o botão só reage no SEGUNDO toque. */}
      <ScrollView contentContainerStyle={{ gap: espaco.m }} keyboardShouldPersistTaps="handled">
        {/* Tipo de compromisso */}
        <Secao titulo={t('novo_compromisso.tipo_regra')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.listaPilulas}>
            {TIPOS_COMPROMISSO.map((item: TipoCompromisso) => (
              <Pilula
                key={item}
                texto={t(`compromisso.tipo.singular.${item}` as ChaveI18n)}
                ativa={tipo === item}
                aoTocar={() => setTipo(item)}
              />
            ))}
          </ScrollView>
        </Secao>

        {/* Título */}
        <View style={e.campo}>
          <Text style={fonte.secao}>{t('novo_compromisso.titulo')}</Text>
          <TextInput
            style={e.input}
            value={titulo}
            onChangeText={setTitulo}
            placeholderTextColor={cores.textoFraco}
          />
        </View>

        {/* Detalhes */}
        <View style={e.campo}>
          <Text style={fonte.secao}>{t('novo_compromisso.detalhe')}</Text>
          <TextInput
            style={[e.input, e.inputMultilinha]}
            value={detalhe}
            onChangeText={setDetalhe}
            multiline
            numberOfLines={3}
            placeholderTextColor={cores.textoFraco}
          />
        </View>

        {/* Matéria */}
        <Secao titulo={t('novo_compromisso.materia')}>
          <Fileira>
            <Pilula
              texto={t('novo_compromisso.nenhuma_materia')}
              ativa={materiaId === ''}
              aoTocar={() => handleSelecionarMateria('')}
            />
            {materiasVivas.map((m: Materia) => (
              <Pilula
                key={m.id}
                texto={m.nome}
                cor={m.cor}
                ativa={materiaId === m.id}
                aoTocar={() => handleSelecionarMateria(m.id)}
              />
            ))}
          </Fileira>
        </Secao>

        {/* Vencimento */}
        <Secao titulo={t('novo_compromisso.quando_vence')}>
          <View style={{ gap: espaco.s }}>
            <Linha entre>
              <Pilula
                texto={t('novo_compromisso.opcao_data')}
                ativa={vencimento.tipo === 'data'}
                aoTocar={() => setVencimento({ tipo: 'data', data: dataDe(new Date()), hora: '23:59' })}
              />

              {materiaId && materiaTemAula ? (
                <Pilula
                  texto={t('novo_compromisso.opcao_proxima_aula', {
                    materia: materiaSelecionada?.nome ?? '',
                  })}
                  ativa={vencimento.tipo === 'aula'}
                  aoTocar={() => setVencimento({ tipo: 'aula', materiaId, ocorrencia: 1 })}
                />
              ) : null}
            </Linha>

            {vencimento.tipo === 'data' ? (
              <SeletorDeData
                data={vencimento.data}
                hora={vencimento.hora ?? '23:59'}
                locale={LOCALE_DO_IDIOMA[idioma]}
                rotuloData={t('novo_compromisso.data')}
                rotuloHora={t('novo_compromisso.hora')}
                aoMudar={(data, hora) => setVencimento({ tipo: 'data', data, hora })}
              />
            ) : (
              <View style={{ gap: espaco.s }}>
                <Text style={fonte.secao}>{t('novo_compromisso.ocorrencia')}</Text>
                <Fileira>
                  {[1, 2, 3, 4].map((n) => (
                    <Pilula
                      key={n}
                      texto={t('novo_compromisso.proxima_aula_n', { n })}
                      ativa={vencimento.ocorrencia === n}
                      aoTocar={() => setVencimento({ tipo: 'aula', materiaId, ocorrencia: n })}
                    />
                  ))}
                </Fileira>

                {previa ? (
                  <Cartao>
                    <Titulo>
                      {t('novo_compromisso.vence_em', {
                        dataPorExtenso: momentoPorExtenso(previa.quando, idioma),
                      })}
                    </Titulo>
                  </Cartao>
                ) : (
                  <Apoio>{t('novo_compromisso.sem_previa')}</Apoio>
                )}
              </View>
            )}
          </View>
        </Secao>

        {/* Avisos */}
        <Secao titulo={t('novo_compromisso.avisos')}>
          <View style={{ gap: espaco.s }}>
            {avisos === null ? (
              <View style={{ gap: espaco.s }}>
                <Apoio>
                  {t('novo_compromisso.usar_padrao_tipo', {
                    tipo: t(`compromisso.tipo.singular.${tipo}` as ChaveI18n),
                  })}
                </Apoio>
                {regrasEfetivas.map((r: RegraAviso) => (
                  <Cartao key={r.id}>
                    <Linha entre>
                      <Titulo>{rotuloDeRegra(r, t)}</Titulo>
                      <Etiqueta texto={t(`avisos.modo.${r.modo}` as ChaveI18n)} />
                    </Linha>
                  </Cartao>
                ))}
                <Botao
                  texto={t('novo_compromisso.personalizar')}
                  variante="vazado"
                  aoTocar={() => setAvisos([...regrasEfetivas])}
                />
              </View>
            ) : (
              <View style={{ gap: espaco.s }}>
                <Linha entre>
                  <Apoio>{t('novo_compromisso.avisos_personalizados')}</Apoio>
                  <Pressable onPress={() => setAvisos(null)}>
                    <Apoio cor={cores.destaque}>
                      {t('novo_compromisso.usar_padrao_tipo', {
                        tipo: t(`compromisso.tipo.singular.${tipo}` as ChaveI18n),
                      })}
                    </Apoio>
                  </Pressable>
                </Linha>

                {avisos.map((regra: RegraAviso, idx: number) => (
                  <Cartao key={regra.id || idx}>
                    <View style={{ gap: espaco.s }}>
                      <Linha entre>
                        <Fileira>
                          {(['normal', 'insistente', 'alarme'] as ModoAviso[]).map((m: ModoAviso) => (
                            <Pilula
                              key={m}
                              texto={t(`avisos.modo.${m}` as ChaveI18n)}
                              ativa={regra.modo === m}
                              aoTocar={() => atualizarRegra(idx, { ...regra, modo: m })}
                            />
                          ))}
                        </Fileira>
                        <Pressable onPress={() => removerRegra(idx)}>
                          <Apoio cor={cores.atrasado}>
                            {t('novo_compromisso.remover_aviso')}
                          </Apoio>
                        </Pressable>
                      </Linha>

                      {regra.quando.tipo === 'diasAntes' ? (
                        <Linha entre>
                          <View style={[e.campo, { flex: 1 }]}>
                            <Text style={fonte.secao}>{t('novo_compromisso.dias_antes_qtd')}</Text>
                            <TextInput
                              style={e.input}
                              keyboardType="numeric"
                              value={String(regra.quando.dias)}
                              onChangeText={(val) =>
                                atualizarRegra(idx, {
                                  ...regra,
                                  quando: {
                                    tipo: 'diasAntes',
                                    dias: Number(val) || 1,
                                    aHora:
                                      regra.quando.tipo === 'diasAntes'
                                        ? regra.quando.aHora
                                        : '20:00',
                                  },
                                })
                              }
                              autoCorrect={false}
                              autoCapitalize="none"
                    selectTextOnFocus
                            />
                          </View>
                          <View style={[e.campo, { flex: 1 }]}>
                            <Text style={fonte.secao}>{t('novo_compromisso.horario_aviso')}</Text>
                            <TextInput
                              style={e.input}
                              value={regra.quando.aHora}
                              onChangeText={(val) =>
                                atualizarRegra(idx, {
                                  ...regra,
                                  quando: {
                                    tipo: 'diasAntes',
                                    dias:
                                      regra.quando.tipo === 'diasAntes'
                                        ? regra.quando.dias
                                        : 1,
                                    aHora: val,
                                  },
                                })
                              }
                            />
                          </View>
                        </Linha>
                      ) : regra.quando.tipo === 'antesDaPrimeiraAula' ? (
                        <View style={e.campo}>
                          <Text style={fonte.secao}>{t('avisos.horas_antes_aula_qtd')}</Text>
                          <TextInput
                            style={e.input}
                            keyboardType="numeric"
                            value={String(regra.quando.horas)}
                            onChangeText={(val) =>
                              atualizarRegra(idx, {
                                ...regra,
                                quando: {
                                  tipo: 'antesDaPrimeiraAula',
                                  horas: Math.max(1, Number(val) || 2),
                                },
                              })
                            }
                            autoCorrect={false}
                            autoCapitalize="none"
                            selectTextOnFocus
                          />
                        </View>
                      ) : (
                        <View style={e.campo}>
                          <Text style={fonte.secao}>{t('novo_compromisso.minutos_antes_qtd')}</Text>
                          <TextInput
                            style={e.input}
                            keyboardType="numeric"
                            value={String(regra.quando.minutos)}
                            onChangeText={(val) =>
                              atualizarRegra(idx, {
                                ...regra,
                                quando: { tipo: 'antesDe', minutos: Number(val) || 60 },
                              })
                            }
                            autoCorrect={false}
                            autoCapitalize="none"
                    selectTextOnFocus
                          />
                        </View>
                      )}
                    </View>
                  </Cartao>
                ))}

                <Botao
                  texto={t('novo_compromisso.adicionar_aviso')}
                  variante="vazado"
                  aoTocar={adicionarNovaRegra}
                />
              </View>
            )}
          </View>
        </Secao>

        {/* Ações */}
        <View style={{ gap: espaco.s, marginTop: espaco.m }}>
          <Botao texto={t('acao.salvar')} aoTocar={salvar} />
          {id ? <Botao texto={t('acao.apagar')} variante="discreto" aoTocar={apagar} /> : null}
          <Botao texto={t('acao.cancelar')} variante="vazado" aoTocar={aoFechar} />
        </View>
      </ScrollView>
    </Tela>
  )
}

function criarEstilo(cores: Paleta) {
  return StyleSheet.create({
  campo: { gap: espaco.xs },
  input: {
    backgroundColor: cores.cartao,
    borderColor: cores.borda,
    borderWidth: 1,
    borderRadius: raio.m,
    padding: espaco.m,
    color: cores.texto,
    fontSize: 15,
  },
  inputMultilinha: { height: 80, textAlignVertical: 'top' },
  listaPilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s },
  })
}
