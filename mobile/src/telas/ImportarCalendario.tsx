// Importar o calendário que a escola publicou.
//
// A tela existe porque o filtro NÃO PODE decidir sozinho. Ele classifica com
// confiança e mostra a decisão em três grupos; quem move item entre eles é a
// pessoa. Filtro automático que some com informação é o jeito mais rápido de o
// app perder a confiança de quem acabou de importar cinquenta linhas.
//
// Por isso o grupo "de fora" nunca vem vazio nem escondido: cada linha
// descartada carrega o motivo ao lado.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'
import type { DataISO } from '../../../nucleo/modelo.ts'
import { ehParaMim } from '../../../nucleo/calendarioEscolar.ts'
import { diasDoEvento, lerCalendario, type EventoLido } from '../../../nucleo/importarCalendario.ts'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import { dataDe } from '../../../nucleo/tempo.ts'
import type { ChaveI18n } from '../../../nucleo/i18n.ts'
import { Apoio, Botao, Cartao, Fileira, Linha, Pilula, Secao, Tela, Titulo, Toque, Vazio } from '../componentes/ui.tsx'
import { lerPapel, temLeitura } from '../lerPapel.ts'
import { resgatarCalendario } from '../resgatar.ts'
import { enviarCorrecao } from '../treinar.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarT } from '../i18n.ts'
import { criarFonte, espaco, usarCores } from '../tema.ts'

/** Os três grupos da tela, na ordem em que importam. */
type Grupo = 'semAula' | 'agenda' | 'fora'

function grupoDe(e: EventoLido, papel: 'aluno' | 'responsavel', series: string[]): Grupo {
  if (e.efeito === 'semAula') return 'semAula'
  return ehParaMim(e, papel, series) ? 'agenda' : 'fora'
}

/**
 * Corrige à mão uma linha que a leitura entendeu errado — a data, o texto,
 * ou os dois. Fica dentro do próprio cartão, no lugar dos botões de mover,
 * para não abrir uma tela nova por cima de uma lista que a pessoa já está
 * revisando.
 */
function EditorDeEvento({
  evento,
  aoSalvar,
  aoCancelar,
}: {
  evento: EventoLido
  aoSalvar: (v: { texto: string; inicio: string; fim: string }) => void
  aoCancelar: () => void
}) {
  const t = usarT()
  const cores = usarCores()
  const fonte = criarFonte(cores)
  const [texto, setTexto] = useState(evento.texto)
  const [inicio, setInicio] = useState(evento.inicio)
  const [fim, setFim] = useState(evento.fim)

  return (
    <Cartao>
      <View style={{ gap: espaco.xs }}>
        <Apoio>{t('importar.texto_do_evento')}</Apoio>
        <TextInput
          style={[fonte.corpo, { borderWidth: 1, borderColor: cores.borda, borderRadius: 8, padding: espaco.s }]}
          value={texto}
          onChangeText={setTexto}
          autoCorrect={false}
        />
      </View>
      <Linha>
        <View style={{ gap: espaco.xs, flex: 1 }}>
          <Apoio>{t('importar.data_inicio')}</Apoio>
          <TextInput
            style={[fonte.corpo, { borderWidth: 1, borderColor: cores.borda, borderRadius: 8, padding: espaco.s }]}
            value={inicio}
            onChangeText={setInicio}
            placeholder="2026-09-07"
            autoCorrect={false}
          />
        </View>
        <View style={{ gap: espaco.xs, flex: 1 }}>
          <Apoio>{t('importar.data_fim')}</Apoio>
          <TextInput
            style={[fonte.corpo, { borderWidth: 1, borderColor: cores.borda, borderRadius: 8, padding: espaco.s }]}
            value={fim}
            onChangeText={setFim}
            placeholder="2026-09-07"
            autoCorrect={false}
          />
        </View>
      </Linha>
      <Fileira>
        <Pilula
          texto={t('acao.salvar')}
          aoTocar={() => aoSalvar({ texto: texto.trim() || evento.texto, inicio: inicio.trim(), fim: fim.trim() || inicio.trim() })}
        />
        <Pilula texto={t('acao.cancelar')} aoTocar={aoCancelar} />
      </Fileira>
    </Cartao>
  )
}

export function ImportarCalendario({ aoFechar }: { aoFechar: () => void }) {
  const t = usarT()
  const cores = usarCores()
  const fonte = criarFonte(cores)
  const base = usarLoja((s) => s.base)
  const ajustes = usarLoja((s) => s.ajustes)
  const guardar = usarLoja((s) => s.guardar)

  const [texto, setTexto] = useState('')
  const [lendo, setLendo] = useState(false)
  const [usouIa, setUsouIa] = useState(false)
  /** Texto já mandado pro resgate — não manda de novo sozinho, só quando
      a pessoa mexe no campo outra vez (cola algo diferente). */
  const resgatado = useRef<string | null>(null)
  /** Ids que a pessoa moveu à mão. A chave é o índice na leitura. */
  const [movidos, setMovidos] = useState<Record<number, Grupo>>({})
  /** Linha que o OCR/IA leu errado — some da lista, não entra em grupo nenhum. */
  const [removidos, setRemovidos] = useState<Set<number>>(new Set())
  /** Texto/data corrigidos à mão, por índice — sobrescreve o que foi lido. */
  const [editados, setEditados] = useState<Record<number, { texto: string; inicio: string; fim: string }>>({})
  /** Índice com o formulário de edição aberto, ou nada. */
  const [editando, setEditando] = useState<number | null>(null)

  const ano = Number(dataDe(new Date()).slice(0, 4))
  const lidos = useMemo(() => lerCalendario(texto, ano), [texto, ano])
  // Correção da pessoa por cima do que foi lido — mesmo objeto, campos trocados.
  const eventos = useMemo(
    () => lidos.map((e, i) => (editados[i] ? { ...e, ...editados[i] } as EventoLido : e)),
    [lidos, editados],
  )

  // Roda sozinho quando o texto muda: colar um PDF de duas colunas achatado
  // não pede pra pessoa apertar nada, porque ela não tem como saber que a
  // leitura ficou ruim antes de olhar a lista de eventos. Com debounce: sem
  // isso, cada tecla de quem está DIGITANDO o calendário à mão dispararia
  // uma chamada ao modelo no meio da frase.
  useEffect(() => {
    if (!texto.trim() || resgatado.current === texto) return
    let vale = true
    const timer = setTimeout(() => {
      resgatado.current = texto
      setLendo(true)
      void resgatarCalendario(texto, ano).then(({ texto: bom, usou }) => {
        if (!vale) return
        if (usou && bom !== texto) {
          resgatado.current = bom
          setTexto(bom)
          setUsouIa(true)
        }
        setLendo(false)
      })
    }, 900)
    return () => {
      vale = false
      clearTimeout(timer)
    }
  }, [texto, ano])

  const grupoAtual = (e: EventoLido, i: number): Grupo =>
    movidos[i] ?? grupoDe(e, ajustes.papel, ajustes.minhasSeries)

  const porGrupo = useMemo(() => {
    const m: Record<Grupo, { e: EventoLido; i: number }[]> = { semAula: [], agenda: [], fora: [] }
    eventos.forEach((e, i) => {
      if (removidos.has(i)) return
      m[grupoAtual(e, i)].push({ e, i })
    })
    return m
  }, [eventos, movidos, removidos, ajustes.papel, ajustes.minhasSeries])

  async function fotografar() {
    setLendo(true)
    try {
      const r = await lerPapel('camera')
      // Só o caso 'lido' traz texto; cancelar ou faltar permissão não pode
      // apagar o que a pessoa já colou.
      if (r.tipo === 'lido') setTexto((atual) => (atual ? `${atual}\n${r.texto}` : r.texto))
    } finally {
      setLendo(false)
    }
  }

  function importar() {
    const periodo = periodoAtivo(base, dataDe(new Date()))

    // Dias sem aula viram feriado do período letivo. É a parte que muda o
    // comportamento do app inteiro: sem isso ele marca "próxima aula de
    // matemática" para uma terça em que a escola está fechada.
    if (periodo) {
      const novos = new Set<DataISO>(periodo.feriados)
      for (const { e } of porGrupo.semAula) for (const d of diasDoEvento(e)) novos.add(d)
      guardar('periodos', { id: periodo.id, feriados: [...novos].sort() })
    }

    for (const { e } of porGrupo.agenda) {
      guardar('compromissos', {
        criadoEm: Date.now(),
        tipo: e.efeito === 'avaliacao' ? 'prova' : 'outro',
        titulo: e.texto,
        vencimento: { tipo: 'data', data: e.inicio, hora: '23:59' },
        avisos: null,
        concluido: false,
      })
    }
    aoFechar()
  }

  const rotulo: Record<Grupo, ChaveI18n> = {
    semAula: 'importar.grupo_sem_aula',
    agenda: 'importar.grupo_agenda',
    fora: 'importar.grupo_fora',
  }

  return (
    <Tela titulo={t('importar.titulo')}>
      {eventos.length === 0 ? (
        <>
          <Apoio>{t('importar.dica')}</Apoio>
          {usouIa ? <Apoio cor={cores.destaque}>{t('resgate.usou')}</Apoio> : null}
          <Cartao>
            <TextInput
              style={[fonte.corpo, { minHeight: 160, textAlignVertical: 'top' }]}
              value={texto}
              onChangeText={setTexto}
              multiline
              placeholder={t('importar.placeholder')}
              placeholderTextColor={cores.texto4}
              autoCorrect={false}
            />
          </Cartao>
          <Fileira>
            {temLeitura() ? (
              <Botao texto={t('grade.escanear')} variante="cheio" aoTocar={() => void fotografar()} />
            ) : null}
            <Botao texto={t('acao.fechar')} variante="vazado" aoTocar={aoFechar} />
          </Fileira>
          {lendo ? <ActivityIndicator color={cores.destaque} /> : null}
        </>
      ) : (
        <>
          {usouIa ? <Apoio cor={cores.destaque}>{t('resgate.usou')}</Apoio> : null}
          {(['semAula', 'agenda', 'fora'] as const).map((g) => (
            <Secao key={g} titulo={`${t(rotulo[g])} (${porGrupo[g].length})`}>
              {porGrupo[g].length === 0 ? (
                <Vazio texto={t('importar.grupo_vazio')} />
              ) : (
                porGrupo[g].map(({ e, i }) =>
                  editando === i ? (
                    <EditorDeEvento
                      key={i}
                      evento={e}
                      aoSalvar={(v) => {
                        if (v.texto !== e.texto) enviarCorrecao('calendario', e.texto, v.texto)
                        setEditados((m) => ({ ...m, [i]: v }))
                        setEditando(null)
                      }}
                      aoCancelar={() => setEditando(null)}
                    />
                  ) : (
                    <Cartao key={i}>
                      <Titulo>{e.texto}</Titulo>
                      <Apoio>
                        {e.inicio === e.fim ? e.inicio : `${e.inicio} — ${e.fim}`}
                        {/* O porquê ao lado: filtro sem explicação é magia, e
                            magia é o que faz a pessoa desconfiar do resultado. */}
                        {g === 'fora' ? ` · ${t(`importar.porque.${e.porque}` as ChaveI18n)}` : ''}
                      </Apoio>
                      <Fileira>
                        {(['semAula', 'agenda', 'fora'] as const)
                          .filter((outro) => outro !== g)
                          .map((outro) => (
                            <Pilula
                              key={outro}
                              texto={t(rotulo[outro])}
                              aoTocar={() => {
                                // O sinal que vale ensinar é justamente este: a
                                // leitura tinha decidido uma coisa (ou não tinha
                                // decidido nada, em "fora") e a pessoa corrigiu.
                                if (g === 'fora') enviarCorrecao('calendario', e.texto, outro)
                                setMovidos((m) => ({ ...m, [i]: outro }))
                              }}
                            />
                          ))}
                        <Pilula texto={t('importar.editar')} aoTocar={() => setEditando(i)} />
                        <Pilula texto={t('acao.apagar')} aoTocar={() => setRemovidos((r) => new Set(r).add(i))} />
                      </Fileira>
                    </Cartao>
                  ),
                )
              )}
            </Secao>
          ))}

          <Fileira>
            <Botao
              texto={t('importar.confirmar', {
                n: porGrupo.semAula.length + porGrupo.agenda.length,
              })}
              variante="cheio"
              aoTocar={importar}
            />
            <Botao texto={t('acao.fechar')} variante="vazado" aoTocar={aoFechar} />
          </Fileira>
        </>
      )}
    </Tela>
  )
}
