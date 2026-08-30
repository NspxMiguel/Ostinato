/**
 * Sistema de tradução do Giz.
 * Caso falte alguma chave em inglês, o sistema usará a versão em português de forma silenciosa.
 */

export type Idioma = 'pt' | 'en'

const traducoes = {
  pt: {
    // 1. Abas
    'abas.hoje': 'Hoje',
    'abas.agenda': 'Agenda',
    'abas.grade': 'Grade',
    'abas.ajustes': 'Ajustes',

    // 2. Hoje
    'hoje.sem_aulas': 'Nenhuma aula hoje',
    'hoje.nada_entregar': 'Nada entregando nos próximos dias',
    'hoje.aviso_quando': 'Avisa você {quando}',
    'hoje.daqui_a': 'Daqui a {tempo}',
    'hoje.atrasado_ha': 'Atrasado há {tempo}',

    // 3. Tipos de compromisso
    'compromisso.tipo.singular.tarefa': 'Tarefa',
    'compromisso.tipo.singular.prova': 'Prova',
    'compromisso.tipo.singular.trabalho': 'Trabalho',
    'compromisso.tipo.singular.leitura': 'Leitura',
    'compromisso.tipo.singular.entrega': 'Entrega',
    'compromisso.tipo.singular.outro': 'Outro',

    'compromisso.tipo.plural.tarefa': 'Tarefas',
    'compromisso.tipo.plural.prova': 'Provas',
    'compromisso.tipo.plural.trabalho': 'Trabalhos',
    'compromisso.tipo.plural.leitura': 'Leituras',
    'compromisso.tipo.plural.entrega': 'Entregas',
    'compromisso.tipo.plural.outro': 'Outros',

    // 4. Novo compromisso
    'novo_compromisso.titulo': 'Título',
    'novo_compromisso.detalhe': 'Detalhes',
    'novo_compromisso.materia': 'Matéria',
    'novo_compromisso.quando_vence': 'Quando vence',
    'novo_compromisso.opcao_data': 'Numa data',
    'novo_compromisso.opcao_proxima_aula': 'Na próxima aula de {materia}',
    'novo_compromisso.vence_em': 'Vence em {dataPorExtenso}',
    'novo_compromisso.avisos': 'Avisos',
    'novo_compromisso.usar_padrao_tipo': 'Usar o padrão de {tipo}',
    'novo_compromisso.personalizar': 'Personalizar',

    // 5. Avisos
    'avisos.dias_antes': '{n} dias antes, às {hora}',
    'avisos.horas_antes': '{n} horas antes',
    'avisos.minutos_antes': '{n} minutos antes',
    'avisos.modo.normal': 'Normal',
    'avisos.modo.insistente': 'Insistente',
    'avisos.modo.alarme': 'Alarme',
    'avisos.expl.normal': 'Uma notificação comum que aparece na tela e faz o som padrão.',
    'avisos.expl.insistente': 'Toca e vibra algumas vezes em intervalos curtos para garantir que você veja.',
    'avisos.expl.alarme': 'Com o app fechado e o telefone no silencioso, nenhum app do iOS toca som sem uma permissão especial da Apple; nesse caso ele fura o Foco, vibra e repete até você responder.',

    // 6. Grade
    'dia.completo.0': 'Domingo',
    'dia.completo.1': 'Segunda-feira',
    'dia.completo.2': 'Terça-feira',
    'dia.completo.3': 'Quarta-feira',
    'dia.completo.4': 'Quinta-feira',
    'dia.completo.5': 'Sexta-feira',
    'dia.completo.6': 'Sábado',

    'dia.abrev.0': 'Dom',
    'dia.abrev.1': 'Seg',
    'dia.abrev.2': 'Ter',
    'dia.abrev.3': 'Qua',
    'dia.abrev.4': 'Qui',
    'dia.abrev.5': 'Sex',
    'dia.abrev.6': 'Sáb',

    'grade.adicionar_aula': 'Adicionar aula',
    'grade.colar_horario': 'Colar horário',
    'grade.tirar_foto': 'Tirar foto do horário',
    'grade.aulas_encontradas': '{n} aulas encontradas',
    'grade.linhas_nao_entendidas': 'Não entendi {n} linhas',

    // 7. Matéria
    'materia.media': 'Média',
    'materia.precisa_nota': 'Precisa tirar {nota} na próxima',
    'materia.impossivel_media': 'Já não dá para fechar a média',
    'materia.faltas': 'Faltas',
    'materia.pode_faltar': 'Pode faltar mais {n} aulas',
    'materia.reprovado_falta': 'Você já reprovou por falta',
    'materia.sem_carga_horaria': 'Sem carga horária cadastrada',

    // 8. Ajustes
    'ajustes.idioma': 'Idioma',
    'ajustes.seguir_sistema': 'Seguir o sistema',
    'ajustes.padroes_aviso_tipo': 'Padrões de aviso por tipo',
    'ajustes.som_alarme': 'Som do alarme',
    'ajustes.periodo_letivo': 'Período letivo',
    'ajustes.feriados': 'Feriados',
    'ajustes.sincronizacao': 'Sincronização',
    'ajustes.indisponivel_dev_pago': 'Indisponível — precisa de uma conta de desenvolvedor paga',
    'ajustes.avisos_agendados': '{n} de 60 avisos agendados',

    // 9. Notificações
    'notificacao.prova_dias.titulo': 'Prova chegando',
    'notificacao.prova_dias.corpo': 'Prova de {materia} em {n} dias',
    'notificacao.entrega_amanha.titulo': 'Entrega amanhã',
    'notificacao.entrega_amanha.corpo': 'Entrega de {titulo} amanhã',
    'notificacao.vence_horas.titulo': 'Prazo acabando',
    'notificacao.vence_horas.corpo': '{titulo} vence em {n} horas',
    'notificacao.acao.feito': 'Feito',
    'notificacao.acao.adiar': 'Adiar 10 min',
  } as const,
  en: {
    // 1. Abas
    'abas.hoje': 'Today',
    'abas.agenda': 'Schedule',
    'abas.grade': 'Timetable',
    'abas.ajustes': 'Settings',

    // 2. Hoje
    'hoje.sem_aulas': 'No classes today',
    'hoje.nada_entregar': 'Nothing due in the next few days',
    'hoje.aviso_quando': 'Alerts you {quando}',
    'hoje.daqui_a': 'In {tempo}',
    'hoje.atrasado_ha': 'Overdue by {tempo}',

    // 3. Tipos de compromisso
    'compromisso.tipo.singular.tarefa': 'Task',
    'compromisso.tipo.singular.prova': 'Exam',
    'compromisso.tipo.singular.trabalho': 'Assignment',
    'compromisso.tipo.singular.leitura': 'Reading',
    'compromisso.tipo.singular.entrega': 'Submission',
    'compromisso.tipo.singular.outro': 'Other',

    'compromisso.tipo.plural.tarefa': 'Tasks',
    'compromisso.tipo.plural.prova': 'Exams',
    'compromisso.tipo.plural.trabalho': 'Assignments',
    'compromisso.tipo.plural.leitura': 'Readings',
    'compromisso.tipo.plural.entrega': 'Submissions',
    'compromisso.tipo.plural.outro': 'Others',

    // 4. Novo compromisso
    'novo_compromisso.titulo': 'Title',
    'novo_compromisso.detalhe': 'Details',
    'novo_compromisso.materia': 'Subject',
    'novo_compromisso.quando_vence': 'Due date',
    'novo_compromisso.opcao_data': 'On a specific date',
    'novo_compromisso.opcao_proxima_aula': 'On the next {materia} class',
    'novo_compromisso.vence_em': 'Due on {dataPorExtenso}',
    'novo_compromisso.avisos': 'Alerts',
    'novo_compromisso.usar_padrao_tipo': 'Use default for {tipo}',
    'novo_compromisso.personalizar': 'Customize',

    // 5. Avisos
    'avisos.dias_antes': '{n} days before, at {hora}',
    'avisos.horas_antes': '{n} hours before',
    'avisos.minutos_antes': '{n} minutes before',
    'avisos.modo.normal': 'Normal',
    'avisos.modo.insistente': 'Persistent',
    'avisos.modo.alarme': 'Alarm',
    'avisos.expl.normal': 'A standard notification that appears on screen and plays the default sound.',
    'avisos.expl.insistente': 'Plays and vibrates a few times at short intervals to make sure you see it.',
    'avisos.expl.alarme': 'With the app closed and the phone on silent, no iOS app plays sound without a special Apple permission; in this case it overrides Focus, vibrates, and repeats until you respond.',

    // 6. Grade
    'dia.completo.0': 'Sunday',
    'dia.completo.1': 'Monday',
    'dia.completo.2': 'Tuesday',
    'dia.completo.3': 'Wednesday',
    'dia.completo.4': 'Thursday',
    'dia.completo.5': 'Friday',
    'dia.completo.6': 'Saturday',

    'dia.abrev.0': 'Sun',
    'dia.abrev.1': 'Mon',
    'dia.abrev.2': 'Tue',
    'dia.abrev.3': 'Wed',
    'dia.abrev.4': 'Thu',
    'dia.abrev.5': 'Fri',
    'dia.abrev.6': 'Sat',

    'grade.adicionar_aula': 'Add class',
    'grade.colar_horario': 'Paste schedule',
    'grade.tirar_foto': 'Take a photo of the schedule',
    'grade.aulas_encontradas': '{n} classes found',
    'grade.linhas_nao_entendidas': 'Could not understand {n} lines',

    // 7. Matéria
    'materia.media': 'Average',
    'materia.precisa_nota': 'Need to score {nota} on the next one',
    'materia.impossivel_media': 'Can no longer reach the passing grade',
    'materia.faltas': 'Absences',
    'materia.pode_faltar': 'You can miss {n} more classes',
    'materia.reprovado_falta': 'Failed due to absences',
    'materia.sem_carga_horaria': 'Course hours not registered',

    // 8. Ajustes
    'ajustes.idioma': 'Language',
    'ajustes.seguir_sistema': 'System default',
    'ajustes.padroes_aviso_tipo': 'Default alerts by type',
    'ajustes.som_alarme': 'Alarm sound',
    'ajustes.periodo_letivo': 'Academic term',
    'ajustes.feriados': 'Holidays',
    'ajustes.sincronizacao': 'Synchronization',
    'ajustes.indisponivel_dev_pago': 'Unavailable — requires a paid developer account',
    'ajustes.avisos_agendados': '{n} of 60 alerts scheduled',

    // 9. Notificações
    'notificacao.prova_dias.titulo': 'Upcoming exam',
    'notificacao.prova_dias.corpo': 'Exam for {materia} in {n} days',
    'notificacao.entrega_amanha.titulo': 'Due tomorrow',
    'notificacao.entrega_amanha.corpo': 'Submission for {titulo} is due tomorrow',
    'notificacao.vence_horas.titulo': 'Deadline approaching',
    'notificacao.vence_horas.corpo': '{titulo} is due in {n} hours',
    'notificacao.acao.feito': 'Done',
    'notificacao.acao.adiar': 'Snooze 10 min',
  } as const,
} as const

type PT = typeof traducoes.pt
export type ChaveI18n = keyof PT

/**
 * Cria a função de tradução `t` para o idioma escolhido.
 * Caso uma chave falte em inglês, ela será exibida em português como fallback.
 */
export function criarT(idioma: Idioma) {
  return function t(chave: ChaveI18n, variaveis?: Record<string, string | number>): string {
    const mapa = (traducoes[idioma] ?? traducoes.pt) as Record<string, string>
    const ptMapa = traducoes.pt as Record<string, string>
    let str = mapa[chave] ?? ptMapa[chave] ?? chave
    if (variaveis) {
      for (const [k, v] of Object.entries(variaveis)) {
        str = str.split(`{${k}}`).join(String(v))
      }
    }
    return str
  }
}
