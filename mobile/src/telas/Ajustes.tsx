import { useEffect, useState } from 'react'
import { Alert, Modal, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'
import type { ChaveI18n } from '../../../nucleo/i18n.ts'
import {
  IDIOMAS,
  NOME_DO_IDIOMA,
  TIPOS_COMPROMISSO,
  type ModoAviso,
  type RegraAviso,
  type TipoCompromisso,
} from '../../../nucleo/modelo.ts'
import { dataDe } from '../../../nucleo/tempo.ts'
import { criarId } from '../../../nucleo/sync/registro.ts'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import { vivos, type Registro } from '../../../nucleo/sync/registro.ts'
import { planejar } from '../../../nucleo/planejador.ts'
import { NIVEIS, avisosPorIntensidade, intensidadeDe } from '../../../nucleo/intensidade.ts'
import {
  Apoio,
  Botao,
  Cartao,
  Fileira,
  Grupo,
  Linha,
  LinhaDeMenu,
  Pilula,
  Secao,
  Tela,
  Titulo,
  Vazio,
} from '../componentes/ui.tsx'
import { isLiquidGlassAvailable } from 'expo-glass-effect'
import { ImportarCalendario } from './ImportarCalendario.tsx'
import { rotuloDeRegra } from '../formato.ts'
import { usarLoja } from '../estado/loja.ts'
import { estadoDaNuvem, motivoDaNuvem } from '../sync.ts'
import { idiomaDoSistema, usarT } from '../i18n.ts'
import { cores, espaco, fonte, raio } from '../tema.ts'
import {
  estadoDoAlarme,
  pedirPermissaoDeAlarme,
  type EstadoDoAlarme,
} from '../../modules/alarme/src/index.ts'
import {
  importarSom,
  ouvirSom,
  pararSom,
  removerSom,
  rotuloDoSom,
  sonsImportados,
} from 'som-do-alarme'
import { estadoDoModelo } from '../../modules/modelo/src/index.ts'
import { ouvirSomDoAppUmaVez, pararAlarme } from '../avisos/alarme.ts'
import { SONS_DO_APP } from '../avisos/sons.ts'
import { SeletorDeHora } from '../componentes/SeletorDeHora.tsx'
import { VERSAO } from '../versao.ts'

function Campo({
  rotulo,
  valor,
  aoMudar,
  teclado,
  aoBlur,
  placeholder,
}: {
  /** Sem rótulo o campo desenha só a caixa — para linhas que já têm o nome. */
  rotulo?: string
  valor: string
  aoMudar: (v: string) => void
  teclado?: 'numeric' | 'default'
  aoBlur?: () => void
  placeholder?: string
}) {
  return (
    <View style={{ gap: espaco.xs, flex: rotulo ? 1 : undefined }}>
      {rotulo ? <Apoio>{rotulo}</Apoio> : null}
      <TextInput
        style={estilo.campo}
        value={valor}
        onChangeText={aoMudar}
        onBlur={aoBlur}
        keyboardType={teclado ?? 'default'}
        // Campo numerico e de data nao aceitam correcao do teclado: ela troca
        // o valor por outra palavra e o usuario so descobre depois de salvar.
        selectTextOnFocus={teclado === 'numeric'}
        autoCorrect={teclado !== 'numeric'}
        autoCapitalize={teclado === 'numeric' ? 'none' : 'sentences'}
        placeholder={placeholder}
        placeholderTextColor={cores.textoFraco}
      />
    </View>
  )
}

function numero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

/** Ajustes para cada regra é controlado por índice; este componente edita uma só. */
function RegraLinha({
  regra,
  aoMudar,
  aoRemover,
}: {
  regra: RegraAviso
  aoMudar: (r: RegraAviso) => void
  aoRemover: () => void
}) {
  const t = usarT()
  const modos: ModoAviso[] = ['normal', 'insistente', 'alarme']

  function mudarModo(modo: ModoAviso) {
    aoMudar({ ...regra, modo })
  }
  function mudarNumero(n: number, campo: 'dias' | 'minutos' | 'horas') {
    if (regra.quando.tipo === 'diasAntes' && campo === 'dias') {
      aoMudar({ ...regra, quando: { ...regra.quando, dias: Math.max(0, n) } })
    } else if (regra.quando.tipo === 'antesDe' && campo === 'minutos') {
      aoMudar({ ...regra, quando: { ...regra.quando, minutos: Math.max(0, n) } })
    } else if (regra.quando.tipo === 'antesDaPrimeiraAula' && campo === 'horas') {
      // Zero hora antes da primeira aula e o proprio comeco da aula, e ai nao da
      // mais para fazer nada — o minimo util e uma hora.
      aoMudar({ ...regra, quando: { ...regra.quando, horas: Math.max(1, n) } })
    }
  }
  function mudarHora(hora: string) {
    if (regra.quando.tipo !== 'diasAntes') return
    aoMudar({ ...regra, quando: { ...regra.quando, aHora: hora } })
  }

  return (
    <Cartao>
      <Linha entre>
        <Titulo>{descricaoDaRegra(regra, t)}</Titulo>
        <Botao texto={t('ajustes.remover')} variante="discreto" aoTocar={aoRemover} />
      </Linha>
      <View style={{ gap: espaco.s, marginTop: espaco.xs }}>
        {regra.quando.tipo === 'diasAntes' ? (
          <Linha>
            <CampoNumero
              rotulo={t('ajustes.dias_antes')}
              valor={regra.quando.dias}
              aoConfirmar={(n) => mudarNumero(n, 'dias')}
            />
            <CampoHora rotulo={t('ajustes.hora')} valor={regra.quando.aHora} aoMudar={mudarHora} />
          </Linha>
        ) : regra.quando.tipo === 'antesDaPrimeiraAula' ? (
          <CampoNumero
            rotulo={t('avisos.horas_antes_aula_qtd')}
            valor={regra.quando.horas}
            aoConfirmar={(n) => mudarNumero(n, 'horas')}
          />
        ) : (
          <CampoNumero
            rotulo={t('ajustes.minutos_antes')}
            valor={regra.quando.minutos}
            aoConfirmar={(n) => mudarNumero(n, 'minutos')}
          />
        )}
      </View>
      <View style={{ gap: espaco.xs, marginTop: espaco.s }}>
        <Apoio>{t('ajustes.modo')}</Apoio>
        <Fileira>
          {modos.map((m) => (
            <Pilula
              key={m}
              texto={t(`avisos.modo.${m}` as ChaveI18n)}
              ativa={m === regra.modo}
              aoTocar={() => mudarModo(m)}
            />
          ))}
        </Fileira>
        {/* A explicação do alarme é longa e não pode ser cortada: é onde o app
            diz o que consegue e o que não consegue com o telefone no silencioso. */}
        <Apoio>{t(`avisos.expl.${regra.modo}` as ChaveI18n)}</Apoio>
      </View>
    </Cartao>
  )
}

function descricaoDaRegra(regra: RegraAviso, t: ReturnType<typeof usarT>): string {
  return rotuloDeRegra(regra, t)
}

function CampoNumero({
  rotulo,
  valor,
  aoConfirmar,
}: {
  /** Opcional: numa linha que já tem rótulo à esquerda, repetir é ruído. */
  rotulo?: string
  valor: number
  aoConfirmar: (n: number) => void
}) {
  const [txt, setTxt] = useState(String(valor))
  useEffect(() => setTxt(String(valor)), [valor])
  return (
    <Campo
      rotulo={rotulo}
      valor={txt}
      aoMudar={setTxt}
      teclado="numeric"
      aoBlur={() => {
        const n = Number(txt)
        if (Number.isFinite(n)) aoConfirmar(n)
        else setTxt(String(valor))
      }}
    />
  )
}

/**
 * A hora do aviso, na roda do sistema.
 *
 * Era um campo de texto com uma validação `\d{1,2}:\d{2}` — que aceita "9:5" e,
 * pior, assume 24h num telefone que pode estar em 12h. Ver `SeletorDeHora`.
 */
function CampoHora({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string
  valor: string
  aoMudar: (h: string) => void
}) {
  return <SeletorDeHora rotulo={rotulo} valor={valor} aoMudar={aoMudar} />
}

/**
 * As sete categorias da raiz — o mesmo desenho dos Ajustes do iPhone: uma
 * lista curta na raiz, cada linha abrindo a própria tela.
 *
 * "dados" é a zona de risco. Ela continua a última e com o título tingido de
 * aviso, mas agora é uma categoria como as outras — antes era um botão solto
 * no meio da rolagem infinita, que é justamente o problema que esta tela
 * resolve.
 */
type Categoria = 'perfil' | 'recursos' | 'avisos' | 'alarme' | 'escola' | 'sobre' | 'dados'

/**
 * O selo de cada categoria — formas geométricas simples, no mesmo espírito dos
 * ícones da barra de abas em `Raiz.tsx`.
 *
 * Sem biblioteca de ícones de propósito: Lucide em tudo é um dos sinais mais
 * confiáveis de tela gerada, e sete formas não justificam uma dependência.
 */
function Selo({ tipo, perigo }: { tipo: Categoria; perigo?: boolean }) {
  const cor = perigo ? cores.aviso : cores.texto
  return (
    <View style={[estilo.selo, perigo ? { backgroundColor: `${cores.aviso}1F` } : null]}>
      <Glifo tipo={tipo} cor={cor} />
    </View>
  )
}

function Glifo({ tipo, cor }: { tipo: Categoria; cor: string }) {
  switch (tipo) {
    case 'perfil':
      return (
        <View style={{ alignItems: 'center', gap: 1 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor }} />
          <View
            style={{
              width: 14,
              height: 7,
              borderTopLeftRadius: 7,
              borderTopRightRadius: 7,
              backgroundColor: cor,
            }}
          />
        </View>
      )
    case 'recursos':
      return (
        <View style={{ gap: 3 }}>
          {[14, 8, 11].map((l, i) => (
            <View key={i} style={{ height: 2, width: l, borderRadius: 1, backgroundColor: cor }} />
          ))}
        </View>
      )
    case 'avisos':
      return (
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 13,
              height: 10,
              borderWidth: 1.6,
              borderColor: cor,
              borderBottomWidth: 0,
              borderTopLeftRadius: 7,
              borderTopRightRadius: 7,
            }}
          />
          <View style={{ width: 15, height: 1.6, backgroundColor: cor, marginTop: 1, borderRadius: 1 }} />
        </View>
      )
    case 'alarme':
      return (
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 1.6,
            borderColor: cor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{ position: 'absolute', width: 1.6, height: 5, top: 2.6, backgroundColor: cor, borderRadius: 1 }}
          />
          <View
            style={{ position: 'absolute', width: 4, height: 1.6, left: 7.4, top: 6.8, backgroundColor: cor, borderRadius: 1 }}
          />
        </View>
      )
    case 'escola':
      return (
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 8,
              borderRightWidth: 8,
              borderBottomWidth: 6,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: cor,
            }}
          />
          <View style={{ width: 14, height: 6, backgroundColor: cor, marginTop: 1, borderRadius: 1 }} />
        </View>
      )
    case 'sobre':
      return (
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 1.6,
            borderColor: cor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: cor, marginBottom: 1 }} />
          <View style={{ width: 2, height: 6, backgroundColor: cor, borderRadius: 1 }} />
        </View>
      )
    case 'dados':
      return (
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 12, height: 2, backgroundColor: cor, borderRadius: 1 }} />
          <View
            style={{
              width: 10,
              height: 10,
              marginTop: 1,
              borderWidth: 1.6,
              borderTopWidth: 0,
              borderColor: cor,
              borderBottomLeftRadius: 2,
              borderBottomRightRadius: 2,
            }}
          />
        </View>
      )
  }
}

/** Uma linha de categoria na raiz: selo, título, resumo do estado, seta. */
function LinhaCategoria({
  tipo,
  titulo,
  valor,
  perigo,
  aoTocar,
}: {
  tipo: Categoria
  titulo: string
  valor?: string
  perigo?: boolean
  aoTocar: () => void
}) {
  return (
    <LinhaDeMenu
      titulo={titulo}
      valor={valor}
      perigo={perigo}
      icone={<Selo tipo={tipo} perigo={perigo} />}
      aoTocar={aoTocar}
    />
  )
}

/**
 * O resumo de Recursos na raiz: os nomes dos que estão ligados, separados por
 * vírgula — é o "Som > Sino" do iOS, e evita entrar na categoria só para
 * conferir o que está ativo.
 */
function resumoRecursos(
  t: ReturnType<typeof usarT>,
  recursos: { grade: boolean; notas: boolean; semanaAlternada: boolean },
): string {
  const nomes: string[] = []
  if (recursos.grade) nomes.push(t('ajustes.recurso_grade'))
  if (recursos.notas) nomes.push(t('ajustes.recurso_notas'))
  if (recursos.grade && recursos.semanaAlternada) nomes.push(t('ajustes.recurso_semana'))
  return nomes.length > 0 ? nomes.join(', ') : t('ajustes.recurso_nenhum')
}

/**
 * O resumo de Avisos na raiz: quando os seis tipos estão no mesmo nível, esse
 * nível; quando divergem, "Personalizado" — a mesma palavra que a folha de
 * cada tipo já usa para o mesmo caso.
 */
function resumoAvisos(
  t: ReturnType<typeof usarT>,
  padroesAviso: Record<string, RegraAviso[] | undefined>,
): string {
  const niveis = TIPOS_COMPROMISSO.map((tipo) => intensidadeDe(tipo, padroesAviso[tipo] ?? []))
  const iguais = niveis.every((n) => n === niveis[0])
  return t(`ajustes.nivel.${iguais ? niveis[0] : 'personalizado'}` as ChaveI18n)
}

/** O resumo de Alarme na raiz: o nome do som escolhido, ou "Padrão do iPhone". */
function rotuloSomAtual(t: ReturnType<typeof usarT>, somAlarme: string | null): string {
  if (!somAlarme) return t('ajustes.som_padrao')
  const doApp = SONS_DO_APP.find((s) => s.arquivo === somAlarme)
  if (doApp) return t(doApp.chave)
  return rotuloDoSom(somAlarme)
}

export function Ajustes({ aoEscanearHorario }: {
  /**
   * Liga a grade e abre a aba dela.
   *
   * Existe porque escanear o horário morava DENTRO da aba Grade, que só aparece
   * com o recurso ligado. Quem nunca ligou não tinha como descobrir que dava
   * para fotografar o horário da escola em vez de digitar aula por aula — e
   * fotografar é justamente o argumento para querer o recurso.
   */
  aoEscanearHorario?: () => void
}) {
  const t = usarT()
  // O motivo vem do módulo nativo, e não de um texto fixo: quando a conta paga
  // existir mas ninguém tiver entrado no iCloud, dizer "precisa de conta paga"
  // seria mandar o usuário resolver o problema errado.
  const [nuvem, setNuvem] = useState<{ ligada: boolean; motivo: string } | null>(null)
  // Lido num efeito, e nunca no corpo do render: chamar módulo nativo enquanto
  // a tela monta foi o que derrubou o app ao abrir Ajustes.
  const [estadoAlarme, setEstadoAlarme] = useState<EstadoDoAlarme>('sem-suporte')
  useEffect(() => {
    void estadoDoAlarme().then(setEstadoAlarme)
    // O sino toca em LAÇO. Sair da tela sem parar deixaria ele tocando para
    // sempre, e a pessoa procurando de onde vem o som.
    return () => {
      pararAlarme()
      pararSom()
    }
  }, [])
  const [sons, setSons] = useState<string[]>(() => sonsImportados())
  const [importandoSom, setImportandoSom] = useState(false)
  /**
   * Confirma e apaga tudo.
   *
   * É `Alert`, e NÃO um `Modal`. O modal de confirmação era irmão do modal da
   * categoria, e no iOS um modal irmão não sobe por cima de outro que já está
   * apresentado: tocar em "apagar tudo" não fazia absolutamente nada, e foi
   * assim que ele recebeu o app. `Alert` é apresentado pelo sistema, então
   * aparece sobre qualquer folha — e é o que o iOS usa para destrutivo.
   */
  function confirmarApagarTudo() {
    Alert.alert(
      t('ajustes.apagar_tudo_titulo'),
      `${t('ajustes.apagar_tudo_texto', { n: quantosRegistros })}\n\n${t('ajustes.apagar_tudo_aviso')}`,
      [
        { text: t('acao.cancelar'), style: 'cancel' },
        {
          text: t('ajustes.apagar_tudo'),
          style: 'destructive',
          onPress: () => {
            // Remoção lógica em TODAS as coleções, para o apagar viajar no
            // sync. Limpar o armazenamento aqui faria tudo voltar do outro
            // aparelho na próxima sincronização — o oposto do que a pessoa
            // acabou de pedir.
            for (const tabela of TABELAS) {
              for (const r of vivosDe(base, tabela)) remover(tabela, r.id)
            }
            setCategoria(null)
          },
        },
      ],
    )
  }
  const estadoIa = estadoDoModelo()
  /** Qual categoria está aberta na raiz — é o que troca a coluna única pelas
      telas do padrão "Ajustes do iPhone". */
  const [categoria, setCategoria] = useState<Categoria | null>(null)
  /** Qual tipo de compromisso está com as regras abertas na folha, dentro da
      categoria Avisos. */
  const [tipoAberto, setTipoAberto] = useState<TipoCompromisso | null>(null)
  /** O editor de período letivo abre em folha, dentro da categoria Escola: ele
      é uma tela inteira. */
  const [periodoAberto, setPeriodoAberto] = useState(false)
  const [importando, setImportando] = useState(false)
  useEffect(() => {
    let vivo = true
    void Promise.all([estadoDaNuvem(), motivoDaNuvem()]).then(([r, motivo]) => {
      if (vivo) setNuvem({ ligada: r.ligada, motivo })
    })
    return () => {
      vivo = false
    }
  }, [])
  // Cada motivo tem o seu texto. Antes qualquer coisa que não fosse "sem conta
  // iCloud" caía em "precisa de conta paga" — o que passou a ser mentira no dia
  // em que a conta paga entrou, e continuava aparecendo porque o motivo real era
  // outro: o CloudKit não está compilado nesta versão.
  const textoDaNuvem = nuvem?.ligada
    ? t('ajustes.sync_ligado')
    : nuvem?.motivo === 'sem-conta-icloud'
      ? t('ajustes.sync_sem_conta')
      : nuvem?.motivo === 'sem-modulo' || nuvem?.motivo === 'sem-entitlement-icloud'
        ? t('ajustes.sync_nao_incluido')
        : t('ajustes.sync_indisponivel')
  const base = usarLoja((s) => s.base)
  // Depois de `base`, e não antes: esta linha estava acima da declaração dele e
  // derrubava o app na abertura. Com a barra de abas nativa os Ajustes montam
  // junto com o Hoje, então o erro não esperava ninguém abrir a tela — ele
  // acontecia no primeiro render do app inteiro.
  const quantosRegistros = TABELAS.reduce((n, tabela) => n + vivosDe(base, tabela).length, 0)
  const remover = usarLoja((s) => s.remover)
  const ajustes = usarLoja((s) => s.ajustes)
  const mudarAjustes = usarLoja((s) => s.mudarAjustes)
  const guardar = usarLoja((s) => s.guardar)

  const agora = new Date()
  const periodo = periodoAtivo(base, dataDe(new Date()))
  const plano = planejar(base, ajustes, agora, periodo)

  const IDs = TIPOS_COMPROMISSO

  function mudarModoRegra(tipo: TipoCompromisso, id: string, regra: RegraAviso) {
    const lista = (ajustes.padroesAviso[tipo] ?? []).map((r) => (r.id === id ? regra : r))
    mudarAjustes({ padroesAviso: { ...ajustes.padroesAviso, [tipo]: lista } })
  }
  function removerRegra(tipo: TipoCompromisso, id: string) {
    const lista = (ajustes.padroesAviso[tipo] ?? []).filter((r) => r.id !== id)
    mudarAjustes({ padroesAviso: { ...ajustes.padroesAviso, [tipo]: lista } })
  }
  function adicionarRegra(tipo: TipoCompromisso) {
    const regra: RegraAviso = { id: criarId(), quando: { tipo: 'diasAntes', dias: 1, aHora: '20:00' }, modo: 'normal' }
    const lista = [...(ajustes.padroesAviso[tipo] ?? []), regra]
    mudarAjustes({ padroesAviso: { ...ajustes.padroesAviso, [tipo]: lista } })
  }

  return (
    <Tela titulo={t('abas.ajustes')}>
      {/* A raiz é uma lista de CATEGORIAS, no padrão dos Ajustes do iPhone: cada
          linha traz um resumo do estado atual à direita — "Som > Sino" — e é
          esse resumo que evita entrar na categoria só para conferir.

          A ordem dos grupos ainda é o desenho da tela, herdada de antes: primeiro
          QUEM é a pessoa, porque isso muda o que o resto significa; depois os
          avisos e o alarme, que são o produto; a escola e o diagnóstico, que são
          dados; e a zona de risco, sozinha, por último. */}
      <Grupo>
        <LinhaCategoria
          tipo="perfil"
          titulo={t('ajustes.perfil')}
          valor={t(`ajustes.papel.${ajustes.papel}` as ChaveI18n)}
          aoTocar={() => setCategoria('perfil')}
        />
        <LinhaCategoria
          tipo="recursos"
          titulo={t('ajustes.recursos')}
          valor={resumoRecursos(t, ajustes.recursos)}
          aoTocar={() => setCategoria('recursos')}
        />
      </Grupo>

      <Grupo>
        <LinhaCategoria
          tipo="avisos"
          titulo={t('ajustes.avisos')}
          valor={resumoAvisos(t, ajustes.padroesAviso)}
          aoTocar={() => setCategoria('avisos')}
        />
        <LinhaCategoria
          tipo="alarme"
          titulo={t('ajustes.alarme')}
          valor={rotuloSomAtual(t, ajustes.somAlarme)}
          aoTocar={() => setCategoria('alarme')}
        />
      </Grupo>

      <Grupo>
        <LinhaCategoria
          tipo="escola"
          titulo={t('ajustes.escola')}
          valor={periodo ? periodo.nome : t('ajustes.sem_periodo')}
          aoTocar={() => setCategoria('escola')}
        />
        <LinhaCategoria
          tipo="sobre"
          titulo={t('ajustes.sobre')}
          valor={VERSAO}
          aoTocar={() => setCategoria('sobre')}
        />
      </Grupo>

      {/* A zona de risco fica no FIM, sozinha e tingida de aviso.

          Não é decoração: um botão que apaga tudo no meio da tela é apertado
          sem querer enquanto se procura outra coisa. Como categoria, ela só
          abre para quem foi atrás dela — e a confirmação continua exigindo
          dois toques depois desse. */}
      <Secao titulo={t('ajustes.zona_de_risco')}>
        <Grupo>
          <LinhaCategoria
            tipo="dados"
            titulo={t('ajustes.apagar_tudo')}
            perigo
            aoTocar={() => setCategoria('dados')}
          />
        </Grupo>
      </Secao>

      {/* ————— Perfil ————— */}
      <Modal
        visible={categoria === 'perfil'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCategoria(null)}
      >
        <Tela titulo={t('ajustes.perfil')}>
          <Grupo>
            <View style={estilo.bloco}>
              <Apoio>{t('ajustes.papel_pergunta')}</Apoio>
              <Fileira>
                <Pilula
                  texto={t('ajustes.papel.aluno')}
                  ativa={ajustes.papel === 'aluno'}
                  aoTocar={() => mudarAjustes({ papel: 'aluno' })}
                />
                <Pilula
                  texto={t('ajustes.papel.responsavel')}
                  ativa={ajustes.papel === 'responsavel'}
                  aoTocar={() => mudarAjustes({ papel: 'responsavel' })}
                />
              </Fileira>
            </View>
            <View style={estilo.bloco}>
              {/* O rótulo vem ANTES do controle. Estava depois, e rótulo embaixo
                  do que ele nomeia é o tipo de erro que a pessoa não sabe apontar
                  mas que faz a tela parecer errada. */}
              <Apoio>{t('ajustes.minhas_series')}</Apoio>
              <Fileira>
                {SERIES.map((s) => (
                  <Pilula
                    key={s}
                    texto={t(`serie.${s.replace(/ /g, '_')}` as ChaveI18n)}
                    ativa={ajustes.minhasSeries.includes(s)}
                    aoTocar={() =>
                      mudarAjustes({
                        minhasSeries: ajustes.minhasSeries.includes(s)
                          ? ajustes.minhasSeries.filter((x) => x !== s)
                          : [...ajustes.minhasSeries, s],
                      })
                    }
                  />
                ))}
              </Fileira>
            </View>
          </Grupo>
          <Botao texto={t('acao.fechar')} variante="cheio" aoTocar={() => setCategoria(null)} />
        </Tela>
      </Modal>

      {/* ————— Recursos ————— */}
      <Modal
        visible={categoria === 'recursos'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCategoria(null)}
      >
        <Tela titulo={t('ajustes.recursos')}>
          {/* O que a pessoa usa. Ninguém é obrigado a cadastrar a grade da
              escola para anotar uma prova — quem quer só o lembrete desliga o
              resto e o app some com ele: a aba fecha e a seção sai da tela
              Hoje. */}
          <Grupo>
            <View style={estilo.bloco}>
              <Linha entre>
                <View style={{ flex: 1, gap: 2 }}>
                  <Apoio>{t('ajustes.recurso_grade')}</Apoio>
                  <Apoio cor={cores.texto3}>{t('ajustes.recurso_grade_desc')}</Apoio>
                </View>
                <Switch
                  value={ajustes.recursos.grade}
                  onValueChange={(v) =>
                    mudarAjustes({ recursos: { ...ajustes.recursos, grade: v } })
                  }
                  trackColor={{ false: cores.borda, true: cores.destaque }}
                  thumbColor={cores.texto}
                />
              </Linha>
              {!ajustes.recursos.grade && aoEscanearHorario ? (
                <Botao
                  texto={t('ajustes.escanear_horario')}
                  variante="vazado"
                  aoTocar={() => {
                    // Fecha a folha antes de trocar de aba: senão ela continua
                    // flutuando por cima da Grade, que é a aba de destino.
                    setCategoria(null)
                    aoEscanearHorario()
                  }}
                />
              ) : null}
            </View>
            <View style={estilo.bloco}>
              <Linha entre>
                <View style={{ flex: 1, gap: 2 }}>
                  <Apoio>{t('ajustes.recurso_notas')}</Apoio>
                  <Apoio cor={cores.texto3}>{t('ajustes.recurso_notas_desc')}</Apoio>
                </View>
                <Switch
                  value={ajustes.recursos.notas}
                  onValueChange={(v) =>
                    mudarAjustes({ recursos: { ...ajustes.recursos, notas: v } })
                  }
                  trackColor={{ false: cores.borda, true: cores.destaque }}
                  thumbColor={cores.texto}
                />
              </Linha>
            </View>
            {/* Só aparece com a grade ligada: semana alternada é uma
                propriedade da grade, e oferecer a chave sem ela é oferecer
                nada. */}
            {ajustes.recursos.grade ? (
              <View style={estilo.bloco}>
                <Linha entre>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Apoio>{t('ajustes.recurso_semana')}</Apoio>
                    <Apoio cor={cores.texto3}>{t('ajustes.recurso_semana_desc')}</Apoio>
                  </View>
                  <Switch
                    value={ajustes.recursos.semanaAlternada}
                    onValueChange={(v) =>
                      mudarAjustes({ recursos: { ...ajustes.recursos, semanaAlternada: v } })
                    }
                    trackColor={{ false: cores.borda, true: cores.destaque }}
                    thumbColor={cores.texto}
                  />
                </Linha>
              </View>
            ) : null}
          </Grupo>
          <Botao texto={t('acao.fechar')} variante="cheio" aoTocar={() => setCategoria(null)} />
        </Tela>
      </Modal>

      {/* ————— Avisos ————— */}
      {/* Um tipo por linha, e as regras dele abrem numa folha por cima desta. */}
      <Modal
        visible={categoria === 'avisos'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCategoria(null)}
      >
        <Tela titulo={t('ajustes.avisos')}>
          <Grupo>
            {IDs.map((tipo) => (
              <LinhaDeMenu
                key={tipo}
                titulo={t(`compromisso.tipo.singular.${tipo}` as ChaveI18n)}
                valor={t(
                  `ajustes.nivel.${intensidadeDe(tipo, ajustes.padroesAviso[tipo] ?? [])}` as ChaveI18n,
                )}
                aoTocar={() => setTipoAberto(tipo)}
              />
            ))}
          </Grupo>
          <Botao texto={t('acao.fechar')} variante="cheio" aoTocar={() => setCategoria(null)} />
        </Tela>
        <Modal
          visible={tipoAberto !== null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setTipoAberto(null)}
        >
          {tipoAberto ? (
            <Tela titulo={t(`compromisso.tipo.singular.${tipoAberto}` as ChaveI18n)}>
              {/* Três escolhas nomeadas pelo RESULTADO, e o editor cru atrás de
                  "personalizar". Montar regra por regra — dias, hora, modo,
                  repetição — vezes seis tipos é trabalho que ninguém faz: a pessoa
                  olha, cansa, e sai com o padrão. */}
              <Secao titulo={t('ajustes.avisos')}>
                <Fileira>
                  {NIVEIS.map((n) => (
                    <Pilula
                      key={n}
                      texto={t(`ajustes.nivel.${n}` as ChaveI18n)}
                      ativa={intensidadeDe(tipoAberto, ajustes.padroesAviso[tipoAberto] ?? []) === n}
                      aoTocar={() =>
                        mudarAjustes({
                          padroesAviso: {
                            ...ajustes.padroesAviso,
                            [tipoAberto]: avisosPorIntensidade(tipoAberto, n),
                          },
                        })
                      }
                    />
                  ))}
                </Fileira>
                <Apoio>
                  {t(
                    `ajustes.nivel.expl.${intensidadeDe(tipoAberto, ajustes.padroesAviso[tipoAberto] ?? [])}` as ChaveI18n,
                  )}
                </Apoio>
              </Secao>

              <Secao titulo={t('ajustes.personalizar')}>
                {(ajustes.padroesAviso[tipoAberto] ?? []).length === 0 ? (
                  <Vazio texto={t('ajustes.sem_regras')} />
                ) : (
                  (ajustes.padroesAviso[tipoAberto] ?? []).map((regra) => (
                    <RegraLinha
                      key={regra.id}
                      regra={regra}
                      aoMudar={(r) => mudarModoRegra(tipoAberto, regra.id, r)}
                      aoRemover={() => removerRegra(tipoAberto, regra.id)}
                    />
                  ))
                )}
                <Botao
                  texto={t('ajustes.adicionar_regra')}
                  variante="vazado"
                  aoTocar={() => adicionarRegra(tipoAberto)}
                />
              </Secao>

              <Botao texto={t('acao.fechar')} variante="cheio" aoTocar={() => setTipoAberto(null)} />
            </Tela>
          ) : null}
        </Modal>
      </Modal>

      {/* ————— Alarme ————— */}
      <Modal
        visible={categoria === 'alarme'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCategoria(null)}
      >
        <Tela titulo={t('ajustes.alarme')}>
          <Grupo>
            <View style={estilo.bloco}>
              <Apoio>{t('ajustes.som_do_alarme')}</Apoio>
              <Fileira>
                <Pilula
                  texto={t('ajustes.som_padrao')}
                  ativa={!ajustes.somAlarme}
                  aoTocar={() => mudarAjustes({ somAlarme: null })}
                />
                {/* Os sons do próprio app. Os toques do iPhone não podem entrar
                    aqui — são arquivos do sistema, da Apple, e copiá-los para
                    dentro do pacote reprova na revisão da loja. Quem quer
                    exatamente aquele toque usa a importação, logo abaixo. */}
                {SONS_DO_APP.map((som) => (
                  <Pilula
                    key={som.arquivo}
                    texto={t(som.chave)}
                    ativa={ajustes.somAlarme === som.arquivo}
                    aoTocar={() => {
                      mudarAjustes({ somAlarme: som.arquivo })
                      // `ouvirSom` lê de `Library/Sounds`; estes moram na bundle.
                      // Chamar ele aqui devolveria silêncio, e silêncio ao tocar
                      // num som parece som quebrado.
                      void ouvirSomDoAppUmaVez(som.arquivo)
                    }}
                  />
                ))}
                {sons.map((nome) => (
                  <Pilula
                    key={nome}
                    texto={rotuloDoSom(nome)}
                    ativa={ajustes.somAlarme === nome}
                    // Tocar já escolhe E toca: escolher som sem ouvir é apostar,
                    // e a única prova viria no meio da madrugada.
                    aoTocar={() => {
                      mudarAjustes({ somAlarme: nome })
                      void ouvirSom(nome)
                    }}
                    aoSegurar={() => {
                      removerSom(nome)
                      if (ajustes.somAlarme === nome) mudarAjustes({ somAlarme: null })
                      setSons(sonsImportados())
                    }}
                  />
                ))}
              </Fileira>
              <Botao
                texto={importandoSom ? t('ajustes.som_importando') : t('ajustes.som_importar')}
                variante="vazado"
                aoTocar={() => {
                  setImportandoSom(true)
                  void importarSom()
                    .then((nome) => {
                      setSons(sonsImportados())
                      if (nome) {
                        mudarAjustes({ somAlarme: nome })
                        void ouvirSom(nome)
                      }
                    })
                    .finally(() => setImportandoSom(false))
                }}
              />
              <Apoio cor={cores.texto3}>{t('ajustes.som_ajuda')}</Apoio>
            </View>

            <View style={estilo.bloco}>
              <Apoio>{t('ajustes.silencio')}</Apoio>
              <Apoio cor={cores.texto3}>{t('ajustes.silencio_desc')}</Apoio>
              <Linha>
                <SeletorDeHora
                  rotulo={t('ajustes.silencio_de')}
                  valor={ajustes.silencioDe}
                  aoMudar={(h) => mudarAjustes({ silencioDe: h as typeof ajustes.silencioDe })}
                />
                <SeletorDeHora
                  rotulo={t('ajustes.silencio_ate')}
                  valor={ajustes.silencioAte}
                  aoMudar={(h) => mudarAjustes({ silencioAte: h as typeof ajustes.silencioAte })}
                />
              </Linha>
            </View>
            <View style={estilo.bloco}>
              <Linha entre>
                <View style={{ flex: 1, gap: 2 }}>
                  <Apoio>{t('ajustes.adiar')}</Apoio>
                  <Apoio cor={cores.texto3}>{t('ajustes.adiar_desc')}</Apoio>
                </View>
                <CampoNumero
                  rotulo={t('ajustes.minutos')}
                  valor={ajustes.adiarMinutos}
                  aoConfirmar={(n) => mudarAjustes({ adiarMinutos: Math.max(0, Math.min(60, n)) })}
                />
              </Linha>
            </View>

            {/* O estado do alarme fica AQUI, ao lado do som e do adiar, porque
                é diagnóstico: sem ele, alarme não autorizado é indistinguível
                de alarme quebrado — foi assim que este defeito passou
                despercebido. */}
            <View style={estilo.bloco}>
              <Linha entre>
                <Apoio>{t('ajustes.alarme_permissao')}</Apoio>
                <Apoio cor={estadoAlarme === 'autorizado' ? cores.ok : cores.aviso}>
                  {t(`ajustes.alarme_${estadoAlarme.replace(/-/g, '_')}` as ChaveI18n)}
                </Apoio>
              </Linha>
              {estadoAlarme === 'nao-perguntado' ? (
                <Botao
                  texto={t('ajustes.alarme_pedir')}
                  variante="vazado"
                  aoTocar={() => void pedirPermissaoDeAlarme().then(() => estadoDoAlarme().then(setEstadoAlarme))}
                />
              ) : null}
            </View>
          </Grupo>
          <Botao texto={t('acao.fechar')} variante="cheio" aoTocar={() => setCategoria(null)} />
        </Tela>
      </Modal>

      {/* ————— Escola ————— */}
      <Modal
        visible={categoria === 'escola'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCategoria(null)}
      >
        <Tela titulo={t('ajustes.escola')}>
          <Grupo>
            <LinhaDeMenu
              titulo={t('ajustes.importar_calendario')}
              aoTocar={() => setImportando(true)}
            />
            <LinhaDeMenu
              titulo={t('ajustes.periodo_letivo')}
              valor={periodo ? periodo.nome : t('ajustes.sem_periodo')}
              aoTocar={() => setPeriodoAberto(true)}
            />
            <View style={estilo.bloco}>
              {/* Um rótulo só. O campo trazia o próprio ("Porcentagem") empilhado
                  acima do número, ao lado de "Limite de faltas" à esquerda — dois
                  rótulos desalinhados para uma coisa só, e a linha parecia
                  quebrada. O sufixo % diz o que o rótulo repetia. */}
              <Linha entre>
                <Apoio>{t('ajustes.limite_faltas_padrao')}</Apoio>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.xs }}>
                  <CampoNumero
                    valor={ajustes.limiteFaltasPadrao}
                    aoConfirmar={(n) => mudarAjustes({ limiteFaltasPadrao: n })}
                  />
                  <Apoio>%</Apoio>
                </View>
              </Linha>
            </View>
          </Grupo>
          <Botao texto={t('acao.fechar')} variante="cheio" aoTocar={() => setCategoria(null)} />
        </Tela>
        <Modal
          visible={periodoAberto}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setPeriodoAberto(false)}
        >
          <Tela titulo={t('ajustes.periodo_letivo')}>
            {periodo ? (
              <PeriodoEditor
                key={periodo.id}
                nome={periodo.nome}
                inicio={periodo.inicio}
                fim={periodo.fim}
                feriados={periodo.feriados}
                aoSalvar={(parcial) => guardar('periodos', { id: periodo.id, ...parcial })}
                aoAdicionarFeriado={(data) =>
                  guardar('periodos', { id: periodo.id, feriados: [...periodo.feriados, data] })
                }
                aoRemoverFeriado={(data) =>
                  guardar('periodos', {
                    id: periodo.id,
                    feriados: periodo.feriados.filter((f) => f !== data),
                  })
                }
              />
            ) : (
              <Vazio texto={t('ajustes.sem_periodo')} />
            )}
            <Botao texto={t('acao.fechar')} variante="cheio" aoTocar={() => setPeriodoAberto(false)} />
          </Tela>
        </Modal>
        <Modal
          visible={importando}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setImportando(false)}
        >
          <ImportarCalendario aoFechar={() => setImportando(false)} />
        </Modal>
      </Modal>

      {/* ————— Sobre ————— */}
      {/* Diagnóstico, num grupo só. Antes "avisos agendados" era uma SEÇÃO com
          o número no título, o que dava a um contador o mesmo peso de
          "Escola". */}
      <Modal
        visible={categoria === 'sobre'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCategoria(null)}
      >
        <Tela titulo={t('ajustes.sobre')}>
          <Grupo>
            <View style={estilo.bloco}>
              <Linha entre>
                <Apoio>{t('ajustes.versao')}</Apoio>
                <Apoio cor={cores.texto3}>{VERSAO}</Apoio>
              </Linha>
            </View>
            <View style={estilo.bloco}>
              <Linha entre>
                <Apoio>{t('ajustes.sincronizacao')}</Apoio>
                <Apoio cor={cores.texto3}>{textoDaNuvem}</Apoio>
              </Linha>
            </View>
            <View style={estilo.bloco}>
              <Linha entre>
                <Apoio>{t('ajustes.vidro')}</Apoio>
                <Apoio cor={isLiquidGlassAvailable() ? cores.ok : cores.texto3}>
                  {isLiquidGlassAvailable() ? t('ajustes.vidro_ativo') : t('ajustes.vidro_indisponivel')}
                </Apoio>
              </Linha>
            </View>
            <View style={estilo.bloco}>
              <Linha entre>
                <Apoio>{t('ajustes.ia_local')}</Apoio>
                <Apoio cor={estadoIa === 'pronto' ? cores.ok : cores.aviso}>
                  {t(`resgate.ia_${estadoIa === 'pronto' ? 'pronta' : estadoIa.replace(/-/g, '_')}` as ChaveI18n)}
                </Apoio>
              </Linha>
            </View>
            <View style={estilo.bloco}>
              <Linha entre>
                <Apoio>{t('ajustes.avisos_armados')}</Apoio>
                <Apoio cor={cores.texto3}>{String(plano.agendar.length)}</Apoio>
              </Linha>
              {plano.cortados > 0 ? (
                <Apoio cor={cores.aviso}>{t('ajustes.avisos_cortados', { n: plano.cortados })}</Apoio>
              ) : null}
              {plano.semData.length > 0 ? (
                <Apoio cor={cores.texto3}>
                  {t('ajustes.sem_data')}: {plano.semData.length}
                </Apoio>
              ) : null}
            </View>
          </Grupo>
          <Botao texto={t('acao.fechar')} variante="cheio" aoTocar={() => setCategoria(null)} />
        </Tela>
      </Modal>

      {/* ————— Dados (zona de risco) ————— */}
      <Modal
        visible={categoria === 'dados'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCategoria(null)}
      >
        <Tela titulo={t('ajustes.zona_de_risco')}>
          <Grupo>
            <View style={estilo.bloco}>
              <Apoio cor={cores.texto3}>{t('ajustes.apagar_tudo_desc')}</Apoio>
              <Botao
                texto={t('ajustes.apagar_tudo')}
                variante="destrutivo"
                aoTocar={confirmarApagarTudo}
              />
            </View>
          </Grupo>
          <Botao texto={t('acao.fechar')} variante="cheio" aoTocar={() => setCategoria(null)} />
        </Tela>
      </Modal>

    </Tela>
  )
}

function PeriodoEditor({
  nome,
  inicio,
  fim,
  feriados,
  aoSalvar,
  aoAdicionarFeriado,
  aoRemoverFeriado,
}: {
  nome: string
  inicio: string
  fim: string
  feriados: string[]
  aoSalvar: (parcial: { nome?: string; inicio?: string; fim?: string }) => void
  aoAdicionarFeriado: (data: string) => void
  aoRemoverFeriado: (data: string) => void
}) {
  const t = usarT()
  const [nomeTxt, setNomeTxt] = useState(nome)
  const [inicioTxt, setInicioTxt] = useState(inicio)
  const [fimTxt, setFimTxt] = useState(fim)
  const [novoFeriado, setNovoFeriado] = useState('')

  useEffect(() => setNomeTxt(nome), [nome])
  useEffect(() => setInicioTxt(inicio), [inicio])
  useEffect(() => setFimTxt(fim), [fim])

  return (
    <Cartao>
      <View style={{ gap: espaco.s }}>
        <Campo rotulo={t('ajustes.nome')} valor={nomeTxt} aoMudar={setNomeTxt} aoBlur={() => aoSalvar({ nome: nomeTxt })} />
        <Linha>
          <Campo rotulo={t('ajustes.inicio')} valor={inicioTxt} aoMudar={setInicioTxt} aoBlur={() => aoSalvar({ inicio: inicioTxt })} />
          <Campo rotulo={t('ajustes.fim')} valor={fimTxt} aoMudar={setFimTxt} aoBlur={() => aoSalvar({ fim: fimTxt })} />
        </Linha>
        <Apoio>{t('ajustes.feriados')}</Apoio>
        {feriados.length === 0 ? (
          <Vazio texto={t('ajustes.sem_feriados')} />
        ) : (
          feriados.map((f) => (
            <Linha key={f} entre>
              <Apoio>{f}</Apoio>
              <Botao texto={t('ajustes.remover')} variante="discreto" aoTocar={() => aoRemoverFeriado(f)} />
            </Linha>
          ))
        )}
        <LinhaAdicionarFeriado valor={novoFeriado} aoMudar={setNovoFeriado} aoAdicionar={() => {
          if (novoFeriado.trim()) {
            aoAdicionarFeriado(novoFeriado.trim())
            setNovoFeriado('')
          }
        }} />
      </View>
    </Cartao>
  )
}

function LinhaAdicionarFeriado({ valor, aoMudar, aoAdicionar }: { valor: string; aoMudar: (v: string) => void; aoAdicionar: () => void }) {
  const t = usarT()
  return (
    <Linha>
      <Campo rotulo={t('ajustes.adicionar_feriado')} valor={valor} aoMudar={aoMudar} placeholder="2026-09-07" />
      <Botao texto={t('ajustes.salvar')} aoTocar={aoAdicionar} />
    </Linha>
  )
}

const estilo = StyleSheet.create({
  fundoDaConfirmacao: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: espaco.g,
  },
  caixaDaConfirmacao: {
    backgroundColor: cores.fundoElevado,
    borderRadius: raio.g,
    padding: espaco.g,
    gap: espaco.m,
  },
  // Linha de menu já traz o próprio respiro; quem não é linha de menu precisa do
  // mesmo, senão o conteúdo encosta na borda do grupo.
  bloco: { paddingHorizontal: espaco.g, paddingVertical: espaco.m, gap: espaco.s },
  campo: {
    backgroundColor: cores.cartaoAlto,
    borderRadius: raio.s,
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.s,
    color: cores.texto,
    fontSize: fonte.corpo.fontSize,
  },
  // O selo de 30pt das linhas de categoria da raiz — o mesmo tamanho do ícone
  // de app dentro de uma linha de Ajustes do iOS.
  selo: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: cores.cartaoAlto,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

/**
 * As séries que a pessoa pode marcar.
 *
 * Na forma normalizada que `seriesCitadas` devolve, e não como se escreve na
 * tela: a comparação com o calendário acontece nesta forma, e traduzir aqui
 * faria a mesma escola casar em português e falhar em inglês.
 */
/**
 * Tudo o que o app guarda. Apagar tudo passa por aqui, e nada fica de fora.
 *
 * A ordem importa: o que DEPENDE vem antes do que é dependido. Apagar a matéria
 * primeiro deixaria a aula órfã por um instante, e qualquer tela que
 * renderizasse nesse meio-tempo procuraria uma matéria que já não existe.
 */
const TABELAS = ['compromissos', 'aulas', 'notas', 'faltas', 'materias', 'periodos'] as const

/** Os registros vivos de uma coleção, sem o tipo de cada uma atrapalhar. */
function vivosDe(
  base: ReturnType<typeof usarLoja.getState>['base'],
  tabela: (typeof TABELAS)[number],
): Registro[] {
  // `?? {}` porque dado guardado por uma versão antiga do app pode não ter
  // todas as coleções, e uma tela de ajustes não é lugar para derrubar o app.
  return vivos((base[tabela] ?? {}) as Record<string, Registro>)
}

const SERIES = [
  '1a serie',
  '2a serie',
  '3a serie',
  'ensino medio',
  'fundamental',
  'educacao infantil',
  'contraturno',
] as const
