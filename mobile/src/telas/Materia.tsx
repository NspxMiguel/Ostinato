import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { ChaveI18n } from '../../../nucleo/i18n.ts'
import type { Falta, Materia as TipoMateria, Nota } from '../../../nucleo/modelo.ts'
import { normalizar } from '../../../nucleo/materias.ts'
import { dataDe } from '../../../nucleo/tempo.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { mediaDaMateria, precisaTirar } from '../../../nucleo/notas.ts'
import { situacaoDeFaltas } from '../../../nucleo/faltas.ts'
import { Apoio, Botao, Cartao, Linha, Pilula, Secao, Tela, Titulo, Toque, Vazio } from '../componentes/ui.tsx'
import { apagarMateria } from '../apagarMateria.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarT } from '../i18n.ts'
import { horaDeTexto } from '../formato.ts'
import { criarFonte, espaco, raio, usarCores, type Paleta } from '../tema.ts'

/** Formata um número sem decimais desnecessários, sempre com ponto decimal. */
function numero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  teclado,
  placeholder,
  largura,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  teclado?: 'numeric' | 'default'
  placeholder?: string
  largura?: number
}) {
  const cores = usarCores()
  const estilo = criarEstilo(cores, criarFonte(cores))
  return (
    <View style={{ gap: espaco.xs, flex: largura ? undefined : 1 }}>
      <Apoio>{rotulo}</Apoio>
      <TextInput
        style={[estilo.campo, largura ? { width: largura } : undefined]}
        value={valor}
        onChangeText={aoMudar}
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

function corDeRisco(cores: Paleta) {
  return {
    tranquilo: cores.ok,
    atencao: cores.aviso,
    critico: cores.atrasado,
    reprovado: cores.atrasado,
  } as const
}

export function Materia({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const t = usarT()
  const cores = usarCores()
  const estilo = criarEstilo(cores, criarFonte(cores))
  const COR_RISCO = corDeRisco(cores)
  const base = usarLoja((e) => e.base)
  const guardar = usarLoja((e) => e.guardar)
  const removerVarios = usarLoja((e) => e.removerVarios)

  const materia = base.materias[id]
  if (!materia || materia.removido) {
    return (
      <Tela>
        <Vazio texto={t('materia.sem_carga_horaria')} />
      </Tela>
    )
  }

  const aulas = vivos(base.aulas).filter((a) => a.materiaId === id)
  const notas = vivos(base.notas).filter((n) => n.materiaId === id)
  const faltas = vivos(base.faltas).filter((f) => f.materiaId === id)
  const situacao = situacaoDeFaltas(materia, faltas)
  const media = mediaDaMateria(notas)

  // A "próxima" ainda não existe; a meta é calculada com peso 1 e máximo padrão 10.
  const [meta, setMeta] = useState('')
  const metaNum = Number(meta)
  const precisa = Number.isFinite(metaNum) && metaNum > 0 ? precisaTirar(notas, metaNum, 1, 10) : null

  const [mostrarNota, setMostrarNota] = useState(false)
  const [mostrarFalta, setMostrarFalta] = useState(false)
  const [mostrarCarga, setMostrarCarga] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  function salvarNota(v: { titulo: string; valor: string; maximo: string; peso: string }) {
    const valor = Number(v.valor)
    const maximo = Number(v.maximo)
    const peso = Number(v.peso)
    if (!v.titulo.trim() || !Number.isFinite(valor) || !Number.isFinite(maximo) || !Number.isFinite(peso)) return
    guardar('notas', { materiaId: id, titulo: v.titulo.trim(), valor, maximo, peso })
    setMostrarNota(false)
  }

  function salvarFalta(v: { data: string; aulas: string; justificada: boolean }) {
    const aulasN = Number(v.aulas)
    if (!v.data || !Number.isFinite(aulasN) || aulasN <= 0) return
    guardar('faltas', { materiaId: id, data: v.data, aulas: aulasN, justificada: v.justificada })
    setMostrarFalta(false)
  }

  function salvarCarga(carga: string) {
    const n = Number(carga)
    if (!Number.isFinite(n) || n <= 0) return
    guardar('materias', { id, cargaHoraria: n })
    setMostrarCarga(false)
  }

  return (
    <Tela>
      <Linha entre>
        <Botao texto={t('materia.fechar')} variante="discreto" aoTocar={aoFechar} />
        <Botao
          texto={t('materia.apagar')}
          variante="discreto"
          aoTocar={() => setConfirmando(true)}
        />
      </Linha>

      <Modal
        visible={confirmando}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmando(false)}
      >
        <Pressable style={estilo.fundoDaConfirmacao} onPress={() => setConfirmando(false)}>
          <View style={estilo.caixaDaConfirmacao}>
            <Titulo>{t('materia.apagar_titulo', { nome: materia.nome })}</Titulo>
            <Apoio>
              {t('materia.apagar_texto', {
                aulas: aulas.length,
                notas: notas.length,
                faltas: faltas.length,
              })}
            </Apoio>
            <Botao
              texto={t('materia.apagar')}
              aoTocar={() => {
                apagarMateria(base, materia.id, removerVarios)
                setConfirmando(false)
                aoFechar()
              }}
            />
            <Botao
              texto={t('acao.cancelar')}
              variante="vazado"
              aoTocar={() => setConfirmando(false)}
            />
          </View>
        </Pressable>
      </Modal>
      {/* Uma bolinha só. O `Cartao` já desenha a da matéria pela `faixa`, e
          havia outra escrita à mão logo ao lado do nome — duas bolinhas
          idênticas coladas, que é o tipo de coisa que ninguém reporta e todo
          mundo repara. */}
      <Cartao faixa={materia.cor}>
        <Titulo>{materia.nome}</Titulo>
        {materia.professor ? <Apoio>{`${t('materia.professor')}: ${materia.professor}`}</Apoio> : null}
        {materia.sala ? <Apoio>{`${t('materia.sala')}: ${materia.sala}`}</Apoio> : null}
      </Cartao>

      <Secao titulo={t('materia.outros_nomes')}>
        <Apoio>{t('materia.outros_nomes_dica')}</Apoio>
        <OutrosNomes materia={materia} guardar={guardar} t={t} />
      </Secao>

      <Secao titulo={t('materia.aulas_na_semana')}>
        {aulas.length === 0 ? (
          <Vazio texto={t('materia.sem_aulas')} />
        ) : (
          aulas.map((a) => (
            <Cartao key={a.id}>
              <Linha entre>
                <Apoio>{t(`dia.completo.${a.diaSemana}` as ChaveI18n)}</Apoio>
                <Apoio>{`${horaDeTexto(a.inicio)}–${horaDeTexto(a.fim)}`}</Apoio>
              </Linha>
            </Cartao>
          ))
        )}
      </Secao>

      <Secao titulo={t('materia.notas')}>
        {notas.length === 0 ? (
          <Vazio texto={t('materia.sem_notas')} />
        ) : (
          notas.map((n: Nota) => (
            <Cartao key={n.id}>
              <Linha entre>
                <Titulo>{n.titulo}</Titulo>
                <Apoio>{`${numero(n.valor)} / ${numero(n.maximo)}`}</Apoio>
              </Linha>
              <Apoio>{`${t('materia.peso')}: ${numero(n.peso)}`}</Apoio>
            </Cartao>
          ))
        )}
        <Cartao>
          <Linha entre>
            <Titulo>{t('materia.media')}</Titulo>
            <Titulo>{media === null ? '—' : numero(media)}</Titulo>
          </Linha>
          {precisa ? (
            precisa.possivel ? (
              <Apoio>{t('materia.precisa_nota', { nota: numero(precisa.nota) })}</Apoio>
            ) : (
              <Apoio cor={cores.atrasado}>
                {`${t('materia.impossivel_media')}. ${t('materia.precisa_impossivel', { nota: numero(precisa.nota) })}`}
              </Apoio>
            )
          ) : (
            <Campo rotulo={t('materia.meta')} valor={meta} aoMudar={setMeta} teclado="numeric" />
          )}
        </Cartao>
        {mostrarNota ? (
          <FormNota aoSalvar={salvarNota} aoCancelar={() => setMostrarNota(false)} />
        ) : (
          <Botao texto={t('materia.lancar_nota')} aoTocar={() => setMostrarNota(true)} />
        )}
      </Secao>

      <Secao titulo={t('materia.faltas')}>
        {situacao === null ? (
          mostrarCarga ? (
            <FormCarga
              aoSalvar={salvarCarga}
              aoCancelar={() => setMostrarCarga(false)}
              inicial={materia.cargaHoraria}
            />
          ) : (
            <>
              <Vazio texto={t('materia.informe_carga')} />
              <Botao texto={t('materia.salvar')} variante="vazado" aoTocar={() => setMostrarCarga(true)} />
            </>
          )
        ) : (
          <Cartao>
            <Linha entre>
              <Apoio>{t('materia.risco')}</Apoio>
              <Apoio cor={COR_RISCO[situacao.risco]}>{t(`materia.risco.${situacao.risco}` as ChaveI18n)}</Apoio>
            </Linha>
            <Apoio>{t('materia.perdeu', { n: numero(situacao.perdidas) })}</Apoio>
            {situacao.justificadas > 0 ? (
              <Apoio>{t('materia.justificadas', { n: numero(situacao.justificadas) })}</Apoio>
            ) : null}
            <Apoio>{t('materia.usou_limite', { pct: numero(situacao.percentual) })}</Apoio>
            {situacao.restantes > 0 ? (
              <Apoio cor={COR_RISCO[situacao.risco]}>{t('materia.pode_faltar', { n: numero(situacao.restantes) })}</Apoio>
            ) : (
              <Apoio cor={cores.atrasado}>{t('materia.reprovado_falta')}</Apoio>
            )}
          </Cartao>
        )}
        {mostrarFalta ? (
          <FormFalta aoSalvar={salvarFalta} aoCancelar={() => setMostrarFalta(false)} hoje={dataDe(new Date())} />
        ) : (
          <Botao texto={t('materia.registrar_falta')} aoTocar={() => setMostrarFalta(true)} />
        )}
      </Secao>
    </Tela>
  )
}

function FormNota({
  aoSalvar,
  aoCancelar,
}: {
  aoSalvar: (v: { titulo: string; valor: string; maximo: string; peso: string }) => void
  aoCancelar: () => void
}) {
  const t = usarT()
  const [titulo, setTitulo] = useState('')
  const [valor, setValor] = useState('')
  const [maximo, setMaximo] = useState('10')
  const [peso, setPeso] = useState('1')
  return (
    <Cartao>
      <Campo rotulo={t('materia.titulo')} valor={titulo} aoMudar={setTitulo} placeholder={t('materia.titulo')} />
      <Linha>
        <Campo rotulo={t('materia.valor')} valor={valor} aoMudar={setValor} teclado="numeric" largura={90} />
        <Campo rotulo={t('materia.maximo')} valor={maximo} aoMudar={setMaximo} teclado="numeric" largura={90} />
        <Campo rotulo={t('materia.peso')} valor={peso} aoMudar={setPeso} teclado="numeric" largura={90} />
      </Linha>
      <Linha>
        <Botao texto={t('materia.salvar')} aoTocar={() => aoSalvar({ titulo, valor, maximo, peso })} />
        <Botao texto={t('materia.cancelar')} variante="vazado" aoTocar={aoCancelar} />
      </Linha>
    </Cartao>
  )
}

function FormCarga({
  aoSalvar,
  aoCancelar,
  inicial,
}: {
  aoSalvar: (v: string) => void
  aoCancelar: () => void
  inicial?: number
}) {
  const t = usarT()
  const [carga, setCarga] = useState(String(inicial ?? ''))
  return (
    <Cartao>
      <Campo rotulo={t('materia.informe_carga')} valor={carga} aoMudar={setCarga} teclado="numeric" />
      <Linha>
        <Botao texto={t('materia.salvar')} aoTocar={() => aoSalvar(carga)} />
        <Botao texto={t('materia.cancelar')} variante="vazado" aoTocar={aoCancelar} />
      </Linha>
    </Cartao>
  )
}

function FormFalta({
  aoSalvar,
  aoCancelar,
  hoje,
}: {
  aoSalvar: (v: { data: string; aulas: string; justificada: boolean }) => void
  aoCancelar: () => void
  hoje: string
}) {
  const t = usarT()
  const [data, setData] = useState(hoje)
  const [aulas, setAulas] = useState('1')
  const [justificada, setJustificada] = useState(false)
  return (
    <Cartao>
      <Linha>
        <Campo rotulo={t('materia.data')} valor={data} aoMudar={setData} />
        <Campo rotulo={t('materia.quantas_aulas')} valor={aulas} aoMudar={setAulas} teclado="numeric" largura={110} />
      </Linha>
      <Linha entre>
        <Apoio>{t('materia.justificada')}</Apoio>
        <Pilula
          texto={justificada ? t('materia.sim') : t('materia.nao')}
          ativa={justificada}
          aoTocar={() => setJustificada(!justificada)}
        />
      </Linha>
      <Linha>
        <Botao texto={t('materia.salvar')} aoTocar={() => aoSalvar({ data, aulas, justificada })} />
        <Botao texto={t('materia.cancelar')} variante="vazado" aoTocar={aoCancelar} />
      </Linha>
    </Cartao>
  )
}

function criarEstilo(cores: Paleta, fonte: ReturnType<typeof criarFonte>) {
  return StyleSheet.create({
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
    campo: {
      backgroundColor: cores.cartaoAlto,
      borderRadius: raio.s,
      paddingHorizontal: espaco.m,
      paddingVertical: espaco.s,
      color: cores.texto,
      fontSize: fonte.corpo.fontSize,
    },
  })
}

/**
 * Os outros nomes da mesma matéria.
 *
 * O app já guarda sozinho o nome que a pessoa usou quando ele perguntou. Isto
 * aqui é para quem quer adiantar — e para tirar um apelido que entrou errado,
 * que sem esta tela ficaria preso para sempre.
 */
function OutrosNomes({
  materia,
  guardar,
  t,
}: {
  materia: TipoMateria
  guardar: ReturnType<typeof usarLoja.getState>['guardar']
  t: ReturnType<typeof usarT>
}) {
  const [novo, setNovo] = useState('')
  const apelidos = materia.apelidos ?? []

  function adicionar() {
    const nome = novo.trim()
    if (nome === '') return
    const jaTem = [materia.nome, ...apelidos].some(
      (n) => normalizar(n) === normalizar(nome),
    )
    if (!jaTem) guardar('materias', { id: materia.id, apelidos: [...apelidos, nome] })
    setNovo('')
  }

  return (
    <View style={{ gap: espaco.s }}>
      {apelidos.length === 0 ? (
        <Apoio>{t('materia.sem_outros_nomes')}</Apoio>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          {apelidos.map((a) => (
            <Pilula
              key={a}
              texto={`${a}  ×`}
              aoTocar={() =>
                guardar('materias', {
                  id: materia.id,
                  apelidos: apelidos.filter((x) => x !== a),
                })
              }
            />
          ))}
        </View>
      )}
      <Linha>
        <Campo rotulo={t('materia.adicionar_nome')} valor={novo} aoMudar={setNovo} />
        <Botao texto={t('acao.adicionar')} variante="vazado" aoTocar={adicionar} />
      </Linha>
    </View>
  )
}

