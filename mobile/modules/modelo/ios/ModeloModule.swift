import ExpoModulesCore
import FoundationModels

/**
 O modelo de linguagem que roda NO APARELHO (iOS 26+).

 Existe porque ele matou a ideia de chamar API, e estava certo: chave dentro de
 um app e extraivel em cinco minutos, e cota que estoura mata o app na mao de
 quem depende dele. Este modelo nao tem chave, nao tem cota, nao usa rede e
 funciona em modo aviao.

 O CONTRATO deste modulo, e ele importa mais que o codigo:

 O modelo e RESGATE, nunca o caminho normal. O algoritmo (`importarGrade`,
 `linguagem`) continua sendo quem lê; o modelo só entra quando a leitura falha —
 letra de mão, texto rasurado, tabela que não fechou. Foi ele quem separou os
 casos assim, e a separação é certa: para texto de computador e print o Vision
 já acerta, é determinístico e rápido, e enfiar um modelo em cima só adiciona
 chance de ele INVENTAR o que não estava na imagem.

 E o que entra aqui é o TEXTO do OCR, não a foto. Mais barato, e mantém o
 algoritmo como dono da leitura.
 */
public class ModeloModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ModeloLocal")

    /**
     Se dá para usar agora.

     Não basta o iOS 26: o modelo exige aparelho com Apple Intelligence ligado e
     o download concluído. Por isso a resposta é um MOTIVO, não um sim/não — a
     tela precisa saber a diferença entre "seu iPhone não tem" e "está baixando".
     */
    Function("estado") { () -> String in
      guard #available(iOS 26.0, *) else { return "ios-antigo" }
      switch SystemLanguageModel.default.availability {
      case .available:
        return "pronto"
      case .unavailable(let motivo):
        switch motivo {
        case .deviceNotEligible: return "aparelho-nao-suporta"
        case .appleIntelligenceNotEnabled: return "apple-intelligence-desligada"
        case .modelNotReady: return "baixando"
        @unknown default: return "indisponivel"
        }
      }
    }

    /**
     Manda um texto e devolve a resposta crua.

     Sem streaming de propósito: quem chama é uma importação que já mostra
     "lendo…", e resposta parcial de uma tabela é pior que esperar — a pessoa
     veria linhas aparecendo e mudando.
     */
    AsyncFunction("perguntar") { (instrucoes: String, entrada: String, promise: Promise) in
      guard #available(iOS 26.0, *), SystemLanguageModel.default.isAvailable else {
        promise.reject("modelo", "modelo local indisponivel")
        return
      }
      Task {
        do {
          let sessao = LanguageModelSession(instructions: instrucoes)
          let resposta = try await sessao.respond(to: entrada)
          promise.resolve(resposta.content)
        } catch {
          // Falhar aqui NÃO pode derrubar a importação: quem chama cai de volta
          // no que o algoritmo já tinha lido.
          promise.reject("modelo", error.localizedDescription)
        }
      }
    }
  }
}
