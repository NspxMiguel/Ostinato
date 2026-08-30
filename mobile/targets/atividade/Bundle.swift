import SwiftUI
import WidgetKit

@main
struct OstinatoAtividadeBundle: WidgetBundle {
  var body: some Widget {
    if #available(iOS 16.1, *) {
      OstinatoAtividade()
    }
  }
}
