import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'
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
  const [confirmandoTudo, setConfirmandoTudo] = useState(false)
  const estadoIa = estadoDoModelo()
  /** Qual tipo de compromisso está com as regras abertas na folha. */
  const [tipoAberto, setTipoAberto] = useState<TipoCompromisso | null>(null)
  /** O editor de período letivo abre em folha: ele é uma tela inteira. */
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
      {/* A ordem é o desenho desta tela, e ela não é arbitrária: primeiro QUEM é
          a pessoa, porque isso muda o que o resto significa; depois o idioma, que
          muda o que ela lê; então os avisos, que são o produto; a escola, que são
          os dados; e por último o diagnóstico, que ninguém procura mas precisa
          existir.

          Todo grupo é um `Grupo`, sem exceção. Antes cada seção usava um
          invólucro diferente — uma solta, outra em cartão, outra em grupo — e era
          isso que fazia a tela parecer montada por três pessoas. */}
      <Secao titulo={t('ajustes.perfil')}>
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
      </Secao>

      {/* O que a pessoa usa. Ninguém é obrigado a cadastrar a grade da escola
          para anotar uma prova — quem quer só o lembrete desliga o resto e o app
          some com ele: a aba fecha e a seção sai da tela Hoje. */}
      <Secao titulo={t('ajustes.recursos')}>
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
                aoTocar={aoEscanearHorario}
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
          {/* Só aparece com a grade ligada: semana alternada é uma propriedade
              da grade, e oferecer a chave sem ela é oferecer nada. */}
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
      </Secao>

      {/* Um tipo por linha, e as regras dele abrem numa folha. */}
      <Secao titulo={t('ajustes.avisos')}>
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
      </Secao>

      {/* O alarme é uma SEÇÃO, e não um apêndice de "Sobre".
          
          Ele morava lá dentro, junto de versão e diagnóstico, porque foi onde
          coube quando eu o escrevi. Mas "Sobre" é para o que o app INFORMA;
          som, faixa de silêncio e adiar são o que a pessoa DECIDE — e ele já
          reclamou de ajuste que dá preguiça de olhar. Ajuste enterrado em
          diagnóstico é a mesma doença. */}
      <Secao titulo={t('ajustes.alarme')}>
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

          {/* O estado do alarme fica AQUI, ao lado do contador de avisos, porque
              é diagnóstico: sem ele, alarme não autorizado é indistinguível de
              alarme quebrado — foi assim que este defeito passou despercebido. */}
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
      </Secao>

      <Secao titulo={t('ajustes.escola')}>
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
      </Secao>

      {/* Diagnóstico, num grupo só. Antes "avisos agendados" era uma SEÇÃO com o
          número no título, o que dava a um contador o mesmo peso de "Escola". */}
      {/* A zona de risco fica no FIM e sozinha.
          
          Não é decoração: um botão que apaga tudo no meio da tela é apertado
          sem querer enquanto se procura outra coisa. Ele fica depois de tudo,
          onde só chega quem foi atrás dele. */}
      <Secao titulo={t('ajustes.zona_de_risco')}>
        <Grupo>
          <View style={estilo.bloco}>
            <Apoio cor={cores.texto3}>{t('ajustes.apagar_tudo_desc')}</Apoio>
            <Botao
              texto={t('ajustes.apagar_tudo')}
              variante="discreto"
              aoTocar={() => setConfirmandoTudo(true)}
            />
          </View>
        </Grupo>
      </Secao>

      <Modal
        visible={confirmandoTudo}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmandoTudo(false)}
      >
        <Pressable style={estilo.fundoDaConfirmacao} onPress={() => setConfirmandoTudo(false)}>
          <View style={estilo.caixaDaConfirmacao}>
            <Titulo>{t('ajustes.apagar_tudo_titulo')}</Titulo>
            <Apoio>{t('ajustes.apagar_tudo_texto', { n: quantosRegistros })}</Apoio>
            <Apoio cor={cores.aviso}>{t('ajustes.apagar_tudo_aviso')}</Apoio>
            <Botao
              texto={t('ajustes.apagar_tudo')}
              aoTocar={() => {
                // Remoção lógica em TODAS as coleções, para o apagar viajar no
                // sync. Limpar o armazenamento aqui faria tudo voltar do outro
                // aparelho na próxima sincronização — o oposto do que a pessoa
                // acabou de pedir.
                for (const tabela of TABELAS) {
                  for (const r of vivosDe(base, tabela)) remover(tabela, r.id)
                }
                setConfirmandoTudo(false)
              }}
            />
            <Botao
              texto={t('acao.cancelar')}
              variante="vazado"
              aoTocar={() => setConfirmandoTudo(false)}
            />
          </View>
        </Pressable>
      </Modal>

      <Secao titulo={t('ajustes.sobre')}>
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
      </Secao>

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
