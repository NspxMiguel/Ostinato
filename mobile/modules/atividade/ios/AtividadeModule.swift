import ExpoModulesCore
import ActivityKit
import WidgetKit

/**
 Liga e desliga a Live Activity da proxima entrega.

 Live Activity NAO precisa de App Group: o conteudo viaja do app para a extensao
 pelo proprio ActivityKit, em processo. Widget de tela de inicio precisaria de um
 App Group para ler os dados — e por isso ele nao esta aqui ainda.

 (Uma correcao honesta: eu escrevi antes que "conta gratuita nao emite App Group".
 Isso NAO foi medido por mim, e outra sessao mediu o contrario num projeto irmao
 em 30/08/2026 — o perfil nasceu com o App Group numa conta gratuita, depois de um
 archive pela interface do Xcode. O que esta medido aqui e outra coisa: o
 `xcodebuild` nao CRIA perfil, so usa o que ja esta em cache, e por isso capability
 nova falha na linha de comando com mensagem que parece recusa da Apple.)

 Uma atividade por vez, de proposito: sao "a proxima entrega", nao uma lista. Tres
 delas empilhadas na tela de bloqueio seriam ruido, e ruido e o que faz a pessoa
 desligar o aviso.
 */
public class AtividadeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Atividade")

    Function("disponivel") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("mostrar") {
      (tipo: String, titulo: String, materia: String, venceEm: Double, cor: String,
       promise: Promise) in
      guard #available(iOS 16.2, *) else {
        promise.reject("versao", "Live Activity precisa de iOS 16.2")
        return
      }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        promise.reject("desligado", "o usuario desativou Atividades ao Vivo")
        return
      }

      let estado = GizAtributos.ContentState(
        titulo: titulo, materia: materia, venceEm: venceEm, cor: cor)

      // Ja existe uma? Atualiza em vez de abrir outra: pedir uma nova a cada
      // recalculo encheria a tela de bloqueio de copias do mesmo aviso.
      if let atual = Activity<GizAtributos>.activities.first {
        Task {
          await atual.update(
            ActivityContent(state: estado, staleDate: Date(timeIntervalSince1970: venceEm)))
          promise.resolve(atual.id)
        }
        return
      }

      do {
        let atividade = try Activity.request(
          attributes: GizAtributos(tipo: tipo),
          content: ActivityContent(
            state: estado, staleDate: Date(timeIntervalSince1970: venceEm)),
          pushType: nil // sem push remoto: conta gratuita nao assina push
        )
        promise.resolve(atividade.id)
      } catch {
        promise.reject("atividade", error.localizedDescription)
      }
    }

    /**
     Deposita o resumo que o widget de tela de inicio le, e pede recarga.

     O widget roda em outro processo e nao enxerga o armazenamento do app. O unico
     canal e o container do App Group — por isso o grupo precisa estar nos DOIS
     alvos. Se ele faltar em um deles, `UserDefaults(suiteName:)` devolve nil, esta
     funcao retorna false, e o widget desenha vazio sem erro nenhum. E por isso que
     ela devolve Bool em vez de nao devolver nada: e o unico sinal que o lado JS
     tem de que o canal existe.
     */
    Function("salvarResumo") { (json: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: "group.com.ostinato.app") else {
        return false
      }
      defaults.set(json, forKey: "resumo")
      WidgetCenter.shared.reloadAllTimelines()
      return true
    }

    AsyncFunction("esconder") { (promise: Promise) in
      guard #available(iOS 16.2, *) else {
        promise.resolve(0)
        return
      }
      let atividades = Activity<GizAtributos>.activities
      Task {
        for a in atividades {
          await a.end(nil, dismissalPolicy: .immediate)
        }
        promise.resolve(atividades.count)
      }
    }
  }
}
