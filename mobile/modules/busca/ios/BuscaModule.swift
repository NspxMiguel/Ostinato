import ExpoModulesCore
import CoreSpotlight
import MobileCoreServices
import UniformTypeIdentifiers

/**
 Poe os compromissos na busca do iPhone.

 Puxar para baixo na tela de inicio e digitar "trigonometria" acha a prova, e
 tocar abre ela — a mesma URL `ostinato://abrir?id=...` que a Siri e os Atalhos
 usam. E o jeito mais barato de o app aparecer onde a pessoa ja procura tudo, e
 nao custa uma tela nova nem um botao a mais.

 O indice inteiro e reescrito a cada chamada, e nao remendado. Um indice
 remendado guarda o que foi apagado: a pessoa apaga a prova, procura por ela na
 semana seguinte, acha, toca, e o app abre vazio. Reescrever custa milissegundos
 para algumas centenas de itens.
 */
public class BuscaModule: Module {
  private static let dominio = "dev.nspx.ostinato.compromissos"

  public func definition() -> ModuleDefinition {
    Name("Busca")

    Function("disponivel") { () -> Bool in
      CSSearchableIndex.isIndexingAvailable()
    }

    AsyncFunction("indexar") { (itens: [[String: Any]], promise: Promise) in
      guard CSSearchableIndex.isIndexingAvailable() else {
        promise.resolve(false)
        return
      }

      let indice = CSSearchableIndex.default()
      indice.deleteSearchableItems(withDomainIdentifiers: [Self.dominio]) { _ in
        let paraIndexar: [CSSearchableItem] = itens.compactMap { item in
          guard let id = item["id"] as? String, let titulo = item["titulo"] as? String
          else { return nil }

          let atributos = CSSearchableItemAttributeSet(contentType: UTType.text)
          atributos.title = titulo
          atributos.contentDescription = item["detalhe"] as? String
          // As palavras que a pessoa lembraria: a materia e o tipo. Sem isto,
          // procurar por "prova" nao acharia a prova.
          atributos.keywords = (item["palavras"] as? [String]) ?? []
          if let venceEm = item["venceEm"] as? Double {
            atributos.dueDate = Date(timeIntervalSince1970: venceEm)
          }

          let searchable = CSSearchableItem(
            uniqueIdentifier: id,
            domainIdentifier: Self.dominio,
            attributeSet: atributos
          )
          // O resultado some do indice quando o prazo passa e ninguem mais
          // procura por ele. Um mes depois do vencimento e generoso.
          if let venceEm = item["venceEm"] as? Double {
            searchable.expirationDate = Date(timeIntervalSince1970: venceEm + 30 * 24 * 3600)
          }
          return searchable
        }

        indice.indexSearchableItems(paraIndexar) { erro in
          if let erro {
            promise.reject("busca", erro.localizedDescription)
          } else {
            promise.resolve(true)
          }
        }
      }
    }

    AsyncFunction("limpar") { (promise: Promise) in
      CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [Self.dominio]) { _ in
        promise.resolve(true)
      }
    }
  }
}
