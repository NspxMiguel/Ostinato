// Anotar sem preencher formulário: escrever corrido, falar, ou fotografar o papel.
//
// Os três caminhos terminam no mesmo lugar — texto — e o texto passa pelo mesmo
// interpretador. É de propósito: se a foto e a voz tivessem regras próprias,
// elas divergiriam do que a tela de digitar entende, e a pessoa aprenderia duas
// gramáticas diferentes para o mesmo app.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import type { Compromisso, Materia, TipoCompromisso } from '../../../nucleo/modelo.ts'
import { TIPOS_COMPROMISSO } from '../../../nucleo/modelo.ts'
import type { Interpretacao } from '../../../nucleo/linguagem.ts'
import { interpretarMelhor } from '../../../nucleo/linguagem.ts'
import { resolverMateria, comApelido } from '../../../nucleo/materias.ts'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import { instante, dataDe } from '../../../nucleo/tempo.ts'
import { previaDeVencimento } from '../../../nucleo/vencimento.ts'
import { criarId } from '../../../nucleo/sync/registro.ts'
import { Apoio, Botao, Cartao, Etiqueta, Linha, Secao, Tela, Titulo, Toque, Vazio } from '../componentes/ui.tsx'
import { momentoPorExtenso } from '../formato.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarIdioma, usarT } from '../i18n.ts'
import { cores, espaco, fonte, raio, CORES_DE_MATERIA } from '../tema.ts'
import { lerTexto, temLeitura } from '../../modules/leitura/src/index.ts'
import { ouvir, pedirPermissaoDeVoz, temVoz } from '../../modules/voz/src/index.ts'

export function Captura({ textoInicial, aoFechar, aoAjustar }: {
  /** Frase que chegou de fora (Siri, Atalhos), já escrita no campo. */
  textoInicial?: string
  aoFechar: () => void
  /** Abre o formulário completo já preenchido com o que deu para entender. */
  aoAjustar: (rascunho: Partial<Compromisso>) => void
}) {
  const t = usarT()
  const idioma = usarIdioma()
  const base = usarLoja((e) => e.base)
  const guardar = usarLoja((e) => e.guardar)

  const [texto, setTexto] = useState(textoInicial ?? '')
  const [ouvindo, setOuvindo] = useState(false)
  const [lendoFoto, setLendoFoto] = useState(false)
  const [avisoDeVoz, setAvisoDeVoz] = useState<string | null>(null)
  const pararDitado = useRef<null | (() => Promise<string>)>(null)

  const agora = new Date()
  const periodo = periodoAtivo(base, dataDe(agora))

  // A interpretação é refeita a cada tecla. É barata (regex sobre uma frase) e
  // é o que faz a prévia acompanhar quem está escrevendo.
  let lido: Interpretacao | null = null
  let erroDeLeitura = false
  try {
    lido = texto.trim() === '' ? null : interpretarMelhor(texto, agora, idioma)
  } catch {
    erroDeLeitura = true
  }

  const materiaLida = lido?.materiaNome ? resolverMateria(lido.materiaNome, base) : null
  const [materiaEscolhida, setMateriaEscolhida] = useState<string | null>(null)
  const materiaId =
    materiaEscolhida ?? (materiaLida?.tipo === 'achou' ? materiaLida.materia.id : undefined)

  useEffect(() => {
    // Trocou a frase, esquece a escolha anterior: ela era sobre outro nome.
    setMateriaEscolhida(null)
  }, [lido?.materiaNome])

  const vencimento = lido?.vencimento
  const quando =
    vencimento?.tipo === 'data'
      ? instante(vencimento.data, vencimento.hora ?? '23:59')
      : vencimento?.tipo === 'aula' && materiaId
        ? (previaDeVencimento(materiaId, vencimento.ocorrencia, base, periodo, agora)?.quando ?? null)
        : null

  const podeSalvar = lido !== null && quando !== null

  /** Cria a matéria com o nome que a pessoa usou e a primeira cor livre. */
  const criarMateria = useCallback(
    (nome: string): string => {
      const usadas = Object.values(base.materias).map((m) => m.cor)
      const cor = CORES_DE_MATERIA.find((c) => !usadas.includes(c)) ?? CORES_DE_MATERIA[0]!
      return guardar('materias', {
        nome,
        apelidos: [],
        cor,
        periodoId: periodo?.id ?? '',
        limiteFaltasPct: 25,
      })
    },
    [base.materias, guardar, periodo],
  )

  const salvar = useCallback(() => {
    if (!lido || !vencimento) return
    let idFinal = materiaId
    if (!idFinal && lido.materiaNome && materiaLida?.tipo === 'nova') {
      idFinal = criarMateria(lido.materiaNome)
    }
    guardar('compromissos', {
      criadoEm: Date.now(),
      tipo: lido.tipo ?? 'tarefa',
      titulo: lido.titulo,
      ...(idFinal ? { materiaId: idFinal } : {}),
      vencimento:
        vencimento.tipo === 'data'
          ? { tipo: 'data', data: vencimento.data, ...(vencimento.hora ? { hora: vencimento.hora } : {}) }
          : { tipo: 'aula', materiaId: idFinal ?? '', ocorrencia: vencimento.ocorrencia },
      avisos: null,
      concluido: false,
    })
    aoFechar()
  }, [lido, vencimento, materiaId, materiaLida, guardar, criarMateria, aoFechar])

  const comecarDitado = useCallback(async () => {
    if (!temVoz(idioma)) {
      setAvisoDeVoz(t('captura.sem_voz'))
      return
    }
    if (!(await pedirPermissaoDeVoz())) {
      setAvisoDeVoz(t('captura.sem_permissao_voz'))
      return
    }
    setAvisoDeVoz(null)
    setOuvindo(true)
    pararDitado.current = ouvir(idioma, {
      // O texto aparece enquanto a pessoa fala, como no mic do WhatsApp.
      aoOuvir: (parcial) => setTexto(parcial),
      aoTerminar: (final) => {
        setTexto(final)
        setOuvindo(false)
      },
      aoFalhar: (motivo) => {
        setAvisoDeVoz(motivo)
        setOuvindo(false)
      },
    })
  }, [idioma, t])

  const terminarDitado = useCallback(async () => {
    const parar = pararDitado.current
    pararDitado.current = null
    setOuvindo(false)
    if (parar) {
      const final = await parar()
      if (final) setTexto(final)
    }
  }, [])

  const fotografar = useCallback(async () => {
    if (!temLeitura()) return
    const permissao = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissao.granted) return
    const foto = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false })
    const uri = foto.assets?.[0]?.uri
    if (foto.canceled || !uri) return
    setLendoFoto(true)
    try {
      const r = await lerTexto(uri)
      // A foto de um papel costuma trazer VÁRIAS tarefas. Por enquanto entra a
      // primeira linha que o interpretador entende, e o resto fica no campo para
      // a pessoa ver e editar — melhor do que gravar cinco coisas que ela não leu.
      setTexto(r.texto.split('\n').filter((l) => l.trim() !== '').join('\n'))
    } finally {
      setLendoFoto(false)
    }
  }, [])

  return (
    <Tela titulo={t('captura.titulo')}>
      <TextInput
        style={e.campo}
        value={texto}
        onChangeText={setTexto}
        placeholder={t('captura.dica')}
        placeholderTextColor={cores.textoFraco}
        multiline
        autoFocus
        // Corretor DESLIGADO: este texto não é lido só por gente, é lido pelo
        // app. Com o teclado num idioma e a pessoa escrevendo em outro — comum
        // em app global — "prova de biologia" vira "Probably de biologist", e a
        // interpretação erra sem ninguém entender por quê. Aqui é melhor
        // registrar exatamente o que foi digitado.
        autoCorrect={false}
        spellCheck={false}
      />

      <Linha>
        <Toque
          aoTocar={ouvindo ? terminarDitado : comecarDitado}
          estilo={[e.acao, ouvindo ? e.acaoAtiva : null]}
        >
          <Text style={[fonte.corpo, ouvindo ? { color: cores.fundo, fontWeight: '700' } : null]}>
            {ouvindo ? t('captura.ouvindo') : t('captura.falar')}
          </Text>
        </Toque>
        {temLeitura() ? (
          <Toque aoTocar={fotografar} estilo={e.acao}>
            <Text style={fonte.corpo}>{lendoFoto ? t('captura.lendo') : t('captura.foto')}</Text>
          </Toque>
        ) : null}
      </Linha>
      {lendoFoto ? <ActivityIndicator color={cores.marfim} /> : null}
      {avisoDeVoz ? <Apoio cor={cores.aviso}>{avisoDeVoz}</Apoio> : null}

      {texto.trim() === '' ? null : erroDeLeitura || !lido ? (
        <Vazio texto={t('captura.nao_entendi')} />
      ) : (
        <Secao titulo={t('captura.entendi')}>
          <Cartao faixa={materiaId ? base.materias[materiaId]?.cor : undefined}>
            <Linha>
              <Etiqueta texto={t(`compromisso.tipo.singular.${lido.tipo ?? 'tarefa'}` as never)} />
              {materiaId ? <Apoio>{base.materias[materiaId]?.nome}</Apoio> : null}
            </Linha>
            <Titulo>{lido.titulo}</Titulo>
            {quando ? (
              <Apoio>{momentoPorExtenso(quando, idioma)}</Apoio>
            ) : (
              <Apoio cor={cores.aviso}>{t('captura.falta_data')}</Apoio>
            )}
          </Cartao>

          {lido.materiaNome && !materiaId ? (
            <EscolherMateria
              nome={lido.materiaNome}
              candidatos={materiaLida?.tipo === 'perguntar' ? materiaLida.candidatos : []}
              aoEscolher={(m) => {
                // Guarda o nome que ela usou: amanhã não pergunta de novo.
                guardar('materias', comApelido(m, lido.materiaNome!))
                setMateriaEscolhida(m.id)
              }}
              aoCriar={() => setMateriaEscolhida(criarMateria(lido.materiaNome!))}
              t={t}
            />
          ) : null}
        </Secao>
      )}

      <Botao texto={t('acao.salvar')} aoTocar={salvar} variante={podeSalvar ? 'cheio' : 'vazado'} />
      <Botao
        texto={t('captura.ajustar')}
        variante="discreto"
        aoTocar={() =>
          aoAjustar({
            titulo: lido?.titulo ?? texto,
            tipo: (lido?.tipo ?? 'tarefa') as TipoCompromisso,
            ...(materiaId ? { materiaId } : {}),
          })
        }
      />
    </Tela>
  )
}

/**
 * A pergunta que o app faz quando não tem certeza da matéria.
 *
 * Aparece só quando ele NÃO sabe — perguntar sempre transformaria o caminho
 * rápido em formulário, que é justamente o que esta tela evita.
 */
function EscolherMateria({
  nome,
  candidatos,
  aoEscolher,
  aoCriar,
  t,
}: {
  nome: string
  candidatos: Materia[]
  aoEscolher: (m: Materia) => void
  aoCriar: () => void
  t: ReturnType<typeof usarT>
}) {
  return (
    <View style={{ gap: espaco.s }}>
      <Apoio>{t('captura.qual_materia', { nome })}</Apoio>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
        {candidatos.map((m) => (
          <Toque key={m.id} aoTocar={() => aoEscolher(m)} estilo={e.pilula}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.cor }} />
            <Text style={fonte.corpo}>{m.nome}</Text>
          </Toque>
        ))}
        <Toque aoTocar={aoCriar} estilo={[e.pilula, { borderStyle: 'dashed' }]}>
          <Text style={fonte.apoio}>{t('captura.criar_materia', { nome })}</Text>
        </Toque>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  campo: {
    backgroundColor: cores.cartao,
    borderColor: cores.borda,
    borderWidth: 1,
    borderRadius: raio.m,
    padding: espaco.m,
    color: cores.texto,
    fontSize: 18,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  acao: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: espaco.m,
    borderRadius: raio.m,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  acaoAtiva: { backgroundColor: cores.marfim, borderColor: cores.marfim },
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.s,
    borderRadius: raio.pilula,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.cartao,
  },
})
