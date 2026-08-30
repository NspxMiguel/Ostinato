import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { Aula, DiaSemana, Materia, SemanaAlternada } from '../../../nucleo/modelo.ts'
import { CORES_DE_MATERIA, cores, espaco, fonte, raio } from '../tema.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarT } from '../i18n.ts'
import type { ChaveI18n } from '../../../nucleo/i18n.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import type { ResultadoImportacao } from '../../../nucleo/importarGrade.ts'
import { importarGrade } from '../../../nucleo/importarGrade.ts'
import {
  Apoio,
  Botao,
  Cartao,
  Etiqueta,
  Linha,
  Secao,
  Tela,
  Titulo,
  Vazio,
} from '../componentes/ui.tsx'

/** Semestre que contem hoje: fevereiro a julho, ou agosto a dezembro. */
function periodoPadrao(agora: Date): { nome: string; inicio: string; fim: string } {
  const ano = agora.getFullYear()
  const primeiro = agora.getMonth() < 6
  return primeiro
    ? { nome: `${ano}.1`, inicio: `${ano}-02-01`, fim: `${ano}-07-15` }
    : { nome: `${ano}.2`, inicio: `${ano}-08-01`, fim: `${ano}-12-20` }
}

export function Grade() {
  const t = usarT()
  const base = usarLoja((e) => e.base)
  const guardar = usarLoja((e) => e.guardar)
  const remover = usarLoja((e) => e.remover)

  const periodo = periodoAtivo(base)

  // Formulário para cadastro inicial de período letivo
  // O padrao tem que ABRACAR HOJE. Um periodo que ja terminou faz "na proxima
  // aula de X" nao resolver nada, e a tela nao teria como explicar por que.
  const padrao = periodoPadrao(new Date())
  const [nomePeriodo, setNomePeriodo] = useState(padrao.nome)
  const [inicioPeriodo, setInicioPeriodo] = useState(padrao.inicio)
  const [fimPeriodo, setFimPeriodo] = useState(padrao.fim)

  // Modal de edição / criação de aula
  const [modalAulaVisivel, setModalAulaVisivel] = useState(false)
  const [aulaEdicao, setAulaEdicao] = useState<Aula | null>(null)
  const [materiaId, setMateriaId] = useState<string>('')
  const [criandoNovaMateria, setCriandoNovaMateria] = useState(false)
  const [novaMateriaNome, setNovaMateriaNome] = useState('')
  const [novaMateriaCor, setNovaMateriaCor] = useState<string>(CORES_DE_MATERIA[0])
  const [diaSemana, setDiaSemana] = useState<DiaSemana>(1)
  const [inicio, setInicio] = useState('08:00')
  const [fim, setFim] = useState('09:40')
  const [sala, setSala] = useState('')
  const [semana, setSemana] = useState<SemanaAlternada>('toda')

  // Modal de colar horário
  const [modalColarVisivel, setModalColarVisivel] = useState(false)
  const [textoColado, setTextoColado] = useState('')
  const [previaImportacao, setPreviaImportacao] = useState<ResultadoImportacao | null>(null)

  // Sem período letivo cadastrado, a tela exige a criação do período antes da grade
  if (!periodo) {
    const handleCriarPeriodo = () => {
      if (!nomePeriodo.trim() || !inicioPeriodo.trim() || !fimPeriodo.trim()) return
      guardar('periodos', {
        nome: nomePeriodo.trim(),
        inicio: inicioPeriodo.trim(),
        fim: fimPeriodo.trim(),
        feriados: [],
        ativo: true,
      })
    }

    return (
      <Tela titulo={t('grade.sem_periodo_titulo')}>
        <Secao titulo={t('grade.sem_periodo_titulo')}>
          <Apoio>{t('grade.sem_periodo_desc')}</Apoio>
          <View style={e.campo}>
            <Text style={fonte.secao}>{t('grade.nome_periodo')}</Text>
            <TextInput
              style={e.input}
              value={nomePeriodo}
              onChangeText={setNomePeriodo}
              placeholderTextColor={cores.textoFraco}
            />
          </View>
          <View style={e.campo}>
            <Text style={fonte.secao}>{t('grade.inicio_periodo')}</Text>
            <TextInput
              style={e.input}
              value={inicioPeriodo}
              onChangeText={setInicioPeriodo}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={cores.textoFraco}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <View style={e.campo}>
            <Text style={fonte.secao}>{t('grade.fim_periodo')}</Text>
            <TextInput
              style={e.input}
              value={fimPeriodo}
              onChangeText={setFimPeriodo}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={cores.textoFraco}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <Botao texto={t('grade.criar_periodo')} aoTocar={handleCriarPeriodo} />
        </Secao>
      </Tela>
    )
  }

  const aulasVivas = vivos(base.aulas)
  const materiasVivas = vivos(base.materias)
  const mapaMaterias: Record<string, Materia> = Object.fromEntries(
    materiasVivas.map((m: Materia) => [m.id, m]),
  )

  // Dias com aula ou segunda a sexta por padrão
  const temSabado = aulasVivas.some((a: Aula) => a.diaSemana === 6)
  const temDomingo = aulasVivas.some((a: Aula) => a.diaSemana === 0)
  const diasParaExibir: DiaSemana[] = [
    ...(temDomingo ? ([0] as DiaSemana[]) : []),
    1, 2, 3, 4, 5,
    ...(temSabado ? ([6] as DiaSemana[]) : []),
  ]

  const abrirCriacaoAula = (dia: DiaSemana) => {
    setAulaEdicao(null)
    setDiaSemana(dia)
    setInicio('08:00')
    setFim('09:40')
    setSala('')
    setSemana('toda')
    if (materiasVivas.length > 0) {
      setMateriaId(materiasVivas[0]?.id ?? '')
      setCriandoNovaMateria(false)
    } else {
      setMateriaId('')
      setCriandoNovaMateria(true)
    }
    setNovaMateriaNome('')
    setNovaMateriaCor(CORES_DE_MATERIA[0])
    setModalAulaVisivel(true)
  }

  const abrirEdicaoAula = (aula: Aula) => {
    setAulaEdicao(aula)
    setMateriaId(aula.materiaId)
    setCriandoNovaMateria(false)
    setDiaSemana(aula.diaSemana)
    setInicio(aula.inicio)
    setFim(aula.fim)
    setSala(aula.sala ?? '')
    setSemana(aula.semana)
    setNovaMateriaNome('')
    setNovaMateriaCor(CORES_DE_MATERIA[0])
    setModalAulaVisivel(true)
  }

  const salvarAula = () => {
    let finalMateriaId = materiaId
    if (criandoNovaMateria) {
      if (!novaMateriaNome.trim()) return
      finalMateriaId = guardar('materias', {
        periodoId: periodo.id,
        nome: novaMateriaNome.trim(),
        cor: novaMateriaCor,
        limiteFaltasPct: 25,
      })
    }
    if (!finalMateriaId) return

    guardar('aulas', {
      ...(aulaEdicao ? { id: aulaEdicao.id } : {}),
      materiaId: finalMateriaId,
      diaSemana,
      inicio: inicio.trim(),
      fim: fim.trim(),
      sala: sala.trim() || undefined,
      semana,
    })
    setModalAulaVisivel(false)
  }

  const apagarAula = () => {
    if (aulaEdicao) {
      remover('aulas', aulaEdicao.id)
    }
    setModalAulaVisivel(false)
  }

  const analisarTextoColado = () => {
    const res = importarGrade(textoColado)
    setPreviaImportacao(res)
  }

  const confirmarImportacao = () => {
    if (!previaImportacao || !periodo) return

    const mapaNomesParaId: Record<string, string> = {}
    let corIndice = 0

    for (const nomeMat of previaImportacao.materias) {
      const normalizado = nomeMat.trim().toLowerCase()
      const existente = materiasVivas.find((m: Materia) => m.nome.trim().toLowerCase() === normalizado)
      if (existente) {
        mapaNomesParaId[nomeMat] = existente.id
      } else {
        const cor = CORES_DE_MATERIA[corIndice % CORES_DE_MATERIA.length] ?? CORES_DE_MATERIA[0]
        corIndice++
        const novaId = guardar('materias', {
          periodoId: periodo.id,
          nome: nomeMat.trim(),
          cor,
          limiteFaltasPct: 25,
        })
        mapaNomesParaId[nomeMat] = novaId
      }
    }

    for (const aulaCrua of previaImportacao.aulas) {
      const matId = mapaNomesParaId[aulaCrua.materia]
      if (matId) {
        guardar('aulas', {
          materiaId: matId,
          diaSemana: aulaCrua.diaSemana,
          inicio: aulaCrua.inicio,
          fim: aulaCrua.fim,
          sala: aulaCrua.sala,
          semana: 'toda',
        })
      }
    }

    setModalColarVisivel(false)
    setTextoColado('')
    setPreviaImportacao(null)
  }

  return (
    <Tela titulo={t('abas.grade')}>
      <Linha entre>
        <Botao
          texto={t('grade.colar_horario')}
          variante="vazado"
          aoTocar={() => {
            setTextoColado('')
            setPreviaImportacao(null)
            setModalColarVisivel(true)
          }}
        />
        <Botao
          texto={t('grade.adicionar_aula')}
          variante="cheio"
          aoTocar={() => abrirCriacaoAula(1)}
        />
      </Linha>

      {aulasVivas.length === 0 ? (
        <Vazio texto={t('grade.sem_aulas')} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.gradeContainer}>
          {diasParaExibir.map((dia: DiaSemana) => {
            const aulasDoDia = aulasVivas
              .filter((a: Aula) => a.diaSemana === dia)
              .sort((a: Aula, b: Aula) => a.inicio.localeCompare(b.inicio))

            return (
              <View key={dia} style={e.colunaDia}>
                <Text style={fonte.secao}>{t(`dia.completo.${dia}` as ChaveI18n)}</Text>
                <View style={e.listaBlocos}>
                  {aulasDoDia.map((aula: Aula) => {
                    const materia = mapaMaterias[aula.materiaId]
                    return (
                      <Cartao
                        key={aula.id}
                        faixa={materia?.cor}
                        aoTocar={() => abrirEdicaoAula(aula)}
                      >
                        <Titulo>{materia?.nome ?? ''}</Titulo>
                        <Apoio>
                          {aula.inicio} - {aula.fim}
                          {aula.sala ? ` · ${aula.sala}` : ''}
                        </Apoio>
                        {aula.semana !== 'toda' ? (
                          <Etiqueta texto={t(`grade.semana_${aula.semana}` as ChaveI18n)} />
                        ) : null}
                      </Cartao>
                    )
                  })}
                  <Pressable style={e.botaoVazioDia} onPress={() => abrirCriacaoAula(dia)}>
                    <Text style={fonte.apoio}>+ {t('grade.adicionar_aula')}</Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* Modal de Edição / Criação de Aula */}
      <Modal
        visible={modalAulaVisivel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalAulaVisivel(false)}
      >
        <View style={e.modalConteudo}>
          <ScrollView contentContainerStyle={{ gap: espaco.m }}>
            <Titulo>{aulaEdicao ? t('grade.editar_aula') : t('grade.nova_aula')}</Titulo>

            {/* Seleção de Matéria */}
            <Secao titulo={t('grade.selecionar_materia')}>
              {materiasVivas.length > 0 && !criandoNovaMateria ? (
                <View style={e.listaPilulas}>
                  {materiasVivas.map((m: Materia) => (
                    <Pressable
                      key={m.id}
                      style={[
                        e.pilula,
                        materiaId === m.id && { backgroundColor: m.cor },
                      ]}
                      onPress={() => setMateriaId(m.id)}
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
                  <Pressable
                    style={[e.pilula, e.pilulaAdicionar]}
                    onPress={() => {
                      setCriandoNovaMateria(true)
                      setMateriaId('')
                    }}
                  >
                    <Text style={e.textoPilula}>+ {t('grade.nova_materia')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: espaco.s }}>
                  {materiasVivas.length > 0 ? (
                    <Pressable onPress={() => setCriandoNovaMateria(false)}>
                      <Apoio cor={cores.destaque}>← {t('grade.selecionar_materia')}</Apoio>
                    </Pressable>
                  ) : null}
                  <TextInput
                    style={e.input}
                    placeholder={t('grade.nome_materia')}
                    placeholderTextColor={cores.textoFraco}
                    value={novaMateriaNome}
                    onChangeText={setNovaMateriaNome}
                  />
                  <Text style={fonte.secao}>{t('grade.cor_materia')}</Text>
                  <View style={e.linhaCores}>
                    {CORES_DE_MATERIA.map((cor) => (
                      <Pressable
                        key={cor}
                        style={[
                          e.circuloCor,
                          { backgroundColor: cor },
                          novaMateriaCor === cor && e.circuloCorSelecionado,
                        ]}
                        onPress={() => setNovaMateriaCor(cor)}
                      />
                    ))}
                  </View>
                </View>
              )}
            </Secao>

            {/* Dia da semana */}
            <Secao titulo={t('grade.dia_semana')}>
              <View style={e.listaPilulas}>
                {([0, 1, 2, 3, 4, 5, 6] as DiaSemana[]).map((d: DiaSemana) => (
                  <Pressable
                    key={d}
                    style={[e.pilula, diaSemana === d && e.pilulaSelecionada]}
                    onPress={() => setDiaSemana(d)}
                  >
                    <Text
                      style={[
                        e.textoPilula,
                        diaSemana === d && { color: cores.fundo, fontWeight: '700' },
                      ]}
                    >
                      {t(`dia.abrev.${d}` as ChaveI18n)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Secao>

            {/* Horários */}
            <Linha entre>
              <View style={[e.campo, { flex: 1 }]}>
                <Text style={fonte.secao}>{t('grade.hora_inicio')}</Text>
                <TextInput
                  style={e.input}
                  value={inicio}
                  onChangeText={setInicio}
                  placeholder="08:00"
                  placeholderTextColor={cores.textoFraco}
                />
              </View>
              <View style={[e.campo, { flex: 1 }]}>
                <Text style={fonte.secao}>{t('grade.hora_fim')}</Text>
                <TextInput
                  style={e.input}
                  value={fim}
                  onChangeText={setFim}
                  placeholder="09:40"
                  placeholderTextColor={cores.textoFraco}
                />
              </View>
            </Linha>

            {/* Sala */}
            <View style={e.campo}>
              <Text style={fonte.secao}>{t('grade.sala')}</Text>
              <TextInput
                style={e.input}
                value={sala}
                onChangeText={setSala}
                placeholderTextColor={cores.textoFraco}
              />
            </View>

            {/* Semana alternada */}
            <Secao titulo={t('grade.semana')}>
              <View style={e.listaPilulas}>
                {(['toda', 'par', 'impar'] as SemanaAlternada[]).map((s: SemanaAlternada) => (
                  <Pressable
                    key={s}
                    style={[e.pilula, semana === s && e.pilulaSelecionada]}
                    onPress={() => setSemana(s)}
                  >
                    <Text
                      style={[
                        e.textoPilula,
                        semana === s && { color: cores.fundo, fontWeight: '700' },
                      ]}
                    >
                      {t(`grade.semana_${s}` as ChaveI18n)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Secao>

            {/* Ações */}
            <View style={{ gap: espaco.s, marginTop: espaco.m }}>
              <Botao texto={t('acao.salvar')} aoTocar={salvarAula} />
              {aulaEdicao ? (
                <Botao texto={t('acao.apagar')} variante="discreto" aoTocar={apagarAula} />
              ) : null}
              <Botao
                texto={t('acao.cancelar')}
                variante="vazado"
                aoTocar={() => setModalAulaVisivel(false)}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Colar Horário */}
      <Modal
        visible={modalColarVisivel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalColarVisivel(false)}
      >
        <View style={e.modalConteudo}>
          <ScrollView contentContainerStyle={{ gap: espaco.m }}>
            <Titulo>{t('grade.colar_horario')}</Titulo>

            {!previaImportacao ? (
              <Secao titulo={t('grade.colar_instrucao')}>
                <TextInput
                  style={[e.input, e.inputMultilinha]}
                  multiline
                  numberOfLines={8}
                  value={textoColado}
                  onChangeText={setTextoColado}
                  // O corretor do teclado destroi horario: "Seg" vira "Set",
                  // "Ter" vira "Tee" e "Fisica" vira outra palavra. Nome de
                  // materia e abreviacao de dia nao sao portugues nem ingles —
                  // sao codigo da escola, e corrigir isso e sempre errado.
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Ex: Segunda 08:00 - 10:00 Cálculo 1..."
                  placeholderTextColor={cores.textoFraco}
                />
                <Botao texto={t('grade.previa_titulo')} aoTocar={analisarTextoColado} />
                <Botao
                  texto={t('acao.cancelar')}
                  variante="vazado"
                  aoTocar={() => setModalColarVisivel(false)}
                />
              </Secao>
            ) : (
              <Secao titulo={t('grade.previa_titulo')}>
                <Cartao>
                  <Titulo>{t('grade.aulas_encontradas', { n: previaImportacao.aulas.length })}</Titulo>
                  <Apoio>
                    {previaImportacao.materias.join(', ')}
                  </Apoio>
                </Cartao>

                {previaImportacao.ignoradas.length > 0 ? (
                  <View style={{ gap: espaco.xs }}>
                    <Text style={fonte.secao}>
                      {t('grade.linhas_nao_entendidas', { n: previaImportacao.ignoradas.length })}
                    </Text>
                    {previaImportacao.ignoradas.map((linha: string, idx: number) => (
                      <Apoio key={idx}>• {linha}</Apoio>
                    ))}
                  </View>
                ) : null}

                <Botao texto={t('grade.confirmar_importacao')} aoTocar={confirmarImportacao} />
                <Botao
                  texto={t('grade.limpar')}
                  variante="vazado"
                  aoTocar={() => setPreviaImportacao(null)}
                />
                <Botao
                  texto={t('acao.cancelar')}
                  variante="discreto"
                  aoTocar={() => setModalColarVisivel(false)}
                />
              </Secao>
            )}
          </ScrollView>
        </View>
      </Modal>
    </Tela>
  )
}

const e = StyleSheet.create({
  gradeContainer: { flexDirection: 'row', gap: espaco.m, paddingVertical: espaco.s },
  colunaDia: { width: 220, gap: espaco.s },
  listaBlocos: { gap: espaco.s },
  botaoVazioDia: {
    padding: espaco.m,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: cores.borda,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  modalConteudo: { flex: 1, backgroundColor: cores.fundo, padding: espaco.g },
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
  inputMultilinha: { height: 160, textAlignVertical: 'top' },
  listaPilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s },
  pilula: {
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.s,
    borderRadius: raio.pilula,
    backgroundColor: cores.cartaoAlto,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  pilulaSelecionada: { backgroundColor: cores.giz },
  pilulaAdicionar: { borderStyle: 'dashed' },
  textoPilula: { fontSize: 13, color: cores.texto },
  linhaCores: { flexDirection: 'row', gap: espaco.s, paddingVertical: espaco.xs },
  circuloCor: { width: 32, height: 32, borderRadius: 16 },
  circuloCorSelecionado: { borderWidth: 3, borderColor: cores.texto },
})
