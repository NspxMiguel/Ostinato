import SwiftUI
import WidgetKit

/**
 O que a extensao publica. Sao DUAS coisas, e a diferenca importa:

   ResumoWidget      StaticConfiguration   -> aparece na GALERIA de widgets
   OstinatoAtividade ActivityConfiguration -> tela de bloqueio e Dynamic Island

 Ate 30/08/2026 so a segunda existia aqui, e por isso o widget nao aparecia na
 galeria: nao era permissao nem assinatura, era ausencia.
 */
@main
struct OstinatoAtividadeBundle: WidgetBundle {
  var body: some Widget {
    ResumoWidget()
    if #available(iOS 16.1, *) {
      OstinatoAtividade()
    }
  }
}
