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
import { LOCALE_DO_IDIOMA } from '../../../nucleo/modelo.ts'
import { CORES_DE_MATERIA, cores, espaco, fonte, raio } from '../tema.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarIdioma, usarT } from '../i18n.ts'
import type { ChaveI18n } from '../../../nucleo/i18n.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import type { ResultadoImportacao } from '../../../nucleo/importarGrade.ts'
import { importarGrade } from '../../../nucleo/importarGrade.ts'
import {
  Apoio,
  Bolinha,
  Botao,
  Fileira,
  Cartao,
  Pilula,
  Toque,
  Etiqueta,
  Linha,
  Secao,
  Tela,
  Titulo,
  Vazio,
} from '../componentes/ui.tsx'
import { TiraDeMaterias } from '../componentes/TiraDeMaterias.tsx'
import { SeletorDeData } from '../componentes/SeletorDeData.tsx'
import { lerPapel, temLeitura } from '../lerPapel.ts'

/** Semestre que contem hoje: fevereiro a julho, ou agosto a dezembro. */
function periodoPadrao(agora: Date): { nome: string; inicio: string; fim: string } {
  const ano = agora.getFullYear()
  const primeiro = agora.getMonth() < 6
  return primeiro
    ? { nome: `${ano}.1`, inicio: `${ano}-02-01`, fim: `${ano}-07-15` }
    : { nome: `${ano}.2`, inicio: `${ano}-08-01`, fim: `${ano}-12-20` }
}

export function Grade({ aoAbrirMateria }: { aoAbrirMateria: (id: string) => void }) {
  const t = usarT()
  const idioma = usarIdioma()
  const base = usarLoja((e) => e.base)
  const guardar = usarLoja((e) => e.guardar)
  const remover = usarLoja((e) => e.remover)

  const periodo = periodoAtivo(base)
  const [criandoPeriodo, setCriandoPeriodo] = useState(false)

  /**
   * O id do período letivo, criando um padrão se ainda não houver.
   *
   * Matéria precisa pertencer a um período — é o que amarra feriado e semana
   * alternada. Mas exigir que a pessoa preencha nome e duas datas de semestre
   * ANTES de poder anotar que tem matemática na terça é pedir a burocracia antes
   * do valor. O padrão cobre o ano corrente e ela ajusta depois, se quiser.
   */
  function garantirPeriodo(): string {
    if (periodo) return periodo.id
    const ano = new Date().getFullYear()
    return guardar('periodos', {
      nome: String(ano),
      inicio: `${ano}-01-01`,
      fim: `${ano}-12-31`,
      feriados: [],
      ativo: true,
    })
  }

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
  /** Qual dia a lista mostra. Separado de `diaSemana`, que é o dia do formulário. */
  const [diaVisivel, setDiaVisivel] = useState<DiaSemana>(1)
  const [inicio, setInicio] = useState('08:00')
  const [fim, setFim] = useState('09:40')
  const [sala, setSala] = useState('')
  const [semana, setSemana] = useState<SemanaAlternada>('toda')

  // Modal de colar horário
  const [modalColarVisivel, setModalColarVisivel] = useState(false)
  const [textoColado, setTextoColado] = useState('')
  const [lendoFoto, setLendoFoto] = useState(false)

  /**
   * Fotografar o horário e cair no MESMO campo do texto colado.
   *
   * O texto lido não vira grade sozinho: ele entra no campo, e a pessoa toca em
   * prévia como se tivesse colado. O OCR acerta muito e não sempre, e o estrago
   * de gravar errado é uma grade inteira bagunçada.
   */
  const fotografarHorario = async (de: 'camera' | 'galeria' = 'camera') => {
    setLendoFoto(true)
    try {
      const r = await lerPapel(de)
      if (r.tipo === 'lido') setTextoColado(r.texto)
    } finally {
      setLendoFoto(false)
    }
  }
  const [previaImportacao, setPreviaImportacao] = useState<ResultadoImportacao | null>(null)

  // O período letivo é OPCIONAL. Ele serve para uma coisa só — saber quais dias
  // são feriado e quando o semestre acaba — e o app funciona sem: aula na terça
  // continua sendo aula na terça.
  //
  // Antes esta tela era um muro: sem período, não deixava cadastrar aula nenhuma.
  // Quem só queria anotar o horário tinha que preencher nome, data de início e
  // data de fim de um semestre para chegar lá.
  if (!periodo && criandoPeriodo) {
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
        {/* Sem repetir o título numa seção logo abaixo dele: a tela dizia
            "Criar período letivo" duas vezes, uma grande e uma pequena. */}
        <Apoio>{t('grade.sem_periodo_desc')}</Apoio>
        <Cartao>
          <View style={e.campo}>
            <Text style={fonte.secao}>{t('grade.nome_periodo')}</Text>
            <TextInput
              style={e.input}
              value={nomePeriodo}
              onChangeText={setNomePeriodo}
              placeholderTextColor={cores.texto4}
            />
          </View>
        </Cartao>

        {/* Datas pelo calendário do sistema, e não digitadas. Aqui era o mesmo
            `AAAA-MM-DD` que já saiu da tela de nova tarefa — e é onde a correção
            automática do iPhone estraga o texto sem ninguém perceber. */}
        <Secao titulo={t('grade.inicio_periodo')}>
          <SeletorDeData
            data={inicioPeriodo}
            hora="08:00"
            locale={LOCALE_DO_IDIOMA[idioma]}
            rotuloData={t('grade.inicio_periodo')}
            rotuloHora={t('novo_compromisso.hora')}
            aoMudar={(d) => setInicioPeriodo(d)}
          />
        </Secao>
        <Secao titulo={t('grade.fim_periodo')}>
          <SeletorDeData
            data={fimPeriodo}
            hora="23:59"
            locale={LOCALE_DO_IDIOMA[idioma]}
            rotuloData={t('grade.fim_periodo')}
            rotuloHora={t('novo_compromisso.hora')}
            aoMudar={(d) => setFimPeriodo(d)}
          />
        </Secao>
        <Botao texto={t('grade.criar_periodo')} aoTocar={handleCriarPeriodo} />
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
  const aulasDoDiaVisivel = aulasVivas
    .filter((a: Aula) => a.diaSemana === diaVisivel)
    .sort((a: Aula, b: Aula) => a.inicio.localeCompare(b.inicio))

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
        periodoId: garantirPeriodo(),
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
      <TiraDeMaterias aoAbrir={aoAbrirMateria} />
      {/* Escanear é a primeira opção, e é um botão próprio: fotografar o horário
          que a escola entregou é o caminho mais rápido de todos, e ele estava
          escondido dentro do modal de colar texto — onde ninguém ia achar. */}
      <Fileira>
        {temLeitura() ? (
          <Botao
            texto={t('grade.escanear')}
            variante="cheio"
            aoTocar={() => void fotografarHorario('camera')}
          />
        ) : null}
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
          variante="vazado"
          aoTocar={() => abrirCriacaoAula(diaVisivel)}
        />
      </Fileira>

      {aulasVivas.length === 0 ? (
        <Vazio texto={t('grade.sem_aulas')} />
      ) : (
        <View style={{ gap: espaco.g }}>
          {/* Abas de dia. Antes a grade rolava na horizontal, uma coluna por
              dia: num telefone isso esconde metade da semana fora da tela e
              obriga a arrastar para descobrir que existe sexta. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: espaco.s, paddingRight: espaco.g }}
          >
            {diasParaExibir.map((dia: DiaSemana) => (
              <Pilula
                key={dia}
                texto={t(`dia.abrev.${dia}` as ChaveI18n)}
                ativa={dia === diaVisivel}
                aoTocar={() => setDiaVisivel(dia)}
              />
            ))}
          </ScrollView>

          <View style={{ gap: espaco.m }}>
            {aulasDoDiaVisivel.length === 0 ? (
              <Vazio texto={t('hoje.sem_aulas')} />
            ) : (
              aulasDoDiaVisivel.map((aula: Aula) => {
                const materia = mapaMaterias[aula.materiaId]
                return (
                  <Toque key={aula.id} aoTocar={() => abrirEdicaoAula(aula)} estilo={e.linhaAula}>
                    <View style={e.horaAula}>
                      <Text style={e.horaInicio}>{aula.inicio}</Text>
                      <Text style={e.horaFim}>{aula.fim}</Text>
                    </View>
                    <Bolinha cor={materia?.cor ?? cores.texto3} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Titulo>{materia?.nome ?? ''}</Titulo>
                      {aula.sala ? <Apoio>{aula.sala}</Apoio> : null}
                      {aula.semana !== 'toda' ? (
                        <Etiqueta texto={t(`grade.semana_${aula.semana}` as ChaveI18n)} />
                      ) : null}
                    </View>
                  </Toque>
                )
              })
            )}
            <Toque aoTocar={() => abrirCriacaoAula(diaVisivel)} estilo={e.botaoVazioDia}>
              <Text style={[fonte.apoio, { color: cores.texto3 }]}>
                + {t('grade.adicionar_aula')}
              </Text>
            </Toque>
          </View>
        </View>
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
                <Fileira>
                  {materiasVivas.map((m: Materia) => (
                    <Pilula
                      key={m.id}
                      texto={m.nome}
                      cor={m.cor}
                      ativa={materiaId === m.id}
                      aoTocar={() => setMateriaId(m.id)}
                    />
                  ))}
                  <Pilula
                    texto={`+ ${t('grade.nova_materia')}`}
                    aoTocar={() => {
                      setCriandoNovaMateria(true)
                      setMateriaId('')
                    }}
                  />
                </Fileira>
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
              <Fileira>
                {([0, 1, 2, 3, 4, 5, 6] as DiaSemana[]).map((d: DiaSemana) => (
                  <Pilula
                    key={d}
                    texto={t(`dia.abrev.${d}` as ChaveI18n)}
                    ativa={diaSemana === d}
                    aoTocar={() => setDiaSemana(d)}
                  />
                ))}
              </Fileira>
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
              <Fileira>
                {(['toda', 'par', 'impar'] as SemanaAlternada[]).map((s: SemanaAlternada) => (
                  <Pilula
                    key={s}
                    texto={t(`grade.semana_${s}` as ChaveI18n)}
                    ativa={semana === s}
                    aoTocar={() => setSemana(s)}
                  />
                ))}
              </Fileira>
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
                {temLeitura() ? (
                  <Botao
                    texto={lendoFoto ? t('captura.lendo') : t('grade.tirar_foto')}
                    variante="vazado"
                    aoTocar={() => void fotografarHorario('camera')}
                  />
                ) : null}
                {temLeitura() ? (
                  <Botao
                    texto={t('papel.da_galeria')}
                    variante="vazado"
                    aoTocar={() => void fotografarHorario('galeria')}
                  />
                ) : null}
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
  linhaAula: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.m },
  horaAula: { minWidth: 46, paddingTop: 1 },
  horaInicio: { fontSize: 15, fontWeight: '600', color: cores.texto, fontVariant: ['tabular-nums'] },
  horaFim: { fontSize: 13, color: cores.texto3, fontVariant: ['tabular-nums'] },
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
  linhaCores: { flexDirection: 'row', gap: espaco.s, paddingVertical: espaco.xs },
  circuloCor: { width: 32, height: 32, borderRadius: 16 },
  circuloCorSelecionado: { borderWidth: 3, borderColor: cores.texto },
})
