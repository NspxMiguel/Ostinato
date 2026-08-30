import { useState } from 'react'
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
import { TIPOS_COMPROMISSO, avisosDe } from '../../../nucleo/modelo.ts'
import { cores, espaco, fonte, raio } from '../tema.ts'
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
  Linha,
  Secao,
  Tela,
  Titulo,
} from '../componentes/ui.tsx'


export function NovoCompromisso({ id, aoFechar }: { id?: string; aoFechar: () => void }) {
  const t = usarT()
  const idioma = usarIdioma()
  const base = usarLoja((e) => e.base)
  const ajustes = usarLoja((e) => e.ajustes)
  const guardar = usarLoja((e) => e.guardar)
  const remover = usarLoja((e) => e.remover)

  const periodo = periodoAtivo(base)
  const compromissoExistente = id ? base.compromissos[id] : undefined

  // O criadoEm deve ser preservado ao editar para ancorar 'próxima aula'
  const [criadoEm] = useState<number>(compromissoExistente?.criadoEm ?? Date.now())
  const [tipo, setTipo] = useState<TipoCompromisso>(compromissoExistente?.tipo ?? 'tarefa')
  const [titulo, setTitulo] = useState(compromissoExistente?.titulo ?? '')
  const [detalhe, setDetalhe] = useState(compromissoExistente?.detalhe ?? '')
  const [materiaId, setMateriaId] = useState<string>(compromissoExistente?.materiaId ?? '')
  const [vencimento, setVencimento] = useState<Vencimento>(
    compromissoExistente?.vencimento ?? { tipo: 'data', data: dataDe(new Date()), hora: '23:59' },
  )
  const [avisos, setAvisos] = useState<RegraAviso[] | null>(compromissoExistente?.avisos ?? null)

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
      <ScrollView contentContainerStyle={{ gap: espaco.m }}>
        {/* Tipo de compromisso */}
        <Secao titulo={t('novo_compromisso.tipo_regra')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.listaPilulas}>
            {TIPOS_COMPROMISSO.map((item: TipoCompromisso) => (
              <Pressable
                key={item}
                style={[e.pilula, tipo === item && e.pilulaSelecionada]}
                onPress={() => setTipo(item)}
              >
                <Text
                  style={[
                    e.textoPilula,
                    tipo === item && { color: cores.fundo, fontWeight: '700' },
                  ]}
                >
                  {t(`compromisso.tipo.singular.${item}` as ChaveI18n)}
                </Text>
              </Pressable>
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
          <View style={e.listaPilulas}>
            <Pressable
              style={[e.pilula, materiaId === '' && e.pilulaSelecionada]}
              onPress={() => handleSelecionarMateria('')}
            >
              <Text style={[e.textoPilula, materiaId === '' && { color: cores.fundo, fontWeight: '700' }]}>
                {t('novo_compromisso.nenhuma_materia')}
              </Text>
            </Pressable>
            {materiasVivas.map((m: Materia) => (
              <Pressable
                key={m.id}
                style={[
                  e.pilula,
                  materiaId === m.id && { backgroundColor: m.cor },
                ]}
                onPress={() => handleSelecionarMateria(m.id)}
              >
                <Text
                  style={[
                    e.textoPilula,
                    materiaId === m.id && { color: cores.fundo, fontWeight: '700' },
                  ]}
                >
                  {m.nome}
                </Text>
              </Pressable>
            ))}
          </View>
        </Secao>

        {/* Vencimento */}
        <Secao titulo={t('novo_compromisso.quando_vence')}>
          <View style={{ gap: espaco.s }}>
            <Linha entre>
              <Pressable
                style={[e.opcaoVencimento, vencimento.tipo === 'data' && e.opcaoVencimentoSelecionada]}
                onPress={() => setVencimento({ tipo: 'data', data: dataDe(new Date()), hora: '23:59' })}
              >
                <Text style={[e.textoOpcaoVencimento, vencimento.tipo === 'data' && { fontWeight: '700' }]}>
                  {t('novo_compromisso.opcao_data')}
                </Text>
              </Pressable>

              {materiaId && materiaTemAula ? (
                <Pressable
                  style={[e.opcaoVencimento, vencimento.tipo === 'aula' && e.opcaoVencimentoSelecionada]}
                  onPress={() => setVencimento({ tipo: 'aula', materiaId, ocorrencia: 1 })}
                >
                  <Text style={[e.textoOpcaoVencimento, vencimento.tipo === 'aula' && { fontWeight: '700' }]}>
                    {t('novo_compromisso.opcao_proxima_aula', { materia: materiaSelecionada?.nome ?? '' })}
                  </Text>
                </Pressable>
              ) : null}
            </Linha>

            {vencimento.tipo === 'data' ? (
              <Linha entre>
                <View style={[e.campo, { flex: 1 }]}>
                  <Text style={fonte.secao}>{t('novo_compromisso.data')}</Text>
                  <TextInput
                    style={e.input}
                    value={vencimento.data}
                    onChangeText={(val) => setVencimento({ ...vencimento, data: val })}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={cores.textoFraco}
                    autoCorrect={false}
                    autoCapitalize="none"
                    selectTextOnFocus
                  />
                </View>
                <View style={[e.campo, { flex: 1 }]}>
                  <Text style={fonte.secao}>{t('novo_compromisso.hora')}</Text>
                  <TextInput
                    style={e.input}
                    value={vencimento.hora ?? '23:59'}
                    onChangeText={(val) => setVencimento({ ...vencimento, hora: val })}
                    placeholder="HH:MM"
                    placeholderTextColor={cores.textoFraco}
                    autoCorrect={false}
                    autoCapitalize="none"
                    selectTextOnFocus
                  />
                </View>
              </Linha>
            ) : (
              <View style={{ gap: espaco.s }}>
                <Text style={fonte.secao}>{t('novo_compromisso.ocorrencia')}</Text>
                <View style={e.listaPilulas}>
                  {[1, 2, 3, 4].map((n) => (
                    <Pressable
                      key={n}
                      style={[
                        e.pilula,
                        vencimento.ocorrencia === n && e.pilulaSelecionada,
                      ]}
                      onPress={() =>
                        setVencimento({ tipo: 'aula', materiaId, ocorrencia: n })
                      }
                    >
                      <Text
                        style={[
                          e.textoPilula,
                          vencimento.ocorrencia === n && { color: cores.fundo, fontWeight: '700' },
                        ]}
                      >
                        {t('novo_compromisso.proxima_aula_n', { n })}
                      </Text>
                    </Pressable>
                  ))}
                </View>

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
                        <View style={e.listaPilulas}>
                          {(['normal', 'insistente', 'alarme'] as ModoAviso[]).map((m: ModoAviso) => (
                            <Pressable
                              key={m}
                              style={[
                                e.pilulaPequena,
                                regra.modo === m && e.pilulaSelecionada,
                              ]}
                              onPress={() =>
                                atualizarRegra(idx, { ...regra, modo: m })
                              }
                            >
                              <Text
                                style={[
                                  e.textoPilula,
                                  regra.modo === m && { color: cores.fundo, fontWeight: '700' },
                                ]}
                              >
                                {t(`avisos.modo.${m}` as ChaveI18n)}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
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

const e = StyleSheet.create({
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
  pilula: {
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.s,
    borderRadius: raio.pilula,
    backgroundColor: cores.cartaoAlto,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  pilulaPequena: {
    paddingHorizontal: espaco.s,
    paddingVertical: 4,
    borderRadius: raio.pilula,
    backgroundColor: cores.cartaoAlto,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  pilulaSelecionada: { backgroundColor: cores.marfim },
  textoPilula: { fontSize: 13, color: cores.texto },
  opcaoVencimento: {
    flex: 1,
    padding: espaco.m,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.cartao,
    alignItems: 'center',
  },
  opcaoVencimentoSelecionada: {
    borderColor: cores.marfim,
    backgroundColor: cores.cartaoAlto,
  },
  textoOpcaoVencimento: { fontSize: 13, color: cores.texto },
})
