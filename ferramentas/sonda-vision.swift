// O que o Vision REALMENTE devolve de uma foto de horário.
//
// Existe porque eu consertei a leitura três vezes no escuro e errei as três.
// Ele mandava a print do resultado, eu deduzia a causa e mudava o código sem
// nunca ter olhado a saída crua. Isto encerra o chute: roda a mesma pipeline do
// app, aqui no Mac, e imprime cada pedaço com a posição dele.
//
//   swift ferramentas/sonda-vision.swift <foto>
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count > 1, let imagem = NSImage(contentsOfFile: args[1]),
  let cg = imagem.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
  print("uso: swift sonda-vision.swift <foto>")
  exit(1)
}

let grupo = DispatchGroup()
grupo.enter()

let pedido = VNRecognizeTextRequest { req, _ in
  defer { grupo.leave() }
  let obs = req.results as? [VNRecognizedTextObservation] ?? []
  print("=== \(obs.count) pedaços ===")
  var pedacos: [(String, CGFloat, CGFloat, CGFloat, Float)] = []
  for o in obs {
    guard let m = o.topCandidates(1).first else { continue }
    let c = o.boundingBox
    pedacos.append((m.string, c.midY, c.minX, c.maxX, m.confidence))
  }
  // Ordenado como o app ordena: de cima para baixo.
  for p in pedacos.sorted(by: { $0.1 > $1.1 }) {
    print(String(format: "y=%.4f x=%.4f..%.4f conf=%.2f  %@", p.1, p.2, p.3, p.4, p.0))
  }

  // Os X distintos: é disto que as colunas são deduzidas.
  let xs = pedacos.map(\.2).sorted()
  var centros: [CGFloat] = xs.first.map { [$0] } ?? []
  for x in xs.dropFirst() where x - (centros.last ?? 0) > 0.04 { centros.append(x) }
  print("\n=== \(centros.count) colunas deduzidas ===")
  print(centros.map { String(format: "%.3f", $0) }.joined(separator: "  "))
}
pedido.recognitionLevel = .accurate
pedido.usesLanguageCorrection = false
pedido.recognitionLanguages = ["pt-BR", "en-US"]

try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([pedido])
grupo.wait()
