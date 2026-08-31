import ExpoModulesCore
import AlarmKit
import SwiftUI

/**
 O alarme DE VERDADE do iPhone — o barulhento, o do app Relógio.

 Isto corrige uma coisa que eu disse errado no comeco do projeto. Eu escrevi, e
 esta no README, que sem o entitlement de Critical Alerts nenhum app toca com o
 telefone no silencioso e o app fechado. Isso era verdade ATE o iOS 26.

 O iOS 26 trouxe o `AlarmKit`, e ele existe exatamente para isto: um app agenda
 um alarme de SISTEMA, que toca sozinho, alto, com a tela cheia do alarme, mesmo
 com o app fechado, no silencioso e com Foco ligado. Sem Critical Alerts, sem
 pedir nada a Apple.

 A diferenca que ele reclamou, e ela e exatamente essa: notificacao CHAMA a
 atencao e espera voce tocar; alarme TOCA. Ele marcou tarefa para as 7h13, passou
 das 7h13, e so chegou notificacao — o som so vinha depois de tocar nela, porque
 quem tocava era o app, e app fechado nao toca nada.

 O que continua valendo: `expo-notifications` segue cuidando dos avisos normais e
 insistentes. Alarme e outra coisa, e agora tem o mecanismo certo.
 */
public class AlarmeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AlarmeDoSistema")

    /// Se o aparelho tem AlarmKit.
    ///
    /// 26.1, e nao 26.0: o `AlarmManager` nasceu no 26.0, mas o inicializador
    /// da tela do alarme (`AlarmPresentation.Alert` com botao secundario) so
    /// chegou no 26.1 — e sem ele nao da para agendar nada. Marcar o modulo
    /// inteiro pela versao da peca que falta e mais honesto que marcar pela
    /// mais permissiva e quebrar na compilacao.
    Function("disponivel") { () -> Bool in
      if #available(iOS 26.1, *) { return true }
      return false
    }

    /**
     Pede a permissao de alarme.

     E uma permissao propria, separada da de notificacao: quem autorizou aviso
     nao autorizou acordar. Pedir na hora de agendar o primeiro alarme, e nao na
     abertura do app, e o que faz a pessoa entender o que esta concedendo.
     */
    AsyncFunction("permissao") { (promise: Promise) in
      guard #available(iOS 26.1, *) else {
        promise.resolve(false)
        return
      }
      Task {
        do {
          let estado = try await AlarmManager.shared.requestAuthorization()
          promise.resolve(estado == .authorized)
        } catch {
          promise.resolve(false)
        }
      }
    }

    /**
     Agenda um alarme de sistema para um instante.

     `quandoEmSegundos` e epoch, e nao uma duracao: o app ja sabe a hora exata do
     disparo, e converter para "daqui a tanto" perderia precisao a cada salto de
     horario de verao.
     */
    AsyncFunction("agendar") {
      (id: String, titulo: String, quandoEmSegundos: Double, promise: Promise) in
      guard #available(iOS 26.1, *) else {
        promise.reject("alarme", "AlarmKit exige iOS 26.1")
        return
      }
      guard let uuid = UUID(uuidString: id) else {
        promise.reject("alarme", "id precisa ser UUID")
        return
      }

      Task {
        do {
          _ = try await Self.armar(uuid: uuid, titulo: titulo, quando: quandoEmSegundos)
          promise.resolve(true)
        } catch {
          promise.reject("alarme", error.localizedDescription)
        }
      }
    }

    /// Cancela um alarme. Marcar a tarefa como feita tem que desarmar o despertador.
    ///
    /// Assincrono pelo mesmo motivo de `estadoDaPermissao`: o `AlarmManager` mora
    /// no `MainActor` e nao pode ser tocado da thread do JavaScript.
    AsyncFunction("cancelar") { (id: String, promise: Promise) in
      guard #available(iOS 26.1, *), let uuid = UUID(uuidString: id) else {
        promise.resolve(false)
        return
      }
      Task { @MainActor in
        do {
          try AlarmManager.shared.cancel(id: uuid)
          promise.resolve(true)
        } catch {
          promise.resolve(false)
        }
      }
    }

    /**
     O estado da autorizacao, em uma palavra.

     Existe para a tela conseguir mostrar "negado nos Ajustes" em vez de
     simplesmente nao tocar. Falha calada foi o defeito daqui.

     E ASSINCRONO, e isso nao e estilo: `AlarmManager` e isolado no `MainActor`,
     enquanto um `Function` do Expo roda direto na thread do JavaScript. Ler a
     propriedade de la derruba o processo na hora — foi o crash ao abrir Ajustes.
     O `AsyncFunction` com o salto explicito para o main e o que torna a leitura
     legal.
     */
    AsyncFunction("estadoDaPermissao") { (promise: Promise) in
      guard #available(iOS 26.1, *) else {
        promise.resolve("sem-suporte")
        return
      }
      Task { @MainActor in
        switch AlarmManager.shared.authorizationState {
        case .authorized: promise.resolve("autorizado")
        case .denied: promise.resolve("negado")
        default: promise.resolve("nao-perguntado")
        }
      }
    }

    /// Os ids agendados agora — é com isto que o app sincroniza sem duplicar.
    AsyncFunction("agendados") { (promise: Promise) in
      guard #available(iOS 26.1, *) else {
        promise.resolve([String]())
        return
      }
      Task { @MainActor in
        promise.resolve(((try? AlarmManager.shared.alarms) ?? []).map { $0.id.uuidString })
      }
    }
  }
}

@available(iOS 26.1, *)
struct MetadadosDoOstinato: AlarmMetadata {
  init() {}
}

extension AlarmeModule {
  /**
   O agendamento em si, numa função marcada.

   Fica separado porque o corpo de um `Task { }` NÃO herda o `#available` de
   quem o criou: o compilador o trata como contexto novo, e recusa a API. Marcar
   a função é o que devolve a disponibilidade para dentro do laço assíncrono.
   */
  /**
   Garante a autorizacao antes de agendar.

   Isto e o conserto do defeito que ele viu: o alarme nunca tocava, so chegava a
   notificacao. `AlarmManager.schedule` LANCA quando o app nao foi autorizado, o
   embrulho do lado do JavaScript engolia o erro e devolvia `false`, e o app caia
   no aviso normal — sem prompt, sem erro, sem nada na tela. Ninguem tinha como
   descobrir que faltava uma permissao que jamais foi pedida.

   Pedir aqui, e nao na abertura do app, e o certo pelo mesmo motivo de sempre:
   a pessoa entende o que esta concedendo quando o pedido chega junto do que ela
   acabou de fazer.
   */
  @available(iOS 26.1, *)
  static func autorizar() async throws {
    switch AlarmManager.shared.authorizationState {
    case .authorized:
      return
    case .denied:
      throw NSError(
        domain: "alarme", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "alarme negado nos Ajustes do iPhone"])
    default:
      let estado = try await AlarmManager.shared.requestAuthorization()
      guard estado == .authorized else {
        throw NSError(
          domain: "alarme", code: 2,
          userInfo: [NSLocalizedDescriptionKey: "alarme nao autorizado"])
      }
    }
  }

  @available(iOS 26.1, *)
  static func armar(uuid: UUID, titulo: String, quando: Double) async throws -> Alarm {
    try await autorizar()
    let alerta = AlarmPresentation.Alert(
      title: LocalizedStringResource(stringLiteral: titulo),
      secondaryButton: AlarmButton(text: "Adiar", textColor: .white, systemImageName: "clock"),
      secondaryButtonBehavior: .countdown)

    let atributos = AlarmAttributes<MetadadosDoOstinato>(
      presentation: AlarmPresentation(alert: alerta),
      metadata: MetadadosDoOstinato(),
      // O amarelo da marca: é a cor da tela cheia do alarme.
      tintColor: Color(red: 1, green: 0.839, blue: 0.039))

    let config = AlarmManager.AlarmConfiguration.alarm(
      schedule: .fixed(Date(timeIntervalSince1970: quando)), attributes: atributos)

    return try await AlarmManager.shared.schedule(id: uuid, configuration: config)
  }
}
