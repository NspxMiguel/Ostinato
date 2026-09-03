import ExpoModulesCore
import Vision
import UIKit

/**
 Le o texto de uma foto do horario escolar.

 Usa o Vision da Apple, que roda no proprio aparelho: nao custa nada, funciona
 sem internet, e a foto do horario da escola nao sai do telefone. Servico de OCR
 na nuvem cobraria por imagem e mandaria embora um documento que traz o nome da
 escola e da turma.

 O modulo devolve LINHAS DE TEXTO, e nao uma grade pronta: quem entende de
 horario e o `importarGrade` do nucleo, que e TypeScript puro e tem teste. O
 Swift aqui so enxerga.
 */
public class LeituraModule: Module {
  public func definition() -> ModuleDefinition {
    /**
     Le a imagem como DOCUMENTO, devolvendo a tabela em linhas e celulas.

     Isto existe por causa de uma reclamacao dele em 31/08/2026: *"escanear com
     ia ta legal nao pae, ainda pego tudo errado. tem q ser uma ia q realmente
     ve, a da apple n ve, tem q ver nao so tentar traduzir oq o coiso do iphone
     ja viu"*.

     Ele esta certo no diagnostico e o defeito era meu. O `VNRecognizeTextRequest`
     devolve pedacos soltos com posicao, e eu os achatava em linhas separadas por
     TAB usando uma tolerancia vertical fixa. Horario escolar e uma GRADE: com
     celula mesclada, altura de linha irregular e coluna estreita, essa tolerancia
     erra — e o que chegava ao modelo ja era sopa. Nao adiantava o modelo ser bom.

     O `RecognizeDocumentsRequest` do iOS 26 detecta a tabela e devolve
     `rows: [[Cell]]`. Quem enxerga a grade e o Vision, que e o que ele quis
     dizer com "uma ia q realmente ve" — a estrutura vem de quem olhou o pixel,
     e nao de uma heuristica minha em cima do texto ja perdido.
     */
    AsyncFunction("lerTabela") { (uri: String, promise: Promise) in
      guard #available(iOS 26.0, *) else {
        promise.resolve([[String]]())
        return
      }
      Task {
        do {
          guard let url = URL(string: uri), let dados = try? Data(contentsOf: url),
            let imagem = UIImage(data: dados), let cg = imagem.cgImage
          else {
            promise.resolve([[String]]())
            return
          }
          var pedido = RecognizeDocumentsRequest()
          pedido.textRecognitionOptions.recognitionLanguages = [
            Locale.Language(identifier: "pt-BR"), Locale.Language(identifier: "en-US"),
          ]
          let documentos = try await pedido.perform(on: cg)

          // A MAIOR tabela da pagina. Uma foto de horario costuma trazer o
          // quadro e, as vezes, um bloco de legenda que tambem vira tabela.
          var melhor: [[String]] = []
          for doc in documentos {
            for tabela in doc.document.tables {
              let linhas = tabela.rows.map { linha in
                linha.map { $0.content.text.transcript.trimmingCharacters(in: .whitespacesAndNewlines) }
              }
              if linhas.flatMap({ $0 }).count > melhor.flatMap({ $0 }).count { melhor = linhas }
            }
          }
          promise.resolve(melhor)
        } catch {
          // Falhar aqui nao pode derrubar a importacao: quem chama volta para o
          // caminho antigo, que le o texto solto.
          promise.resolve([[String]]())
        }
      }
    }

    Name("Leitura")

    AsyncFunction("lerTexto") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri),
            let dados = try? Data(contentsOf: url),
            let imagem = UIImage(data: dados),
            let cg = imagem.cgImage
      else {
        promise.reject("imagem", "nao consegui abrir a imagem em \(uri)")
        return
      }

      let pedido = VNRecognizeTextRequest { requisicao, erro in
        if let erro {
          promise.reject("vision", erro.localizedDescription)
          return
        }
        let observacoes = requisicao.results as? [VNRecognizedTextObservation] ?? []

        // O Vision devolve cada pedaco com a posicao dele. Um horario e uma
        // TABELA: sem reagrupar por linha, "07:00", "MAT" e "PORT" chegam como
        // tres resultados soltos e o parser nao tem como saber que sao a mesma
        // linha do quadro.
        let pedacos: [(texto: String, y: CGFloat, x: CGFloat, confianca: Float)] =
          observacoes.compactMap {
            guard let melhor = $0.topCandidates(1).first else { return nil }
            let caixa = $0.boundingBox
            return (melhor.string, caixa.midY, caixa.minX, melhor.confidence)
          }

        // A confianca media, ponderada pelo TAMANHO do pedaco.
        //
        // E ela que separa "print de computador" de "letra de mao ou rasura", que
        // e a condicao que ele deu para a IA local entrar. Ponderar pelo tamanho
        // importa: uma tabela boa costuma ter um ou dois respingos ilegiveis de
        // uma letra so, e a media simples afundaria por causa deles.
        let peso = pedacos.reduce(0) { $0 + $1.texto.count }
        let soma = pedacos.reduce(Float(0)) { $0 + $1.confianca * Float($1.texto.count) }
        let confianca = peso > 0 ? soma / Float(peso) : 0

        // Tolerancia vertical proporcional: 1,2% da altura junta o que esta na
        // mesma linha sem colar duas linhas vizinhas de uma tabela apertada.
        let tolerancia: CGFloat = 0.012
        var linhas: [[(texto: String, y: CGFloat, x: CGFloat, confianca: Float)]] = []
        for pedaco in pedacos.sorted(by: { $0.y > $1.y }) {
          if let ultimaY = linhas.last?.first?.y, abs(ultimaY - pedaco.y) < tolerancia {
            linhas[linhas.count - 1].append(pedaco)
          } else {
            linhas.append([pedaco])
          }
        }

        // Separador de TAB entre colunas: e o que o `importarGrade` reconhece
        // como tabela, e o que um horario copiado de PDF tambem usa.
        let texto = linhas
          .map { $0.sorted { $0.x < $1.x }.map(\.texto).joined(separator: "\t") }
          .joined(separator: "\n")

        promise.resolve([
          "texto": texto,
          "linhas": linhas.count,
          "pedacos": pedacos.count,
          "confianca": Double(confianca),
        ])
      }

      pedido.recognitionLevel = .accurate
      pedido.usesLanguageCorrection = false // nome de materia abreviado nao e palavra
      pedido.recognitionLanguages = ["pt-BR", "en-US"]

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try VNImageRequestHandler(cgImage: cg, options: [:]).perform([pedido])
        } catch {
          promise.reject("vision", error.localizedDescription)
        }
      }
    }

    Function("disponivel") { () -> Bool in true }
  }
}
