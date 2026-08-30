import ActivityKit
import SwiftUI
import WidgetKit

/**
 A Live Activity: a proxima entrega na tela de bloqueio e na Dynamic Island.

 A contagem regressiva usa `Text(date:style:.timer)` — quem conta os segundos e o
 sistema, e nao o app. Uma Live Activity nao acorda para atualizar um relogio: se
 o texto fosse calculado pelo app, ele congelaria no minuto em que foi criado.
 */
@available(iOS 16.1, *)
struct OstinatoAtividade: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: OstinatoAtributos.self) { contexto in
      // Tela de bloqueio
      HStack(alignment: .center, spacing: 12) {
        Capsule()
          .fill(cor(contexto.state.cor))
          .frame(width: 4, height: 38)
        VStack(alignment: .leading, spacing: 2) {
          Text(contexto.attributes.tipo.uppercased())
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
          Text(contexto.state.titulo)
            .font(.headline)
            .lineLimit(1)
          if !contexto.state.materia.isEmpty {
            Text(contexto.state.materia)
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
        Spacer(minLength: 8)
        Text(vencimento(contexto.state.venceEm), style: .timer)
          .font(.title3.monospacedDigit().weight(.semibold))
          .multilineTextAlignment(.trailing)
          .frame(maxWidth: 88)
      }
      .padding(16)
      .activityBackgroundTint(Color.black.opacity(0.55))
      .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { contexto in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label(contexto.attributes.tipo, systemImage: "graduationcap.fill")
            .font(.caption)
            .foregroundStyle(cor(contexto.state.cor))
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(vencimento(contexto.state.venceEm), style: .timer)
            .font(.caption.monospacedDigit())
            .frame(maxWidth: 64)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 2) {
            Text(contexto.state.titulo).font(.headline).lineLimit(1)
            if !contexto.state.materia.isEmpty {
              Text(contexto.state.materia).font(.caption).foregroundStyle(.secondary)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      } compactLeading: {
        Circle().fill(cor(contexto.state.cor)).frame(width: 8, height: 8)
      } compactTrailing: {
        Text(vencimento(contexto.state.venceEm), style: .timer)
          .font(.caption2.monospacedDigit())
          .frame(maxWidth: 44)
      } minimal: {
        Circle().fill(cor(contexto.state.cor)).frame(width: 8, height: 8)
      }
    }
  }

  private func vencimento(_ segundos: Double) -> Date {
    Date(timeIntervalSince1970: segundos)
  }

  /// "#RRGGBB" -> Color. Entrada estranha vira branco em vez de derrubar a view.
  private func cor(_ hex: String) -> Color {
    var texto = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if texto.hasPrefix("#") { texto.removeFirst() }
    guard texto.count == 6, let valor = UInt32(texto, radix: 16) else { return .white }
    return Color(
      red: Double((valor >> 16) & 0xFF) / 255,
      green: Double((valor >> 8) & 0xFF) / 255,
      blue: Double(valor & 0xFF) / 255
    )
  }
}
