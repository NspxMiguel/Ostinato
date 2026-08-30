import SwiftUI
import WidgetKit

@main
struct GizAtividadeBundle: WidgetBundle {
  var body: some Widget {
    if #available(iOS 16.1, *) {
      GizAtividade()
    }
  }
}
