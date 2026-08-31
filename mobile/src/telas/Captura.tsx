// Anotar sem preencher formulário: escrever corrido, falar, ou fotografar o papel.
//
// Os três caminhos terminam no mesmo lugar — texto — e o texto passa pelo mesmo
// interpretador. É de propósito: se a foto e a voz tivessem regras próprias,
// elas divergiriam do que a tela de digitar entende, e a pessoa aprenderia duas
// gramáticas diferentes para o mesmo app.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Compromisso, Materia, TipoCompromisso } from '../../../nucleo/modelo.ts'
import { TIPOS_COMPROMISSO } from '../../../nucleo/modelo.ts'
import type { Interpretacao } from '../../../nucleo/linguagem.ts'
import { interpretarMelhor } from '../../../nucleo/linguagem.ts'
import { resolverMateria, comApelido } from '../../../nucleo/materias.ts'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import { instante, dataDe } from '../../../nucleo/tempo.ts'
import { previaDeVencimento } from '../../../nucleo/vencimento.ts'
import { vivos } from '../../../nucleo/sync/registro.ts'
import type { Aula } from '../../../nucleo/modelo.ts'
import { criarId } from '../../../nucleo/sync/registro.ts'
import {
  Apoio,
  Botao,
  Cartao,
  Etiqueta,
  Fileira,
  Linha,
  Pilula,
  Secao,
  Tela,
  Titulo,
  Toque,
  Vazio,
} from '../componentes/ui.tsx'
import { momentoPorExtenso } from '../formato.ts'
import { usarLoja } from '../estado/loja.ts'
import { usarIdioma, usarT } from '../i18n.ts'
import { cores, espaco, fonte, raio, CORES_DE_MATERIA } from '../tema.ts'
import { lerPapel, temLeitura } from '../lerPapel.ts'
import { resgatarFrase, resgatarTarefa } from '../resgatar.ts'
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
  const [usouIa, setUsouIa] = useState(false)
  /** A frase que a IA propôs para o que foi DIGITADO. Só entra se a pessoa tocar. */
  const [sugestao, setSugestao] = useState<string | null>(null)
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

  // Fechar a tela DESLIGA o microfone. Sem isto, sair da captura ditando
  // deixava o reconhecedor vivo e o ponto laranja aceso no iPhone — o app
  // continuava ouvindo depois de a pessoa ter ido embora.
  useEffect(() => {
    return () => {
      const parar = pararDitado.current
      pararDitado.current = null
      void parar?.()
    }
  }, [])

  // Sem dia dito, mas com matéria reconhecida e aula cadastrada: o prazo é a
  // PRÓXIMA AULA dessa matéria.
  //
  // É a razão de o app existir — "tarefa de física" quer dizer "para a próxima
  // aula de física", e é isso que a pessoa quer dizer quando não fala data. Sem
  // isto ela ficava com "falta a data" e tinha que abrir o formulário.
  const temAulaDaMateria =
    !!materiaId && vivos(base.aulas).some((a: Aula) => a.materiaId === materiaId)
  const vencimento =
    lido?.vencimento ??
    (temAulaDaMateria && materiaId
      ? ({ tipo: 'aula', materiaId, ocorrencia: 1 } as const)
      : undefined)
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
      if (!final) return
      // Fala hesitante — "ahn, tipo, o professor passou uns exercício pra
      // sexta" — é o caso em que o interpretador mais apanha. Aqui a IA aplica
      // SOZINHA: a pessoa não digitou nada, então não há texto dela para
      // atropelar, e ela vê o resultado escrito antes de salvar.
      const { texto: bom, usou } = await resgatarFrase(final, new Date(), idioma)
      setTexto(bom)
      setUsouIa(usou)
      setSugestao(null)
    }
  }, [idioma])

  // Digitado é outra história: trocar o texto embaixo de quem está escrevendo
  // move o cursor e apaga palavra pela metade. Aqui a IA só PROPÕE, depois de
  // uma pausa, e quem decide é o toque.
  useEffect(() => {
    setSugestao(null)
    if (ouvindo || texto.trim() === '') return
    let valeu = true
    const timer = setTimeout(() => {
      void resgatarFrase(texto, new Date(), idioma).then(({ texto: bom, usou }) => {
        // A pessoa continuou escrevendo enquanto o modelo pensava: a proposta
        // já é sobre outra frase, e mostrá-la seria pior que não mostrar nada.
        if (valeu && usou && bom !== texto) setSugestao(bom)
      })
    }, 1200)
    return () => {
      valeu = false
      clearTimeout(timer)
    }
  }, [texto, idioma, ouvindo])

  const fotografar = useCallback(async (de: 'camera' | 'galeria' = 'camera') => {
    setLendoFoto(true)
    try {
      const r = await lerPapel(de)
      // A foto de um papel costuma trazer várias tarefas. O texto inteiro entra
      // no campo para a pessoa ver e editar — melhor do que gravar cinco coisas
      // que ela não leu.
      if (r.tipo === 'lido') {
        const cru = r.texto.split('\n').filter((l) => l.trim() !== '').join('\n')
        const { texto: bom, usou } = await resgatarTarefa(cru, r.confianca)
        setTexto(bom)
        setUsouIa(usou)
      }
    } finally {
      setLendoFoto(false)
    }
  }, [])

  return (
    <Tela titulo={t('captura.titulo')}>
      <Cartao padding={espaco.g}>
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
      {usouIa ? <Text style={e.ajuda}>{t('resgate.usou')}</Text> : null}
      {sugestao ? (
        <Pressable
          onPress={() => {
            setTexto(sugestao)
            setUsouIa(true)
            setSugestao(null)
          }}
          accessibilityRole="button"
        >
          <Text style={e.ajuda}>{t('resgate.entendi')}</Text>
          <Text style={e.sugestao}>{sugestao}</Text>
        </Pressable>
      ) : null}
      </Cartao>

      {/* As três entradas na MESMA fileira de pílulas, e sem `flex: 1`.
          Dividir a linha em partes iguais espremia "Falar" — que é curto em
          inglês e comprido em francês — contra a borda, com o texto cortado. */}
      <Fileira>
        <Pilula
          texto={ouvindo ? t('captura.ouvindo') : t('captura.falar')}
          ativa={ouvindo}
          aoTocar={ouvindo ? terminarDitado : comecarDitado}
        />
        {temLeitura() ? (
          <>
            <Pilula
              texto={lendoFoto ? t('captura.lendo') : t('captura.foto')}
              aoTocar={() => void fotografar('camera')}
            />
            <Pilula texto={t('papel.da_galeria')} aoTocar={() => void fotografar('galeria')} />
          </>
        ) : null}
      </Fileira>
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
      <Fileira>
        {candidatos.map((m) => (
          <Pilula key={m.id} texto={m.nome} cor={m.cor} aoTocar={() => aoEscolher(m)} />
        ))}
        <Pilula texto={t('captura.criar_materia', { nome })} aoTocar={aoCriar} />
      </Fileira>
    </View>
  )
}

const e = StyleSheet.create({
  // O aviso de que a IA do aparelho encostou no texto. Discreto, mas presente:
  // texto que muda sozinho sem explicacao faz a pessoa desconfiar do app todo.
  ajuda: { color: cores.textoFraco, fontSize: 13, marginTop: espaco.p, lineHeight: 18 },
  // A proposta da IA fica na cor de destaque para se ler como algo em que dá
  // para TOCAR — texto cinza aqui viraria mais um aviso que ninguém aperta.
  sugestao: { color: cores.destaque, fontSize: 15, lineHeight: 21, marginTop: 2 },
  // Sem fundo nem contorno próprios: o cartão em volta já é a superfície, e
  // caixa dentro de caixa é o que fazia esta tela parecer formulário.
  campo: {
    color: cores.texto,
    fontSize: 18,
    minHeight: 120,
    textAlignVertical: 'top',
  },
})
