import { useState } from 'react'
import {
  Alert,
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
import { CORES_DE_MATERIA, criarFonte, espaco, raio, usarCores, type Paleta } from '../tema.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarIdioma, usarT } from '../i18n.ts'
import type { ChaveI18n } from '../../../nucleo/i18n.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import type { AulaCrua, ResultadoImportacao } from '../../../nucleo/importarGrade.ts'
import {
  Apoio,
  Botao,
  Fileira,
  Cartao,
  Pilula,
  Linha,
  Secao,
  Tela,
  Titulo,
} from '../componentes/ui.tsx'
import { TiraDeMaterias } from '../componentes/TiraDeMaterias.tsx'
import { SeletorDeData } from '../componentes/SeletorDeData.tsx'
import { lerPapel, temLeitura } from '../lerPapel.ts'
import { analisarGrade } from '../resgatar.ts'
import { tabelaComoTexto } from '../../../nucleo/resgate.ts'
import { NOTA_MINIMA, qualidadeDaGrade } from '../../../nucleo/qualidadeDaGrade.ts'
import { estadoDoModelo } from '../../modules/modelo/src/index.ts'
import { comApelido, normalizar, resolverMateria } from '../../../nucleo/materias.ts'
import { enviarCorrecao } from '../treinar.ts'
import { SeletorDeHora } from '../componentes/SeletorDeHora.tsx'
import {
  faixasDeAulas,
  GradeSemanal,
  MESMA_FAIXA,
  mesclarFaixas,
  type CelulaOcupada,
  type FaixaHoraria,
  type OpcaoMateria,
} from '../componentes/GradeSemanal.tsx'

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
  const ajustes = usarLoja((s) => s.ajustes)
  const idioma = usarIdioma()
  const cores = usarCores()
  const fonte = criarFonte(cores)
  const e = criarEstilo(cores)
  const base = usarLoja((e) => e.base)
  const guardar = usarLoja((e) => e.guardar)
  const remover = usarLoja((e) => e.remover)
  const removerVarios = usarLoja((e) => e.removerVarios)

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
      if (r.tipo === 'lido') {
        // O campo mostra a GRADE quando ela existe, e não o texto achatado.
        //
        // Ele viu "SEXMAT MAT LPO LPO GEO GEO" no campo e concluiu, com razão,
        // que era isso que a IA recebia. Mostrar o que o modelo vê é o que
        // torna o erro corrigível: dá para consertar uma célula na mão.
        setTextoColado(r.tabela.length > 1 ? tabelaComoTexto(r.tabela) : r.texto)
        // A confiança do OCR fica guardada para a análise: é um dos sinais que
        // decidem chamar a IA, e ela só existe quando o texto veio de foto.
        setConfiancaDaFoto(r.confianca)
        setTabelaDaFoto(r.tabela)
        setUsouIa(false)
        setAvisoIa(null)
      }
    } finally {
      setLendoFoto(false)
    }
  }
  const [usouIa, setUsouIa] = useState(false)
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)
  const [avisoIa, setAvisoIa] = useState<string | null>(null)
  const [analisando, setAnalisando] = useState(false)
  /** 1 quando o texto não veio de foto: sem OCR não há confiança para medir. */
  const [confiancaDaFoto, setConfiancaDaFoto] = useState(1)
  /** A grade que o Vision viu na foto, quando viu. */
  const [tabelaDaFoto, setTabelaDaFoto] = useState<string[][]>([])
  const [previaImportacao, setPreviaImportacao] = useState<ResultadoImportacao | null>(null)
  /**
   * As linhas de horário da planilha que ainda não têm nenhuma aula.
   *
   * A grade em si não guarda "faixa de horário" — ela existe só implícita nas
   * aulas (`inicio`/`fim` de cada uma). Uma linha recém-criada na planilha,
   * sem aula nenhuma nela ainda, não sobreviveria a um novo render se não
   * ficasse guardada em algum lugar: é isto que este estado guarda.
   */
  const [faixasExtras, setFaixasExtras] = useState<FaixaHoraria[]>([])
  // A planilha de prévia (foto/colar) tem o MESMO mecanismo, mas em cima de um
  // estado local em vez da loja: nada aqui é real até "Confirmar e salvar".
  const [previaAulas, setPreviaAulas] = useState<AulaCrua[]>([])
  const [previaMateriasNomes, setPreviaMateriasNomes] = useState<string[]>([])
  const [previaFaixasExtras, setPreviaFaixasExtras] = useState<FaixaHoraria[]>([])

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

  const diasParaExibir: DiaSemana[] = [
    ...(temDomingo ? ([0] as DiaSemana[]) : []),
    1, 2, 3, 4, 5,
    ...(temSabado ? ([6] as DiaSemana[]) : []),
  ]

  // ─── A planilha da grade salva ──────────────────────────────────────────
  //
  // As linhas vêm dos horários que já existem nas aulas, mais as que a pessoa
  // acabou de criar e ainda não tocaram em nenhuma célula (`faixasExtras`).
  const faixasPrincipais = mesclarFaixas(faixasDeAulas(aulasVivas), faixasExtras)
  const opcoesMateriaPrincipal: OpcaoMateria[] = materiasVivas.map((m: Materia) => ({
    chave: m.id,
    nome: m.nome,
    cor: m.cor,
  }))

  function obterCelulaPrincipal(dia: DiaSemana, faixa: FaixaHoraria): CelulaOcupada | undefined {
    const aula = aulasVivas.find(
      (a: Aula) => a.diaSemana === dia && a.inicio === faixa.inicio && a.fim === faixa.fim,
    )
    if (!aula) return undefined
    const materia = mapaMaterias[aula.materiaId]
    return {
      chave: aula.id,
      nome: materia?.nome ?? '',
      cor: materia?.cor ?? cores.texto3,
      sub: aula.sala,
    }
  }

  function escolherMateriaPrincipal(dia: DiaSemana, faixa: FaixaHoraria, opcao: OpcaoMateria) {
    const existente = aulasVivas.find(
      (a: Aula) => a.diaSemana === dia && a.inicio === faixa.inicio && a.fim === faixa.fim,
    )
    if (existente) {
      guardar('aulas', { id: existente.id, materiaId: opcao.chave })
    } else {
      guardar('aulas', {
        materiaId: opcao.chave,
        diaSemana: dia,
        inicio: faixa.inicio,
        fim: faixa.fim,
        semana: 'toda',
      })
    }
    setFaixasExtras((prev) => prev.filter((f) => !MESMA_FAIXA(f, faixa)))
  }

  function limparCelulaPrincipal(dia: DiaSemana, faixa: FaixaHoraria) {
    const existente = aulasVivas.find(
      (a: Aula) => a.diaSemana === dia && a.inicio === faixa.inicio && a.fim === faixa.fim,
    )
    if (existente) remover('aulas', existente.id)
  }

  function criarMateriaPrincipal(nome: string, cor: string): OpcaoMateria {
    const id = guardar('materias', { periodoId: garantirPeriodo(), nome, cor, limiteFaltasPct: 25 })
    return { chave: id, nome, cor }
  }

  function abrirDetalhesPrincipal(chaveAula: string) {
    const aula = aulasVivas.find((a: Aula) => a.id === chaveAula)
    if (aula) abrirEdicaoAula(aula)
  }

  function salvarFaixaPrincipal(faixaAntiga: FaixaHoraria, novoInicio: string, novoFim: string) {
    for (const a of aulasVivas) {
      if (a.inicio === faixaAntiga.inicio && a.fim === faixaAntiga.fim) {
        guardar('aulas', { id: a.id, inicio: novoInicio, fim: novoFim })
      }
    }
    setFaixasExtras((prev) =>
      prev.map((f) => (MESMA_FAIXA(f, faixaAntiga) ? { inicio: novoInicio, fim: novoFim } : f)),
    )
  }

  function removerFaixaPrincipal(faixa: FaixaHoraria) {
    const afetadas = aulasVivas.filter(
      (a: Aula) => a.inicio === faixa.inicio && a.fim === faixa.fim,
    )
    if (afetadas.length === 0) {
      setFaixasExtras((prev) => prev.filter((f) => !MESMA_FAIXA(f, faixa)))
      return
    }
    // Linha com aula dentro é destrutivo, e em mais de um dia — o mesmo
    // cuidado de "apagar tudo", só que restrito a uma faixa de horário.
    Alert.alert(
      t('grade.remover_faixa_titulo'),
      t('grade.remover_faixa_texto', { n: afetadas.length }),
      [
        { text: t('acao.cancelar'), style: 'cancel' },
        {
          text: t('grade.remover_faixa'),
          style: 'destructive',
          onPress: () => {
            removerVarios(afetadas.map((a) => ({ tabela: 'aulas' as const, id: a.id })))
            setFaixasExtras((prev) => prev.filter((f) => !MESMA_FAIXA(f, faixa)))
          },
        },
      ],
    )
  }

  function adicionarFaixaPrincipal(inicioFaixa: string, fimFaixa: string) {
    setFaixasExtras((prev) =>
      prev.some((f) => f.inicio === inicioFaixa && f.fim === fimFaixa)
        ? prev
        : [...prev, { inicio: inicioFaixa, fim: fimFaixa }],
    )
  }

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

  // A nota de qualidade lê o estado EDITADO (`previaAulas`), não o resultado
  // cru da leitura: é o que faz o aviso de dúvida sumir na hora em que a
  // pessoa corrige a célula suspeita na planilha, em vez de continuar
  // reclamando de algo que ela já consertou.
  const qualidade = previaImportacao
    ? qualidadeDaGrade(previaAulas)
    : { nota: 1, suspeitas: [], aulas: 0 }

  /** Começa (ou recomeça) a prévia editável a partir de um resultado de leitura. */
  function iniciarPreviaEditavel(resultado: ResultadoImportacao) {
    setPreviaImportacao(resultado)
    setPreviaAulas(resultado.aulas)
    setPreviaMateriasNomes(resultado.materias)
    setPreviaFaixasExtras([])
  }

  function fecharPreviaEditavel() {
    setPreviaImportacao(null)
    setPreviaAulas([])
    setPreviaMateriasNomes([])
    setPreviaFaixasExtras([])
  }

  /** Refaz a leitura com o modelo, quando a regra deixou dúvida. */
  const analisarComModelo = async () => {
    setAnalisando(true)
    try {
      // Sem a tabela: forçar o caminho do modelo é justamente pular a regra que
      // acabou de produzir o resultado duvidoso.
      const a = await analisarGrade(textoColado, confiancaDaFoto, [])
      setUsouIa(a.usou)
      setAvisoIa(a.aviso)
      iniciarPreviaEditavel(a.resultado)
    } finally {
      setAnalisando(false)
    }
  }

  const analisarTextoColado = async () => {
    setAnalisando(true)
    try {
      // A IA entra AQUI, e não na hora da foto: assim o texto colado à mão
      // ganha o mesmo resgate, e a espera cai num momento em que a pessoa já
      // está esperando resposta.
      const a = await analisarGrade(textoColado, confiancaDaFoto, tabelaDaFoto)
      if (a.usou) setTextoColado(a.texto)
      setUsouIa(a.usou)
      setAvisoIa(a.aviso)
      iniciarPreviaEditavel(a.resultado)
    } finally {
      setAnalisando(false)
    }
  }

  // ─── A planilha da prévia (foto/colar) ──────────────────────────────────
  //
  // Mesmo mecanismo da planilha principal, só que em cima de `previaAulas` —
  // um estado local que só vira aula de verdade em "Confirmar e salvar". É
  // aqui que a pessoa CORRIGE o que o scanner leu, célula por célula, em vez
  // de aceitar ou rejeitar a leitura inteira no escuro.
  const faixasPrevia = mesclarFaixas(faixasDeAulas(previaAulas), previaFaixasExtras)
  // Sábado/domingo entram na prévia se a LEITURA trouxe aula nesses dias,
  // mesmo que a grade salva ainda não tenha nenhuma — senão a coluna some e a
  // aula lida ali fica sem onde aparecer.
  const diasParaExibirPrevia: DiaSemana[] = [
    ...(temDomingo || previaAulas.some((a) => a.diaSemana === 0) ? ([0] as DiaSemana[]) : []),
    1, 2, 3, 4, 5,
    ...(temSabado || previaAulas.some((a) => a.diaSemana === 6) ? ([6] as DiaSemana[]) : []),
  ]
  const nomesReaisEmMinusculo = new Set(
    materiasVivas.map((m: Materia) => m.nome.trim().toLowerCase()),
  )
  const opcoesMateriaPrevia: OpcaoMateria[] = [
    ...materiasVivas.map((m: Materia) => ({ chave: m.id, nome: m.nome, cor: m.cor })),
    ...previaMateriasNomes
      .filter((nome) => !nomesReaisEmMinusculo.has(nome.trim().toLowerCase()))
      .map((nome, i) => ({
        chave: `previa:${nome}`,
        nome,
        cor: CORES_DE_MATERIA[i % CORES_DE_MATERIA.length] ?? CORES_DE_MATERIA[0],
      })),
  ]

  function obterCelulaPrevia(dia: DiaSemana, faixa: FaixaHoraria): CelulaOcupada | undefined {
    const aula = previaAulas.find(
      (a) => a.diaSemana === dia && a.inicio === faixa.inicio && a.fim === faixa.fim,
    )
    if (!aula) return undefined
    const cor =
      opcoesMateriaPrevia.find(
        (op) => op.nome.trim().toLowerCase() === aula.materia.trim().toLowerCase(),
      )?.cor ?? cores.texto3
    return { chave: `${dia}|${faixa.inicio}|${faixa.fim}`, nome: aula.materia, cor, sub: aula.sala }
  }

  function escolherMateriaPrevia(dia: DiaSemana, faixa: FaixaHoraria, opcao: OpcaoMateria) {
    setPreviaAulas((prev) => {
      const existe = prev.some(
        (a) => a.diaSemana === dia && a.inicio === faixa.inicio && a.fim === faixa.fim,
      )
      if (existe) {
        return prev.map((a) =>
          a.diaSemana === dia && a.inicio === faixa.inicio && a.fim === faixa.fim
            ? { ...a, materia: opcao.nome, confianca: 1 }
            : a,
        )
      }
      return [
        ...prev,
        { materia: opcao.nome, diaSemana: dia, inicio: faixa.inicio, fim: faixa.fim, confianca: 1 },
      ]
    })
    setPreviaFaixasExtras((prev) => prev.filter((f) => !MESMA_FAIXA(f, faixa)))
    setPreviaMateriasNomes((prev) =>
      prev.some((n) => n.trim().toLowerCase() === opcao.nome.trim().toLowerCase())
        ? prev
        : [...prev, opcao.nome],
    )
  }

  function limparCelulaPrevia(dia: DiaSemana, faixa: FaixaHoraria) {
    setPreviaAulas((prev) =>
      prev.filter(
        (a) => !(a.diaSemana === dia && a.inicio === faixa.inicio && a.fim === faixa.fim),
      ),
    )
  }

  function criarMateriaPrevia(nome: string, cor: string): OpcaoMateria {
    setPreviaMateriasNomes((prev) =>
      prev.some((n) => n.trim().toLowerCase() === nome.trim().toLowerCase())
        ? prev
        : [...prev, nome],
    )
    return { chave: `previa:${nome}`, nome, cor }
  }

  function salvarFaixaPrevia(faixaAntiga: FaixaHoraria, novoInicio: string, novoFim: string) {
    setPreviaAulas((prev) =>
      prev.map((a) =>
        a.inicio === faixaAntiga.inicio && a.fim === faixaAntiga.fim
          ? { ...a, inicio: novoInicio, fim: novoFim }
          : a,
      ),
    )
    setPreviaFaixasExtras((prev) =>
      prev.map((f) => (MESMA_FAIXA(f, faixaAntiga) ? { inicio: novoInicio, fim: novoFim } : f)),
    )
  }

  function removerFaixaPrevia(faixa: FaixaHoraria) {
    const afetadas = previaAulas.filter((a) => a.inicio === faixa.inicio && a.fim === faixa.fim)
    if (afetadas.length === 0) {
      setPreviaFaixasExtras((prev) => prev.filter((f) => !MESMA_FAIXA(f, faixa)))
      return
    }
    Alert.alert(
      t('grade.remover_faixa_titulo'),
      t('grade.remover_faixa_texto', { n: afetadas.length }),
      [
        { text: t('acao.cancelar'), style: 'cancel' },
        {
          text: t('grade.remover_faixa'),
          style: 'destructive',
          onPress: () => {
            setPreviaAulas((prev) =>
              prev.filter((a) => !(a.inicio === faixa.inicio && a.fim === faixa.fim)),
            )
            setPreviaFaixasExtras((prev) => prev.filter((f) => !MESMA_FAIXA(f, faixa)))
          },
        },
      ],
    )
  }

  function adicionarFaixaPrevia(inicioFaixa: string, fimFaixa: string) {
    setPreviaFaixasExtras((prev) =>
      prev.some((f) => f.inicio === inicioFaixa && f.fim === fimFaixa)
        ? prev
        : [...prev, { inicio: inicioFaixa, fim: fimFaixa }],
    )
  }

  // Sigla curta que a resolução não achou candidato nenhum: "ALE" chegando de
  // um horário novo, sem parecido registrado. Pedido em 04/09/2026: em vez de
  // criar a matéria com esse nome cru, perguntar o que ela significa — e não
  // deixar a resposta ser a própria sigla ("ALE" pra "o que é ALE?" não vale).
  function pareceAbreviacaoDesconhecida(nome: string): boolean {
    const n = nome.trim()
    return n.length > 0 && n.length <= 4 && !/\s/.test(n)
  }

  function perguntarSignificado(abrev: string): Promise<string | null> {
    return new Promise((resolve) => {
      const pedir = () => {
        Alert.prompt(
          t('grade.pergunta_abreviacao_titulo', { abrev }),
          t('grade.pergunta_abreviacao_texto'),
          [
            { text: t('acao.pular'), style: 'cancel', onPress: () => resolve(null) },
            {
              text: t('acao.confirmar'),
              onPress: (resposta?: string) => {
                const limpo = (resposta ?? '').trim()
                if (!limpo || normalizar(limpo) === normalizar(abrev)) {
                  pedir()
                  return
                }
                resolve(limpo)
              },
            },
          ],
          'plain-text',
        )
      }
      pedir()
    })
  }

  const confirmarImportacao = async () => {
    // O período letivo NÃO entra na condição.
    //
    // Ele é opcional desde que a grade virou opcional, e este `return` mudo era
    // o "nem dá pra confirmar e salvar": quem não cadastrou semestre tocava em
    // Confirmar e nada acontecia — sem erro, sem aviso, sem nada. Falha calada
    // é o pior tipo, porque a pessoa conclui que o app está quebrado.
    if (!previaImportacao) return

    // Antes de criar qualquer matéria nova, pergunta pelas siglas curtas que
    // não bateram com nada — cadastrada OU do dicionário de gírias.
    const traducoes: Record<string, string> = {}
    for (const nomeMat of previaMateriasNomes) {
      if (!pareceAbreviacaoDesconhecida(nomeMat)) continue
      if (resolverMateria(nomeMat, base, idioma).tipo !== 'nova') continue
      const nomeReal = await perguntarSignificado(nomeMat)
      if (nomeReal) traducoes[nomeMat] = nomeReal
    }

    // Lê de `previaAulas`/`previaMateriasNomes` — o que a pessoa CORRIGIU na
    // planilha — e não do resultado cru de `previaImportacao`.
    //
    // A resolução usa `resolverMateria`: nome exato, apelido, abreviação por
    // pedaços/iniciais E o dicionário de gírias ("português" ↔ "LPO") — não
    // mais comparação de string crua, que criava matéria duplicada toda vez
    // que a sigla do horário não batia letra por letra com o nome cadastrado.
    const mapaNomesParaId: Record<string, string> = {}
    let corIndice = 0

    for (const nomeMat of previaMateriasNomes) {
      const nomeFinal = traducoes[nomeMat] ?? nomeMat
      const resolucao = resolverMateria(nomeFinal, base, idioma)
      if (resolucao.tipo === 'achou') {
        mapaNomesParaId[nomeMat] = resolucao.materia.id
        // Aprende com o uso, sem sair do aparelho: casou por dicionário ou
        // abreviação (não pelo nome exato) — guarda a sigla crua como apelido,
        // pra da próxima vez casar na hora, sem precisar do dicionário nem
        // perguntar de novo. É a "telemetria" que ele pediu em 04/09/2026,
        // do jeito que não contraria a política de privacidade: aprendizado
        // local, nada enviado a lugar nenhum.
        if (normalizar(resolucao.materia.nome) !== normalizar(nomeMat)) {
          const atualizada = comApelido(resolucao.materia, nomeMat)
          if (atualizada !== resolucao.materia) guardar('materias', atualizada)
          // A parte que SAI do aparelho é opt-in (Ajustes > ajudarATreinar) —
          // essa sigla → nome, se a pessoa topar, ajuda o dicionário de
          // `abreviacoesMaterias.ts` a crescer nas próximas versões. Sem o
          // toque, `enviarCorrecao` nem chega a montar a chamada de rede.
          enviarCorrecao('grade', nomeMat, resolucao.materia.nome)
        }
      } else {
        const cor = CORES_DE_MATERIA[corIndice % CORES_DE_MATERIA.length] ?? CORES_DE_MATERIA[0]
        corIndice++
        const novaId = guardar('materias', {
          periodoId: periodo?.id ?? '',
          nome: nomeFinal.trim(),
          cor,
          limiteFaltasPct: 25,
        })
        mapaNomesParaId[nomeMat] = novaId
      }
    }

    for (const aulaCrua of previaAulas) {
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
    fecharPreviaEditavel()
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
            fecharPreviaEditavel()
            setModalColarVisivel(true)
          }}
        />
        <Botao
          texto={t('grade.adicionar_aula')}
          variante="vazado"
          // O botão avançado: o formulário completo (dia, horário, sala,
          // semana alternada), para quem quer preencher tudo de uma vez em
          // vez de tocar célula por célula na planilha. Segunda-feira é só o
          // ponto de partida do formulário — o campo de dia continua ali.
          aoTocar={() => abrirCriacaoAula(diasParaExibir[0] ?? 1)}
        />
        {/* Apagar a grade inteira só aparece quando existe grade, e pede
            confirmação: é o único botão desta tela que destrói trabalho, e
            reescanear um horário custa fotografar de novo. */}
        {aulasVivas.length > 0 ? (
          <Botao
            texto={t('grade.apagar_tudo')}
            variante="discreto"
            aoTocar={() => setConfirmandoLimpeza(true)}
          />
        ) : null}
      </Fileira>

      <Modal
        visible={confirmandoLimpeza}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmandoLimpeza(false)}
      >
        <Pressable
          style={e.fundoDaConfirmacao}
          onPress={() => setConfirmandoLimpeza(false)}
        >
          <View style={e.caixaDaConfirmacao}>
            <Titulo>{t('grade.apagar_tudo_titulo')}</Titulo>
            <Apoio>{t('grade.apagar_tudo_texto', { n: aulasVivas.length })}</Apoio>
            <Botao
              texto={t('grade.apagar_tudo')}
              aoTocar={() => {
                // Remoção LÓGICA: o registro vira lápide e o sync leva a
                // remoção junto. Apagar do armazenamento faria a aula voltar do
                // outro aparelho na próxima sincronização.
                //
                // UMA chamada, não uma por aula: cada `remover` isolado troca a
                // `base` inteira e dispara uma sincronização de avisos
                // completa — uma grade de trinta aulas travava a tela por
                // vários segundos, sem responder a toque nenhum. Medido em
                // 04/09/2026, é o "app buga todo" que ele reportou.
                removerVarios(aulasVivas.map((a) => ({ tabela: 'aulas' as const, id: a.id })))
                setConfirmandoLimpeza(false)
              }}
            />
            <Botao
              texto={t('acao.cancelar')}
              variante="vazado"
              aoTocar={() => setConfirmandoLimpeza(false)}
            />
          </View>
        </Pressable>
      </Modal>

      {/* A grade em forma de planilha: colunas são os dias, linhas são os
          horários, e cada célula toca para escolher a matéria. É o pedido
          dele — "meio que um Excel" — no lugar do texto colado e do
          formulário de uma aula por vez, que ninguém enxergava como semana. */}
      <GradeSemanal
        dias={diasParaExibir}
        faixas={faixasPrincipais}
        obterCelula={obterCelulaPrincipal}
        materiasDisponiveis={opcoesMateriaPrincipal}
        aoEscolherMateria={escolherMateriaPrincipal}
        aoLimparCelula={limparCelulaPrincipal}
        aoCriarMateria={criarMateriaPrincipal}
        aoAbrirDetalhes={abrirDetalhesPrincipal}
        aoSalvarFaixa={salvarFaixaPrincipal}
        aoRemoverFaixa={removerFaixaPrincipal}
        aoAdicionarFaixa={adicionarFaixaPrincipal}
      />

      {/* Modal de Edição / Criação de Aula */}
      <Modal
        visible={modalAulaVisivel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalAulaVisivel(false)}
      >
        <View style={e.modalConteudo}>
          {/* Sem isto, tocar num botão logo depois de escrever num campo
              só fecha o teclado, e o botão só reage no segundo toque. */}
          <ScrollView contentContainerStyle={{ gap: espaco.m }} keyboardShouldPersistTaps="handled">
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
              <SeletorDeHora rotulo={t('grade.hora_inicio')} valor={inicio} aoMudar={setInicio} />
              <SeletorDeHora rotulo={t('grade.hora_fim')} valor={fim} aoMudar={setFim} />
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
            {/* Semana alternada só aparece para quem tem escola com semana
                A/B. Ele olhou a tela e perguntou o que era — controle que a
                pessoa não entende é pior que controle que não existe, e a
                imensa maioria das escolas tem a mesma grade toda semana. */}
            {ajustes.recursos.semanaAlternada ? (
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
            ) : null}

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
          {/* Sem isto, tocar num botão logo depois de escrever num campo
              só fecha o teclado, e o botão só reage no segundo toque. */}
          <ScrollView contentContainerStyle={{ gap: espaco.m }} keyboardShouldPersistTaps="handled">
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
                  placeholder={t('grade.colar_exemplo')}
                  placeholderTextColor={cores.textoFraco}
                />
                {usouIa ? <Text style={e.ajuda}>{t('resgate.usou')}</Text> : null}
                {avisoIa ? <Text style={e.ajuda}>{t(avisoIa as ChaveI18n)}</Text> : null}
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
                <Botao
                  texto={analisando ? t('resgate.pensando') : t('grade.previa_titulo')}
                  aoTocar={() => void analisarTextoColado()}
                />
                <Botao
                  texto={t('acao.cancelar')}
                  variante="vazado"
                  aoTocar={() => setModalColarVisivel(false)}
                />
              </Secao>
            ) : (
              <Secao titulo={t('grade.previa_titulo')}>
                <Cartao>
                  <Titulo>{t('grade.aulas_encontradas', { n: previaAulas.length })}</Titulo>
                  <Apoio>{previaMateriasNomes.join(', ')}</Apoio>
                  {/* Quem leu isto: a IA ou o algoritmo. Sem dizer, uma leitura
                      ruim parece defeito do app em vez de limite do método. */}
                  <Apoio cor={usouIa ? cores.ok : cores.texto3}>
                    {usouIa
                      ? t('resgate.leu_ia')
                      : previaImportacao.formato === 'tabela'
                        ? t('resgate.leu_tabela')
                        : t('resgate.leu_algoritmo')}
                  </Apoio>
                  {avisoIa ? <Apoio cor={cores.aviso}>{t(avisoIa as ChaveI18n)}</Apoio> : null}
                </Cartao>

                {/* A MESMA planilha da tela principal, só que sobre o estado
                    local da prévia: aqui é onde a leitura da foto/colagem se
                    confere e se corrige, célula por célula, em vez de aceitar
                    ou rejeitar a leitura inteira no escuro. */}
                <GradeSemanal
                  dias={diasParaExibirPrevia}
                  faixas={faixasPrevia}
                  obterCelula={obterCelulaPrevia}
                  materiasDisponiveis={opcoesMateriaPrevia}
                  aoEscolherMateria={escolherMateriaPrevia}
                  aoLimparCelula={limparCelulaPrevia}
                  aoCriarMateria={criarMateriaPrevia}
                  aoSalvarFaixa={salvarFaixaPrevia}
                  aoRemoverFaixa={removerFaixaPrevia}
                  aoAdicionarFaixa={adicionarFaixaPrevia}
                />

                {/* O app dizendo que NÃO está confiante.
                    
                    Ideia dele, e ela resolve o problema certo: não dá para
                    garantir leitura perfeita em toda escola do mundo, e gravar
                    quinze aulas erradas com cara de certeza é pior do que
                    admitir a dúvida. Aqui ele vê o que ficou suspeito e escolhe
                    o que fazer — inclusive não usar. */}
                {qualidade.nota < NOTA_MINIMA ? (
                  <Cartao alerta={cores.aviso}>
                    <Titulo>{t('grade.duvida_titulo')}</Titulo>
                    <Apoio>{t('grade.duvida_texto')}</Apoio>
                    {qualidade.suspeitas.slice(0, 4).map((sus, i) => (
                      <Apoio key={i} cor={cores.aviso}>
                        • {t(`grade.suspeita.${sus.tipo}` as ChaveI18n, { onde: sus.onde })}
                      </Apoio>
                    ))}
                    {estadoDoModelo() === 'pronto' ? (
                      <Botao
                        texto={analisando ? t('resgate.pensando') : t('grade.duvida_tentar_ia')}
                        variante="vazado"
                        aoTocar={() => void analisarComModelo()}
                      />
                    ) : (
                      // A IA local do iPhone é a Apple Intelligence, e ela é um
                      // download de alguns gigas que a pessoa liga nos Ajustes
                      // do sistema. É exatamente a opção que ele descreveu — e
                      // é honesto dizer onde ela mora em vez de fingir que o
                      // app baixa um modelo próprio.
                      <Apoio cor={cores.texto3}>{t('grade.duvida_sem_ia')}</Apoio>
                    )}
                    <Botao
                      texto={t('grade.duvida_corrigir')}
                      variante="vazado"
                      aoTocar={fecharPreviaEditavel}
                    />
                  </Cartao>
                ) : null}

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
                <Botao texto={t('grade.limpar')} variante="vazado" aoTocar={fecharPreviaEditavel} />
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

function criarEstilo(cores: Paleta) {
  return StyleSheet.create({
  fundoDaConfirmacao: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: espaco.g,
  },
  caixaDaConfirmacao: {
    // Opaco: a caixa flutua sobre a tela e não tem preto por baixo para se
    // apoiar. Mesma lição da folha da roda e do cartão do arrastar.
    backgroundColor: cores.fundoElevado,
    borderRadius: raio.g,
    padding: espaco.g,
    gap: espaco.m,
  },
  // O aviso de que a IA do aparelho encostou no texto. Discreto, mas presente:
  // texto que muda sozinho sem explicacao faz a pessoa desconfiar do app todo.
  ajuda: { color: cores.textoFraco, fontSize: 13, marginTop: espaco.s, lineHeight: 18 },
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
}
