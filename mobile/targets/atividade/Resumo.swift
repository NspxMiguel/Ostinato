import SwiftUI
import WidgetKit

/**
 O widget de tela de inicio: o que vence primeiro, sem abrir o app.

 Por que ele e um `StaticConfiguration` e a Live Activity nao: a galeria de
 widgets so lista `StaticConfiguration` e `AppIntentConfiguration`. Uma
 `ActivityConfiguration` nunca aparece la — ela existe so na tela de bloqueio e na
 Dynamic Island. Ate 30/08/2026 este alvo tinha apenas a Live Activity, e por isso
 o widget "nao aparecia": ele nao existia.

 De onde vem o dado: o widget roda em outro processo, com outro sandbox. Ele nao
 enxerga o armazenamento do app. O app escreve um resumo em JSON no `UserDefaults`
 do App Group e pede recarga; aqui a gente so le. Se o grupo faltar em qualquer um
 dos dois alvos, esta leitura devolve nil e o widget desenha o estado vazio — sem
 erro, sem aviso. E o modo de falha mais silencioso deste arquivo.
 */

// MARK: - O que o app deposita

private let GRUPO = "group.com.ostinato.app"
private let CHAVE = "resumo"

struct ItemDoResumo: Codable, Identifiable {
  var id: String
  var titulo: String
  var materia: String
  var tipo: String
  /// Epoch em segundos. O widget formata; o app nao manda texto pronto porque o
  /// idioma e o fuso de quem le sao decididos aqui.
  var venceEm: Double
  /// "#RRGGBB" da materia.
  var cor: String
  /// true quando ja passou da hora.
  var atrasado: Bool
}

struct Resumo: Codable {
  var itens: [ItemDoResumo]
  var atualizadoEm: Double

  static let vazio = Resumo(itens: [], atualizadoEm: 0)

  static func ler() -> Resumo {
    guard
      let defaults = UserDefaults(suiteName: GRUPO),
      let bruto = defaults.string(forKey: CHAVE),
      let dados = bruto.data(using: .utf8),
      let lido = try? JSONDecoder().decode(Resumo.self, from: dados)
    else { return .vazio }
    return lido
  }
}

// MARK: - Linha do tempo

struct EntradaDoResumo: TimelineEntry {
  let date: Date
  let resumo: Resumo
}

struct ProvedorDoResumo: TimelineProvider {
  func placeholder(in context: Context) -> EntradaDoResumo {
    EntradaDoResumo(date: Date(), resumo: .vazio)
  }

  func getSnapshot(in context: Context, completion: @escaping (EntradaDoResumo) -> Void) {
    completion(EntradaDoResumo(date: Date(), resumo: Resumo.ler()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<EntradaDoResumo>) -> Void) {
    let resumo = Resumo.ler()
    let agora = Date()

    // Uma entrada agora, e recargas nos momentos em que o texto MUDA por conta do
    // relogio — a virada de cada item para "atrasado" — em vez de um intervalo
    // fixo. Widget que recarrega de hora em hora gasta orcamento do sistema para
    // redesenhar a mesma coisa; e o sistema corta quem faz isso.
    var marcos: [Date] = resumo.itens
      .map { Date(timeIntervalSince1970: $0.venceEm) }
      .filter { $0 > agora }
      .sorted()
      .prefix(4)
      .map { $0 }

    // Uma rede de seguranca: mesmo sem nada vencendo, revisitar a meia-noite,
    // porque "hoje" e "amanha" mudam de significado ali.
    if let meiaNoite = Calendar.current.nextDate(
      after: agora, matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime
    ) {
      marcos.append(meiaNoite)
    }

    let entradas = ([agora] + marcos).sorted().map {
      EntradaDoResumo(date: $0, resumo: resumo)
    }
    completion(Timeline(entries: entradas, policy: .atEnd))
  }
}

// MARK: - Desenho

struct LinhaDoItem: View {
  let item: ItemDoResumo
  let compacto: Bool

  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      Capsule()
        .fill(corDaMateria)
        .frame(width: 3, height: compacto ? 26 : 30)

      VStack(alignment: .leading, spacing: 1) {
        Text(item.titulo)
          .font(compacto ? .caption.weight(.semibold) : .subheadline.weight(.semibold))
          .lineLimit(1)
        Text(legenda)
          .font(.caption2)
          .foregroundStyle(item.atrasado ? Color.red : Color.secondary)
          .lineLimit(1)
      }
      Spacer(minLength: 0)
    }
  }

  /// "Matemática · amanhã, 13:30" — e so a data quando nao ha materia.
  private var legenda: String {
    let quando = Date(timeIntervalSince1970: item.venceEm)
      .formatted(.dateTime.weekday(.abbreviated).hour().minute())
    return item.materia.isEmpty ? quando : "\(item.materia) · \(quando)"
  }

  private var corDaMateria: Color {
    var texto = item.cor.trimmingCharacters(in: .whitespacesAndNewlines)
    if texto.hasPrefix("#") { texto.removeFirst() }
    guard texto.count == 6, let valor = UInt32(texto, radix: 16) else { return .white }
    return Color(
      red: Double((valor >> 16) & 0xFF) / 255,
      green: Double((valor >> 8) & 0xFF) / 255,
      blue: Double(valor & 0xFF) / 255
    )
  }
}

struct SemNada: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Ostinato")
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
      Text("Nada pendente")
        .font(.subheadline.weight(.semibold))
      Spacer(minLength: 0)
    }
  }
}

struct VistaDoResumo: View {
  @Environment(\.widgetFamily) private var familia
  let entrada: EntradaDoResumo

  private var quantos: Int { familia == .systemSmall ? 2 : 4 }

  var body: some View {
    Group {
      if entrada.resumo.itens.isEmpty {
        SemNada()
      } else {
        VStack(alignment: .leading, spacing: familia == .systemSmall ? 6 : 8) {
          ForEach(entrada.resumo.itens.prefix(quantos)) { item in
            LinhaDoItem(item: item, compacto: familia == .systemSmall)
          }
          Spacer(minLength: 0)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    // `containerBackground` e obrigatorio a partir do iOS 17: sem ele o widget
    // aparece na galeria e desenha em branco na tela de inicio.
    .containerBackground(.fill.tertiary, for: .widget)
    // Tocar em qualquer lugar abre o app na aba certa.
    .widgetURL(URL(string: "ostinato://hoje"))
  }
}

// MARK: - O widget

struct ResumoWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OstinatoResumo", provider: ProvedorDoResumo()) { entrada in
      VistaDoResumo(entrada: entrada)
    }
    .configurationDisplayName("Ostinato")
    .description("O que vence primeiro.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
