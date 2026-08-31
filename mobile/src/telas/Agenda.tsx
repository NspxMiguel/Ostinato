import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import type {
  Base,
  Compromisso,
  DataISO,
  DiaSemana,
  Hora,
  Idioma,
  Materia,
  TipoCompromisso,
} from '../../../nucleo/modelo.ts'
import { TIPOS_COMPROMISSO } from '../../../nucleo/modelo.ts'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import { planejar } from '../../../nucleo/planejador.ts'
import { resolverVencimento, type VencimentoResolvido } from '../../../nucleo/vencimento.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { dataDe, diaSemanaDe, instante, somarDias } from '../../../nucleo/tempo.ts'
import type { ChaveI18n } from '../../../nucleo/i18n.ts'
import { criarT } from '../../../nucleo/i18n.ts'
import { Apoio, Cartao, Etiqueta, Fileira, Linha, Pilula, Secao, Tela, Titulo, Vazio } from '../componentes/ui.tsx'
import { Deslizar } from '../componentes/Deslizar.tsx'
import { dataPorExtenso, quandoPorExtenso } from '../formato.ts'
import { estaAtrasado } from '../../../nucleo/hoje.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarIdioma, usarT } from '../i18n.ts'
import { cores, espaco } from '../tema.ts'

type TFn = ReturnType<typeof criarT>

type ItemAgenda = {
  compromisso: Compromisso
  resolvido?: VencimentoResolvido
  semData: boolean
  atrasado: boolean
}

type Grupo = { id: string; titulo: string; itens: ItemAgenda[] }

export function Agenda({ aoAbrirCompromisso }: { aoAbrirCompromisso: (id: string) => void }) {
  const t = usarT()
  const idioma = usarIdioma()
  const base = usarLoja((e) => e.base)
  const ajustes = usarLoja((e) => e.ajustes)
  const guardar = usarLoja((e) => e.guardar)
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false)
  const [materiasFiltro, setMateriasFiltro] = useState<string[]>([])
  const [tiposFiltro, setTiposFiltro] = useState<TipoCompromisso[]>([])

  const agora = new Date()
  const hojeISO = dataDe(agora)
  const periodo = periodoAtivo(base, hojeISO)
  const plano = useMemo(
    () => planejar(base, ajustes, agora, periodo),
    [base, ajustes, periodo],
  )

  const compromissos = vivos(base.compromissos)
  const materiasComCompromisso = useMemo(() => {
    const ids = new Set<string>()
    for (const c of compromissos) {
      if (c.materiaId) ids.add(c.materiaId)
    }
    return vivos(base.materias).filter((m) => ids.has(m.id))
  }, [base.materias, compromissos])

  const tiposPresentes = useMemo(() => {
    const vistos = new Set(compromissos.map((c) => c.tipo))
    return TIPOS_COMPROMISSO.filter((tipo) => vistos.has(tipo))
  }, [compromissos])

  const grupos = useMemo(() => {
    const semDataIds = new Set(plano.semData)
    const itens: ItemAgenda[] = []
    for (const c of compromissos) {
      if (c.concluido && !mostrarConcluidos) continue
      if (materiasFiltro.length > 0 && (!c.materiaId || !materiasFiltro.includes(c.materiaId))) continue
      if (tiposFiltro.length > 0 && !tiposFiltro.includes(c.tipo)) continue

      if (semDataIds.has(c.id)) {
        itens.push({ compromisso: c, semData: true, atrasado: false })
        continue
      }
      const r = resolverVencimento(c, base, periodo, ajustes.inverterSemanaAlternada)
      if (!r.ok) {
        itens.push({ compromisso: c, semData: true, atrasado: false })
        continue
      }
      // A MESMA regra do Hoje. Duas definições de "atrasado" no mesmo app
      // fariam a tarefa aparecer vermelha numa tela e normal na outra.
      const atrasado = !c.concluido && estaAtrasado(r.valor.quando, agora)
      itens.push({ compromisso: c, resolvido: r.valor, semData: false, atrasado })
    }

    const atrasados = itens.filter((i) => i.atrasado)
    const semData = itens.filter((i) => i.semData)
    const rest = itens.filter((i) => !i.atrasado && !i.semData)

    const porDia = new Map<DataISO, ItemAgenda[]>()
    for (const item of rest) {
      const dia = item.resolvido?.data
      if (!dia) continue
      const lista = porDia.get(dia) ?? []
      lista.push(item)
      porDia.set(dia, lista)
    }
    for (const lista of porDia.values()) {
      lista.sort((a, b) => (a.resolvido?.quando.getTime() ?? 0) - (b.resolvido?.quando.getTime() ?? 0))
    }

    const saida: Grupo[] = []
    if (atrasados.length > 0) {
      atrasados.sort((a, b) => (a.resolvido?.quando.getTime() ?? 0) - (b.resolvido?.quando.getTime() ?? 0))
      saida.push({ id: 'atrasados', titulo: t('agenda.atrasados'), itens: atrasados })
    }
    if (semData.length > 0) {
      saida.push({ id: 'sem-data', titulo: t('agenda.sem_data'), itens: semData })
    }
    const dias = [...porDia.keys()].sort()
    for (const dia of dias) {
      saida.push({
        id: dia,
        titulo: dataPorExtenso(dia, hojeISO, t, idioma),
        itens: porDia.get(dia) ?? [],
      })
    }
    return saida
  }, [
    compromissos,
    mostrarConcluidos,
    materiasFiltro,
    tiposFiltro,
    plano.semData,
    base,
    periodo,
    ajustes.inverterSemanaAlternada,
    t,
    hojeISO,
  ])

  const filtrosAtivos = materiasFiltro.length > 0 || tiposFiltro.length > 0
  // Título e texto separados: o título diz o ESTADO, o texto diz o que fazer.
  // Uma frase só tem que ser as duas coisas e não é bem nenhuma.
  const vazio =
    compromissos.length === 0
      ? { titulo: t('hoje.vazio_compromissos_titulo'), texto: t('agenda.vazio') }
      : filtrosAtivos
        ? { titulo: t('agenda.vazio_filtro_titulo'), texto: t('agenda.vazio_filtro') }
        : { titulo: t('hoje.nada_entregar'), texto: '' }

  function alternarMateria(id: string) {
    setMateriasFiltro((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    )
  }

  function alternarTipo(tipo: TipoCompromisso) {
    setTiposFiltro((atual) =>
      atual.includes(tipo) ? atual.filter((x) => x !== tipo) : [...atual, tipo],
    )
  }

  /** Apagar é remoção lógica: o registro vira tombstone e o sync leva junto. */
  function remover(c: Compromisso) {
    guardar('compromissos', { id: c.id, removido: true })
  }

  function alternarConcluido(c: Compromisso) {
    guardar('compromissos', {
      id: c.id,
      concluido: !c.concluido,
      concluidoEm: c.concluido ? undefined : Date.now(),
    })
  }

  return (
    <Tela titulo={t('abas.agenda')}>
      {compromissos.length > 0 ? (
        <View style={e.filtros}>
          {materiasComCompromisso.length > 0 ? (
            <Fileira>
              {materiasComCompromisso.map((m) => (
                <Pilula
                  key={m.id}
                  texto={m.nome}
                  ativa={materiasFiltro.includes(m.id)}
                  cor={m.cor}
                  aoTocar={() => alternarMateria(m.id)}
                />
              ))}
            </Fileira>
          ) : null}
          {tiposPresentes.length > 0 ? (
            <Fileira>
              {tiposPresentes.map((tipo) => (
                <Pilula
                  key={tipo}
                  texto={rotuloTipo(t, tipo)}
                  ativa={tiposFiltro.includes(tipo)}
                  aoTocar={() => alternarTipo(tipo)}
                />
              ))}
            </Fileira>
          ) : null}
          <Linha entre>
            <Apoio>{t('agenda.mostrar_concluidos')}</Apoio>
            <Switch
              value={mostrarConcluidos}
              onValueChange={setMostrarConcluidos}
              trackColor={{ false: cores.borda, true: cores.ok }}
              thumbColor={cores.texto}
            />
          </Linha>
        </View>
      ) : null}

      {grupos.length === 0 ? (
        <Vazio titulo={vazio.titulo} texto={vazio.texto} />
      ) : (
        grupos.map((grupo) => (
          <Secao key={grupo.id} titulo={grupo.titulo}>
            {grupo.itens.map((item) => {
              const materia = materiaViva(base, item.compromisso.materiaId)
              const c = item.compromisso
              return (
                <Deslizar
                  key={c.id}
                  aoConcluir={() => alternarConcluido(c)}
                  aoRemover={() => remover(c)}
                  concluido={c.concluido}
                  rotuloConcluir={c.concluido ? t('agenda.reabrir') : t('notificacao.acao.feito')}
                  rotuloRemover={t('ajustes.remover')}
                >
                <View style={e.item}>
                  {/* Fora do cartão: o círculo marca feito, o cartão abre o compromisso. */}
                  <Circulo
                    marcado={c.concluido}
                    cor={materia?.cor ?? cores.marfim}
                    aoTocar={() => alternarConcluido(c)}
                  />
                  <View style={e.cartaoFlex}>
                    <Cartao
                      faixa={materia?.cor}
                      alerta={item.atrasado ? cores.atrasado : undefined}
                      aoTocar={() => aoAbrirCompromisso(c.id)}
                    >
                      <View style={c.concluido ? e.concluido : undefined}>
                        <Linha>
                          <Titulo>{c.titulo}</Titulo>
                          {item.atrasado ? (
                            <Etiqueta texto={t('hoje.atrasado')} cor={cores.atrasado} />
                          ) : null}
                          <Etiqueta texto={rotuloTipo(t, c.tipo)} />
                        </Linha>
                        {materia ? <Apoio>{materia.nome}</Apoio> : null}
                        {item.semData ? (
                          <Apoio cor={cores.aviso}>{t('hoje.sem_horario')}</Apoio>
                        ) : item.resolvido ? (
                          <>
                            <Apoio cor={item.atrasado ? cores.atrasado : undefined}>
                              {quandoPorExtenso(item.resolvido.data, item.resolvido.hora, hojeISO, t, idioma)}
                            </Apoio>
                            {/* Mesma trava do Hoje: atrasado começa no início do
                                dia da entrega, então a subtração pode dar
                                negativo e virar "atrasado há -23 horas". */}
                            {item.atrasado && item.resolvido.quando.getTime() < agora.getTime() ? (
                              <Apoio cor={cores.atrasado}>
                                {t('hoje.atrasado_ha', {
                                  tempo: duracaoPorExtenso(
                                    agora.getTime() - item.resolvido.quando.getTime(),
                                    t,
                                  ),
                                })}
                              </Apoio>
                            ) : null}
                          </>
                        ) : null}
                      </View>
                    </Cartao>
                  </View>
                </View>
                </Deslizar>
              )
            })}
          </Secao>
        ))
      )}
    </Tela>
  )
}

function Circulo({
  marcado,
  cor,
  aoTocar,
}: {
  marcado: boolean
  cor: string
  aoTocar: () => void
}) {
  return (
    <Pressable
      onPress={aoTocar}
      hitSlop={12}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
    >
      <View
        style={[
          e.circulo,
          {
            borderColor: marcado ? cores.ok : cores.texto3,
            backgroundColor: marcado ? cores.ok : 'transparent',
          },
        ]}
      >
        {marcado ? <Text style={e.visto}>✓</Text> : null}
      </View>
    </Pressable>
  )
}

const CHAVE_TIPO: Record<TipoCompromisso, ChaveI18n> = {
  tarefa: 'compromisso.tipo.singular.tarefa',
  prova: 'compromisso.tipo.singular.prova',
  trabalho: 'compromisso.tipo.singular.trabalho',
  leitura: 'compromisso.tipo.singular.leitura',
  entrega: 'compromisso.tipo.singular.entrega',
  outro: 'compromisso.tipo.singular.outro',
}


function rotuloTipo(t: TFn, tipo: TipoCompromisso): string {
  return t(CHAVE_TIPO[tipo])
}

function materiaViva(base: Base, id: string | undefined): Materia | undefined {
  if (!id) return undefined
  const m = base.materias[id]
  return m && !m.removido ? m : undefined
}

function duracaoPorExtenso(ms: number, t: TFn): string {
  const min = Math.max(0, Math.round(Math.abs(ms) / 60_000))
  if (min < 60) return t('tempo.minutos', { n: min })
  const horas = Math.round(min / 60)
  if (horas < 24) return t('tempo.horas', { n: horas })
  return t('tempo.dias', { n: Math.round(horas / 24) })
}

const e = StyleSheet.create({
  filtros: { gap: espaco.m },
  pilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s },
  // O check fica FORA do texto, à esquerda, alinhado ao topo: assim ele não
  // desce junto quando o título quebra em duas linhas.
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.m },
  cartaoFlex: { flex: 1 },
  circulo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  visto: { color: cores.fundo, fontSize: 13, fontWeight: '700', marginTop: -1 },
  concluido: { opacity: 0.45 },
})
