import ExpoModulesCore
import FoundationModels

/**
 O modelo de linguagem que roda NO APARELHO (iOS 26+).

 Existe porque ele matou a ideia de chamar API, e estava certo: chave dentro de
 um app e extraivel em cinco minutos, e cota que estoura mata o app na mao de
 quem depende dele. Este modelo nao tem chave, nao tem cota, nao usa rede e
 funciona em modo aviao.

 O CONTRATO deste modulo mudou em 30/08/2026, e a mudanca foi dele:
 *"coloca logo a merda da ia local para interpretar foto, n funciona por
 algoritmo nao"*.

 Antes o modelo era RESGATE — so entrava quando o algoritmo falhava de um jeito
 especifico. Estava errado, e o motivo e simples: horario escolar nao tem
 formato. Cada escola imprime do seu jeito, com celula mesclada, materia
 abreviada, intervalo no meio e coluna que nao fecha. Regex acerta o formato que
 eu previ e erra todo o resto, e a pessoa nao tem como saber qual dos dois caiu
 pra ela.

 Agora o modelo e o LEITOR, e o algoritmo e a rede de seguranca embaixo dele.

 O que continua valendo: entra o TEXTO do OCR, nao a foto. Nao e escolha minha —
 o `SystemLanguageModel` do iOS 26 nao le imagem. Quem le pixel e o Vision, que
 e otimo nisso; o que faltava era alguem para ENTENDER o que o Vision leu.

 E a saida e TIPADA (`@Generable`), nao texto livre. Com geracao guiada o
 modelo nao consegue devolver algo fora do formato, entao some a etapa mais
 fragil do desenho anterior: eu pedir uma tabela em texto e reprocessar com
 regex a resposta dele.
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
     Le um horario escolar a partir do texto que o OCR devolveu.

     A saida e guiada pelo tipo: o modelo nao consegue responder fora do formato,
     e cada campo carrega a descricao do que ele significa. Isso vale mais que
     instrucao em prosa para um modelo pequeno — o `dia` volta como numero
     porque "seg", "2a" e "Monday" sao a mesma coisa e converter isso do lado do
     JavaScript seria reintroduzir o parser que este modulo veio substituir.
     */
    AsyncFunction("lerGrade") { (texto: String, promise: Promise) in
      guard #available(iOS 26.0, *), SystemLanguageModel.default.isAvailable else {
        promise.reject("modelo", "modelo local indisponivel")
        return
      }
      Task {
        do {
          let sessao = LanguageModelSession(instructions: Self.INSTRUCOES_DE_GRADE)
          // O texto e cortado: o modelo tem janela limitada, e horario de OCR
          // vem com cabecalho, rodape e nome de escola que nao dizem nada.
          let entrada = String(texto.prefix(4000))
          let r = try await sessao.respond(to: entrada, generating: GradeLida.self)
          promise.resolve(
            r.content.aulas.map {
              [
                "dia": $0.dia, "inicio": $0.inicio, "fim": $0.fim, "materia": $0.materia,
              ] as [String: Any]
            })
        } catch {
          promise.reject("modelo", error.localizedDescription)
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

  static let INSTRUCOES_DE_GRADE = """
    Voce le o texto bruto de um horario escolar que foi fotografado.
    O texto vem de OCR: as colunas podem estar embaralhadas e as linhas quebradas.
    Devolva uma aula por celula do quadro.
    Regras:
    - dia: 1 para segunda-feira ate 7 para domingo;
    - inicio e fim sempre em HH:MM de 24 horas;
    - materia: o nome como esta escrito, sem expandir abreviacao que voce nao tenha certeza;
    - ignore intervalo, recreio, almoco, cabecalho, nome da escola e rodape;
    - NAO invente aula, horario nem materia que nao esteja no texto;
    - celula vazia nao vira aula.
    """
}

/// Uma aula lida pelo modelo. As descricoes sao parte do prompt.
@available(iOS 26.0, *)
@Generable
struct AulaLida {
  @Guide(description: "Dia da semana: 1 para segunda-feira ate 7 para domingo")
  var dia: Int
  @Guide(description: "Hora de inicio, sempre HH:MM em 24 horas")
  var inicio: String
  @Guide(description: "Hora de fim, sempre HH:MM em 24 horas")
  var fim: String
  @Guide(description: "Nome da materia como esta escrito no quadro")
  var materia: String
}

@available(iOS 26.0, *)
@Generable
struct GradeLida {
  var aulas: [AulaLida]
}
