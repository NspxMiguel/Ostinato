// O texto legal, num lugar só — política de privacidade e termos de uso,
// alcançáveis de DENTRO do app (Ajustes → Sobre), não só num site.
//
// Duas lojas de app e a LGPD exigem isso: a política tem que estar acessível
// pelo próprio app, e precisa bater com o que o app REALMENTE faz — nada de
// texto genérico copiado de outro projeto. O que está escrito aqui reflete o
// estado real do Ostinato hoje (04/09/2026): tudo fica no aparelho, nenhum
// dado sai dele. Se um dia entrar telemetria, sync por nuvem, ou qualquer
// coisa que mande dado pra fora — ESTE arquivo muda no mesmo commit, e o
// PrivacyInfo.xcprivacy (mobile/ios/Ostinato/PrivacyInfo.xcprivacy) também.
//
// Espanhol e francês caem no inglês por enquanto: texto legal mal traduzido é
// pior que não ter — errar uma cláusula muda o que o titular está aceitando.
// Português e inglês têm texto próprio porque são as duas línguas que ele
// pediu desde a primeira tela.

export type TipoLegal = 'privacidade' | 'termos'

export type Secao = { titulo: string; paragrafos: string[] }
export type DocumentoLegal = { atualizadoEm: string; introducao: string; secoes: Secao[] }

/** O e-mail de suporte visível no app — contato público dele, pedido em
 * 04/09/2026. O controlador legal continua sendo a Keepok (ver `CONTROLADOR`
 * abaixo); este é só o endereço que responde dúvida de quem usa o app. */
export const EMAIL_SUPORTE = 'miguel@nspx.dev'

/** Controlador dos dados (LGPD art. 9). App de loja é sempre Keepok, nunca
 * pessoa física — é a mesma regra do CLAUDE.md, e o motivo é o mesmo: um
 * processo cai na empresa, não na pessoa. */
const CONTROLADOR = 'Keepok'

const DOCS: Record<'pt' | 'en', Record<TipoLegal, DocumentoLegal>> = {
  pt: {
    privacidade: {
      atualizadoEm: 'Setembro de 2026',
      introducao:
        'O Ostinato foi feito para funcionar sem mandar seus dados pra fora do aparelho. Esta política diz exatamente o que isso significa na prática.',
      secoes: [
        {
          titulo: 'O que fica só no seu aparelho',
          paragrafos: [
            'Matérias, aulas, tarefas, provas, notas, faltas, período letivo e todo o resto que você cadastra ficam guardados localmente no seu iPhone. Nada disso é enviado a nenhum servidor — o app não tem backend.',
            'Se você apagar o app, esses dados somem junto. Não existe cópia em nenhum outro lugar até que a sincronização por nuvem (ver abaixo) esteja ligada.',
          ],
        },
        {
          titulo: 'IA no aparelho, não na nuvem',
          paragrafos: [
            'Quando o app usa inteligência artificial para ler um horário fotografado ou entender uma frase confusa, isso acontece com o modelo local da Apple Intelligence, dentro do próprio iPhone. Nenhum texto ou imagem seu é enviado a um serviço de IA externo.',
          ],
        },
        {
          titulo: 'Sincronização por iCloud (ainda não ligada)',
          paragrafos: [
            'O Ostinato tem suporte para sincronizar seus dados entre aparelhos pelo iCloud (CloudKit), usando a sua própria conta Apple. Essa função ainda não está ativa nesta versão. Quando for ativada, os dados continuam sendo seus — ficam no seu banco privado do iCloud, e nem a Apple nem o desenvolvedor do Ostinato têm acesso a eles.',
          ],
        },
        {
          titulo: 'Notificações e alarmes',
          paragrafos: [
            'Os avisos de tarefa e prova são agendados localmente no seu aparelho (notificações e, quando disponível, alarmes do sistema). Isso não envolve nenhum servidor.',
          ],
        },
        {
          titulo: 'Relatório de erro (diagnóstico)',
          paragrafos: [
            'Quando o app trava ou encontra um erro inesperado, ele pode enviar um relatório técnico curto para o servidor do desenvolvedor: a mensagem de erro, em qual parte do app aconteceu, a versão do app, e um identificador aleatório do aparelho (não é ligado à sua conta Apple nem a você).',
            'Esse relatório NUNCA inclui o conteúdo que você digitou ou fotografou — nome de matéria, título de tarefa, texto de foto. Ele existe só para o desenvolvedor achar e corrigir bugs.',
          ],
        },
        {
          titulo: 'Ajudar a melhorar a leitura (opcional, desligado por padrão)',
          paragrafos: [
            'Em Ajustes, existe um interruptor chamado "Ajudar a melhorar a leitura", desligado por padrão. Quando você o LIGA, e só a partir daí: se você escolher a matéria certa numa grade que a abreviação não reconheceu, essa correção — o nome que você usou e o nome real da matéria — é enviada ao servidor do desenvolvedor.',
            'Isso serve só para melhorar o reconhecimento de horários nas próximas versões do app, e não fica ligado a você: não vai identificador de aparelho junto, não vai nome de aluno nem de escola a menos que a própria correção mencione isso no texto. Você pode desligar a qualquer momento.',
          ],
        },
        {
          titulo: 'O que o app NÃO faz',
          paragrafos: [
            'O Ostinato não coleta identificadores de publicidade, não tem analytics de terceiros, não vende nem compartilha dado nenhum com ninguém, e não rastreia você entre outros apps ou sites. O relatório de erro e o interruptor opcional acima são as duas únicas coisas que podem sair do aparelho — e a segunda só existe quando você a liga.',
          ],
        },
        {
          titulo: 'Controlador dos dados e contato',
          paragrafos: [
            `O controlador dos dados, para efeito da Lei Geral de Proteção de Dados (LGPD), é a ${CONTROLADOR}. Como todo o processamento acontece no seu próprio aparelho, a Keepok não tem acesso aos seus dados — só você tem.`,
            `Dúvida, pedido de exclusão de dados ou qualquer outro assunto sobre privacidade: ${EMAIL_SUPORTE}.`,
          ],
        },
      ],
    },
    termos: {
      atualizadoEm: 'Setembro de 2026',
      introducao: 'Termos simples, para um app simples: sem conta, sem assinatura, sem letra miúda.',
      secoes: [
        {
          titulo: 'O que é o Ostinato',
          paragrafos: [
            'Um app pessoal de organização escolar: horário de aulas, tarefas, provas, notas e faltas. Não substitui o diário oficial da escola nem qualquer sistema acadêmico — é uma ferramenta de apoio.',
          ],
        },
        {
          titulo: 'Sem garantia de precisão',
          paragrafos: [
            'A leitura automática de horários (foto ou texto colado) e o cálculo de datas ("próxima aula de X") são feitos por algoritmo e, quando necessário, por um modelo de IA local — ambos podem errar. Confira sempre uma data importante antes de contar com o aviso do app.',
          ],
        },
        {
          titulo: 'Uso por conta própria',
          paragrafos: [
            'O app é fornecido "como está". O responsável pelo Ostinato não se responsabiliza por prova perdida, tarefa esquecida ou qualquer prejuízo decorrente do uso do app — ele é uma ferramenta de apoio, não uma garantia.',
          ],
        },
        {
          titulo: 'Seus dados continuam seus',
          paragrafos: [
            'Como descrito na Política de Privacidade, os dados que você cadastra ficam no seu aparelho (e, quando a sincronização estiver ativa, no seu próprio iCloud). Você pode apagar tudo a qualquer momento em Ajustes.',
          ],
        },
        {
          titulo: 'Contato',
          paragrafos: [`Dúvida sobre estes termos: ${EMAIL_SUPORTE}.`],
        },
      ],
    },
  },
  en: {
    privacidade: {
      atualizadoEm: 'September 2026',
      introducao:
        'Ostinato was built to work without sending your data anywhere. This policy says exactly what that means in practice.',
      secoes: [
        {
          titulo: 'What stays only on your device',
          paragrafos: [
            'Subjects, classes, tasks, exams, grades, absences, term dates and everything else you enter stay stored locally on your iPhone. None of it is sent to any server — the app has no backend.',
            'If you delete the app, that data is gone with it. There is no copy anywhere else until cloud sync (below) is turned on.',
          ],
        },
        {
          titulo: 'On-device AI, not the cloud',
          paragrafos: [
            "When the app uses AI to read a photographed schedule or make sense of a confusing sentence, it runs on Apple Intelligence's on-device model, inside your own iPhone. No text or image of yours is sent to an external AI service.",
          ],
        },
        {
          titulo: 'iCloud sync (not yet enabled)',
          paragrafos: [
            'Ostinato supports syncing your data across devices via iCloud (CloudKit), using your own Apple account. This feature is not active in this version. Once enabled, your data stays yours — it lives in your private iCloud database, and neither Apple nor the Ostinato developer can access it.',
          ],
        },
        {
          titulo: 'Notifications and alarms',
          paragrafos: [
            'Task and exam reminders are scheduled locally on your device (notifications and, where available, system alarms). No server is involved.',
          ],
        },
        {
          titulo: 'Error reports (diagnostics)',
          paragrafos: [
            "When the app crashes or hits an unexpected error, it may send a short technical report to the developer's server: the error message, which part of the app it happened in, the app version, and a random device identifier (not linked to your Apple account or to you).",
            'This report NEVER includes what you typed or photographed — subject names, task titles, scanned text. It exists only so the developer can find and fix bugs.',
          ],
        },
        {
          titulo: 'Help improve recognition (optional, off by default)',
          paragrafos: [
            'Settings has a switch called "Help improve recognition", off by default. When you TURN IT ON, and only from then on: if you pick the right subject in a timetable an abbreviation didn\'t recognize, that correction — the name you used and the subject\'s real name — is sent to the developer\'s server.',
            "This is only used to improve timetable recognition in future versions of the app, and isn't linked to you: no device identifier goes with it, and no student or school name goes with it unless the correction text itself mentions one. You can turn it off at any time.",
          ],
        },
        {
          titulo: "What the app does NOT do",
          paragrafos: [
            "Ostinato does not collect advertising identifiers, has no third-party analytics, does not sell or share any data with anyone, and does not track you across other apps or websites. The error report and the optional switch above are the only two things that can leave the device — and the second only exists once you turn it on.",
          ],
        },
        {
          titulo: 'Data controller and contact',
          paragrafos: [
            `The data controller is ${CONTROLADOR}. Since all processing happens on your own device, Keepok has no access to your data — only you do.`,
            `Questions, data deletion requests, or anything else about privacy: ${EMAIL_SUPORTE}.`,
          ],
        },
      ],
    },
    termos: {
      atualizadoEm: 'September 2026',
      introducao: 'Simple terms for a simple app: no account, no subscription, no fine print.',
      secoes: [
        {
          titulo: 'What Ostinato is',
          paragrafos: [
            "A personal school-organization app: class schedule, tasks, exams, grades and absences. It does not replace your school's official records or any academic system — it's a support tool.",
          ],
        },
        {
          titulo: 'No accuracy guarantee',
          paragrafos: [
            'Automatic schedule reading (photo or pasted text) and date resolution ("next class of X") are done by an algorithm and, when needed, a local AI model — both can make mistakes. Always double-check anything important before relying on the app\'s reminder.',
          ],
        },
        {
          titulo: 'Use at your own risk',
          paragrafos: [
            'The app is provided "as is". Whoever is responsible for Ostinato is not liable for a missed exam, a forgotten task, or any harm resulting from using the app — it is a support tool, not a guarantee.',
          ],
        },
        {
          titulo: 'Your data stays yours',
          paragrafos: [
            'As described in the Privacy Policy, the data you enter stays on your device (and, once sync is active, in your own iCloud). You can delete everything at any time in Settings.',
          ],
        },
        {
          titulo: 'Contact',
          paragrafos: [`Questions about these terms: ${EMAIL_SUPORTE}.`],
        },
      ],
    },
  },
}

export function documentoLegal(tipo: TipoLegal, idioma: string): DocumentoLegal {
  const lang = idioma === 'pt' ? 'pt' : 'en'
  return DOCS[lang][tipo]
}
