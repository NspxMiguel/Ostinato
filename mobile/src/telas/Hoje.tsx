import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { Base, Compromisso, DataISO, DiaSemana, Hora, Materia, TipoCompromisso } from '../../../nucleo/modelo.ts'
import { aulasDoDia, periodoAtivo } from '../../../nucleo/grade.ts'
import { planejar, type AvisoAgendado } from '../../../nucleo/planejador.ts'
import { resolverVencimento, type VencimentoResolvido } from '../../../nucleo/vencimento.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import { dataDe, diaSemanaDe, horaDe, instante, somarDias } from '../../../nucleo/tempo.ts'
import type { ChaveI18n } from '../../../nucleo/i18n.ts'
import { criarT } from '../../../nucleo/i18n.ts'
import { Apoio, Bolinha, Cartao, Etiqueta, Linha, Secao, Tela, Titulo, Vazio } from '../componentes/ui.tsx'
import { comInicialMinuscula, dataPorExtenso, quandoPorExtenso } from '../formato.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarIdioma, usarT } from '../i18n.ts'
import { cores, espaco } from '../tema.ts'

type TFn = ReturnType<typeof criarT>

const LIMITE_CHEGANDO = 10

export function Hoje({ aoAbrirCompromisso }: { aoAbrirCompromisso: (id: string) => void }) {
  const t = usarT()
  const idioma = usarIdioma()
  const base = usarLoja((e) => e.base)
  const ajustes = usarLoja((e) => e.ajustes)
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const hojeISO = dataDe(agora)
  const periodo = periodoAtivo(base, hojeISO)
  const aulas = periodo
    ? aulasDoDia(base, periodo, hojeISO, ajustes.inverterSemanaAlternada)
    : []

  const plano = useMemo(
    () => planejar(base, ajustes, agora, periodo),
    [base, ajustes, agora, periodo],
  )

  const chegando = useMemo(
    () => montarChegando(base, periodo, ajustes.inverterSemanaAlternada, agora, plano),
    [base, periodo, ajustes.inverterSemanaAlternada, agora, plano],
  )

  const semGrade = vivos(base.aulas).length === 0
  const semCompromisso = vivos(base.compromissos).length === 0

  return (
    <Tela titulo={t('abas.hoje')}>
      <Secao titulo={t('hoje.aulas')}>
        {aulas.length === 0 ? (
          <Vazio
            texto={
              semGrade ? t('hoje.vazio_aulas', { aba: t('abas.grade') }) : t('hoje.sem_aulas')
            }
          />
        ) : (
          aulas.map((item) => {
            const inicio = instante(item.data, item.aula.inicio)
            const fim = instante(item.data, item.aula.fim)
            const ms = agora.getTime()
            const acontecendo = ms >= inicio.getTime() && ms < fim.getTime()
            const passou = ms >= fim.getTime()
            const sala = item.aula.sala ?? item.materia?.sala
            return (
              <View key={item.aula.id} style={passou ? e.passou : undefined}>
                <View style={e.aula}>
                  {/* O horário vira coluna à esquerda: a pessoa lê a régua do dia
                      de cima a baixo, sem caçar a hora dentro de cada linha. */}
                  <View style={e.hora}>
                    <Text style={e.horaInicio}>{item.aula.inicio}</Text>
                    <Text style={e.horaFim}>{item.aula.fim}</Text>
                  </View>
                  <Bolinha cor={item.materia?.cor ?? cores.texto3} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Linha entre>
                      <Titulo>{item.materia?.nome ?? ''}</Titulo>
                      {acontecendo ? <Etiqueta texto={t('hoje.agora')} cor={cores.destaque} /> : null}
                    </Linha>
                    {sala ? <Apoio>{sala}</Apoio> : null}
                  </View>
                </View>
              </View>
            )
          })
        )}
      </Secao>

      <Secao titulo={t('hoje.chegando')}>
        {chegando.length === 0 ? (
          <Vazio
            texto={semCompromisso ? t('hoje.vazio_compromissos') : t('hoje.nada_entregar')}
          />
        ) : (
          chegando.map((item) => {
            const materia = materiaViva(base, item.compromisso.materiaId)
            const aviso = item.proximoAviso
            return (
              <Cartao
                key={item.compromisso.id}
                faixa={materia?.cor}
                aoTocar={() => aoAbrirCompromisso(item.compromisso.id)}
              >
                <Linha>
                  <Titulo>{item.compromisso.titulo}</Titulo>
                  <Etiqueta texto={rotuloTipo(t, item.compromisso.tipo)} />
                </Linha>
                {materia ? <Apoio>{materia.nome}</Apoio> : null}
                {item.semData ? (
                  <Apoio cor={cores.aviso}>{t('hoje.sem_horario')}</Apoio>
                ) : item.resolvido ? (
                  <>
                    <Apoio
                      cor={
                        item.atrasado
                          ? cores.atrasado
                          : item.resolvido.data === hojeISO
                            ? cores.aviso
                            : undefined
                      }
                    >
                      {quandoPorExtenso(item.resolvido.data, item.resolvido.hora, hojeISO, t, idioma)}
                    </Apoio>
                    {item.atrasado ? (
                      <Apoio cor={cores.atrasado}>
                        {t('hoje.atrasado_ha', {
                          tempo: duracaoPorExtenso(agora.getTime() - item.resolvido.quando.getTime(), t),
                        })}
                      </Apoio>
                    ) : null}
                    {aviso ? (
                      <View style={e.aviso}>
                        <View style={e.marcaDeAviso} />
                        <Apoio cor={cores.texto3}>
                          {t('hoje.aviso_quando', {
                          quando: comInicialMinuscula(
                            quandoPorExtenso(dataDe(aviso.quando), horaDe(aviso.quando), hojeISO, t, idioma),
                            idioma,
                            ),
                          })}
                        </Apoio>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </Cartao>
            )
          })
        )}
      </Secao>
    </Tela>
  )
}

type ItemChegando = {
  compromisso: Compromisso
  resolvido?: VencimentoResolvido
  semData: boolean
  atrasado: boolean
  proximoAviso?: AvisoAgendado
}

function montarChegando(
  base: Base,
  periodo: ReturnType<typeof periodoAtivo>,
  inverterSemana: boolean,
  agora: Date,
  plano: ReturnType<typeof planejar>,
): ItemChegando[] {
  const semData = new Set(plano.semData)
  const proximoPorId = new Map<string, AvisoAgendado>()
  for (const aviso of plano.agendar) {
    if (!proximoPorId.has(aviso.compromissoId)) proximoPorId.set(aviso.compromissoId, aviso)
  }

  const vivosCompromissos = vivos(base.compromissos).filter((c) => !c.concluido)
  const semDataItens: ItemChegando[] = []
  const resolvidos: ItemChegando[] = []

  for (const c of vivosCompromissos) {
    if (semData.has(c.id)) {
      semDataItens.push({
        compromisso: c,
        semData: true,
        atrasado: false,
        proximoAviso: proximoPorId.get(c.id),
      })
      continue
    }
    const r = resolverVencimento(c, base, periodo, inverterSemana)
    if (!r.ok) {
      // Planejador e tela discordaram: ainda assim mostramos, para não sumir calado.
      semDataItens.push({ compromisso: c, semData: true, atrasado: false })
      continue
    }
    resolvidos.push({
      compromisso: c,
      resolvido: r.valor,
      semData: false,
      atrasado: r.valor.quando.getTime() < agora.getTime(),
      proximoAviso: proximoPorId.get(c.id),
    })
  }

  resolvidos.sort((a, b) => (a.resolvido?.quando.getTime() ?? 0) - (b.resolvido?.quando.getTime() ?? 0))
  return [...semDataItens, ...resolvidos.slice(0, LIMITE_CHEGANDO)]
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
  passou: { opacity: 0.4 },
  aula: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.m },
  // Largura mínima, não fixa: horário é numérico e não cresce com o idioma, mas
  // 24h ("13:30") e 12h ("1:30 PM") têm larguras diferentes.
  hora: { minWidth: 46, paddingTop: 1 },
  horaInicio: { fontSize: 15, fontWeight: '600', color: cores.texto, fontVariant: ['tabular-nums'] },
  horaFim: { fontSize: 13, color: cores.texto3, fontVariant: ['tabular-nums'] },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  // Um traço curto na cor de destaque: é o único lugar da lista onde o amarelo
  // aparece, e ele marca justamente a frase que nenhum concorrente tem.
  marcaDeAviso: { width: 10, height: 2, borderRadius: 1, backgroundColor: cores.destaque },
})
