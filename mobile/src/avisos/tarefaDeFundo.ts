// Reabastecer a janela de avisos com o app fechado.
//
// O planejador mantém 60 avisos armados, os mais próximos. Conforme eles vão
// disparando, os seguintes precisam entrar — e ninguém garante que o estudante
// abra o app antes disso. Sem esta tarefa, um app fechado por duas semanas
// chegaria à véspera da prova com a janela vazia.
//
// O iOS decide quando roda (BGTaskScheduler; costuma ser à noite, com o telefone
// carregando). Não dá para exigir horário, e por isso a janela é grande: 60
// avisos cobrem semanas, e a tarefa é o reforço, não o mecanismo principal.

import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import { periodoAtivo } from '../../../nucleo/grade.ts'
import { dataDe } from '../../../nucleo/tempo.ts'
import { criarT } from '../../../nucleo/i18n.ts'
import { usarLoja } from '../estado/loja.ts'
import { idiomaDoSistema } from '../i18n.ts'
import { sincronizarAvisos } from './notificacoes.ts'

export const TAREFA = 'giz.rearmar-avisos'

TaskManager.defineTask(TAREFA, async () => {
  try {
    const { base, ajustes } = usarLoja.getState()
    const t = criarT(ajustes.idioma ?? idiomaDoSistema())
    await sincronizarAvisos(base, ajustes, periodoAtivo(base, dataDe(new Date())), t)
    return BackgroundTask.BackgroundTaskResult.Success
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

export async function registrarTarefaDeFundo(): Promise<boolean> {
  // O simulador nao tem BGTaskScheduler, e tentar registrar ali so enche o
  // console de aviso a cada abertura. Perguntar antes tambem cobre o aparelho
  // com Atualizacao em Segundo Plano desligada nos Ajustes do iOS.
  const estado = await BackgroundTask.getStatusAsync()
  if (estado !== BackgroundTask.BackgroundTaskStatus.Available) return false

  if (await TaskManager.isTaskRegisteredAsync(TAREFA)) return true
  await BackgroundTask.registerTaskAsync(TAREFA, { minimumInterval: 60 * 12 })
  return true
}
