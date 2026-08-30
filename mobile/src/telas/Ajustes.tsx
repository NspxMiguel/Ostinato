import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Switch, TextInput, View } from 'react-native'
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

function CampoHora({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string
  valor: string
  aoMudar: (h: string) => void
}) {
  const [txt, setTxt] = useState(valor)
  useEffect(() => setTxt(valor), [valor])
  return (
    <Campo
      rotulo={rotulo}
      valor={txt}
      aoMudar={setTxt}
      aoBlur={() => {
        if (/^\d{1,2}:\d{2}$/.test(txt.trim())) aoMudar(txt.trim())
        else setTxt(valor)
      }}
    />
  )
}

export function Ajustes() {
  const t = usarT()
  // O motivo vem do módulo nativo, e não de um texto fixo: quando a conta paga
  // existir mas ninguém tiver entrado no iCloud, dizer "precisa de conta paga"
  // seria mandar o usuário resolver o problema errado.
  const [nuvem, setNuvem] = useState<{ ligada: boolean; motivo: string } | null>(null)
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
      <Secao titulo={t('ajustes.sobre')}>
        <Grupo>
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
const SERIES = [
  '1a serie',
  '2a serie',
  '3a serie',
  'ensino medio',
  'fundamental',
  'educacao infantil',
  'contraturno',
] as const
