import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
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
import { Apoio, Botao, Cartao, Linha, Secao, Tela, Titulo, Vazio } from '../componentes/ui.tsx'
import { rotuloDeRegra } from '../formato.ts'
import { usarLoja } from '../estado/loja.ts'
import { estadoDaNuvem, motivoDaNuvem } from '../sync.ts'
import { usarT } from '../i18n.ts'
import { cores, espaco, fonte, raio } from '../tema.ts'

function Campo({
  rotulo,
  valor,
  aoMudar,
  teclado,
  aoBlur,
  placeholder,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  teclado?: 'numeric' | 'default'
  aoBlur?: () => void
  placeholder?: string
}) {
  return (
    <View style={{ gap: espaco.xs, flex: 1 }}>
      <Apoio>{rotulo}</Apoio>
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
  function mudarNumero(n: number, campo: 'dias' | 'minutos') {
    if (regra.quando.tipo === 'diasAntes' && campo === 'dias') {
      aoMudar({ ...regra, quando: { ...regra.quando, dias: Math.max(0, n) } })
    } else if (regra.quando.tipo === 'antesDe' && campo === 'minutos') {
      aoMudar({ ...regra, quando: { ...regra.quando, minutos: Math.max(0, n) } })
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
        <Linha>
          {modos.map((m) => (
            <Botao
              key={m}
              texto={t(`avisos.modo.${m}` as ChaveI18n)}
              variante={m === regra.modo ? 'cheio' : 'vazado'}
              aoTocar={() => mudarModo(m)}
            />
          ))}
        </Linha>
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
  rotulo: string
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
  useEffect(() => {
    let vivo = true
    void Promise.all([estadoDaNuvem(), motivoDaNuvem()]).then(([r, motivo]) => {
      if (vivo) setNuvem({ ligada: r.ligada, motivo })
    })
    return () => {
      vivo = false
    }
  }, [])
  const textoDaNuvem = nuvem?.ligada
    ? t('ajustes.sync_ligado')
    : nuvem?.motivo === 'sem-conta-icloud'
      ? t('ajustes.sync_sem_conta')
      : t('ajustes.indisponivel_dev_pago')
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
      <Secao titulo={t('ajustes.idioma')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          <Botao
            texto={t('ajustes.seguir_sistema')}
            variante={ajustes.idioma === null ? 'cheio' : 'vazado'}
            aoTocar={() => mudarAjustes({ idioma: null })}
          />
          {/* Cada idioma aparece no próprio nome: quem procura "Español" não
              está lendo a tela em português para achar "Espanhol". */}
          {IDIOMAS.map((id) => (
            <Botao
              key={id}
              texto={NOME_DO_IDIOMA[id]}
              variante={ajustes.idioma === id ? 'cheio' : 'vazado'}
              aoTocar={() => mudarAjustes({ idioma: id })}
            />
          ))}
        </View>
      </Secao>

      <Secao titulo={t('ajustes.padroes_aviso_tipo')}>
        {IDs.map((tipo) => (
          <Cartao key={tipo}>
            <View style={{ gap: espaco.s }}>
              <Linha entre>
                <Titulo>{t(`compromisso.tipo.singular.${tipo}` as ChaveI18n)}</Titulo>
                <Botao texto={t('ajustes.adicionar_regra')} variante="discreto" aoTocar={() => adicionarRegra(tipo)} />
              </Linha>
              {(ajustes.padroesAviso[tipo] ?? []).map((regra) => (
                <RegraLinha
                  key={regra.id}
                  regra={regra}
                  aoMudar={(r) => mudarModoRegra(tipo, regra.id, r)}
                  aoRemover={() => removerRegra(tipo, regra.id)}
                />
              ))}
            </View>
          </Cartao>
        ))}
      </Secao>

      <Secao titulo={t('ajustes.periodo_letivo')}>
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
              guardar('periodos', { id: periodo.id, feriados: periodo.feriados.filter((f) => f !== data) })
            }
          />
        ) : (
          <Vazio texto={t('ajustes.sem_periodo')} />
        )}
      </Secao>

      <Secao titulo={t('ajustes.limite_faltas_padrao')}>
        <CampoNumero
          rotulo={t('ajustes.porcentagem')}
          valor={ajustes.limiteFaltasPadrao}
          aoConfirmar={(n) => mudarAjustes({ limiteFaltasPadrao: n })}
        />
      </Secao>

      <Secao titulo={t('ajustes.sincronizacao')}>
        <Apoio>{textoDaNuvem}</Apoio>
      </Secao>

      <Secao titulo={t('ajustes.avisos_agendados', { n: plano.agendar.length })}>
        {plano.cortados > 0 ? <Apoio>{t('ajustes.avisos_cortados', { n: plano.cortados })}</Apoio> : null}
        {plano.semData.length > 0 ? (
          <Cartao>
            <Apoio>{t('ajustes.sem_data')}</Apoio>
            {plano.semData.map((cid) => {
              const c = base.compromissos[cid]
              return <Apoio key={cid}>{c ? c.titulo : `(${cid})`}</Apoio>
            })}
          </Cartao>
        ) : null}
      </Secao>
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
  campo: {
    backgroundColor: cores.cartaoAlto,
    borderRadius: raio.s,
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.s,
    color: cores.texto,
    fontSize: fonte.corpo.fontSize,
  },
})
