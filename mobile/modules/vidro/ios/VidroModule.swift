import ExpoModulesCore
import UIKit

// Liquid Glass de verdade — pelo UIKit, nao pelo SwiftUI.
//
// A primeira versao hospedava uma view SwiftUI com `.glassEffect()` dentro de
// um `UIHostingController`. Nao funcionou, por dois motivos que so aparecem
// rodando: o controlador era variavel local e morria antes de desenhar, e
// mesmo retido o `Color.clear.glassEffect()` nao produz material nenhum —
// `glassEffect` desenha ATRAS do conteudo da view, e `Color.clear` nao tem
// conteudo.
//
// O `UIGlassEffect` do iOS 26 e o mesmo material, na API que o UIKit ja sabe
// compor: um `UIVisualEffectView`, exatamente como o `UIBlurEffect` de sempre.
// Sem hospedeiro, sem ciclo de vida para acertar, e amostrando o que esta
// atras porque e assim que `UIVisualEffectView` funciona.
final class VidroView: ExpoView {
  private let efeito = UIVisualEffectView(effect: nil)

  /// Raio da borda, para a capsula da barra e para os botoes.
  var raio: CGFloat = 0 { didSet { aplicarRaio() } }

  /// 'regular' ou 'clear', espelhando os dois estilos do sistema.
  var variante: String = "regular" { didSet { aplicarEfeito() } }

  /// Vidro que reage ao toque, como os botoes do proprio iOS 26.
  var interativo: Bool = false { didSet { aplicarEfeito() } }

  /// Cor que tinge o material — o verde da marca atravessando o vidro.
  var tonalidade: UIColor? { didSet { aplicarEfeito() } }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    efeito.frame = bounds
    efeito.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(efeito)
    sendSubviewToBack(efeito)
    aplicarEfeito()
  }

  private func aplicarEfeito() {
    if #available(iOS 26.0, *) {
      let estilo: UIGlassEffect.Style = variante == "clear" ? .clear : .regular
      let vidro = UIGlassEffect(style: estilo)
      vidro.isInteractive = interativo
      vidro.tintColor = tonalidade
      efeito.effect = vidro
    } else {
      // Antes do iOS 26 nao existe Liquid Glass; o mais proximo nativo e o
      // material de sistema, que ja acompanha claro/escuro sozinho.
      let estilo: UIBlurEffect.Style = variante == "clear"
        ? .systemUltraThinMaterial
        : .systemThinMaterial
      efeito.effect = UIBlurEffect(style: estilo)
    }
    aplicarRaio()
  }

  private func aplicarRaio() {
    efeito.layer.cornerRadius = raio
    efeito.layer.cornerCurve = .continuous
    efeito.clipsToBounds = true
  }
}

public class VidroModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Vidro")

    // A tela pergunta se o material do sistema existe: quando nao existe, o
    // componente de JS cai no visual antigo em vez de mostrar um buraco.
    Function("temLiquidGlass") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }

    View(VidroView.self) {
      Prop("raio") { (view: VidroView, valor: Double) in view.raio = CGFloat(valor) }
      Prop("variante") { (view: VidroView, valor: String) in view.variante = valor }
      Prop("interativo") { (view: VidroView, valor: Bool) in view.interativo = valor }
      Prop("tonalidade") { (view: VidroView, valor: String?) in
        view.tonalidade = valor.flatMap { UIColor(hex: $0) }
      }
    }
  }
}

// MARK: - Cor a partir de hex

private extension UIColor {
  /// Aceita `#RRGGBB` e `#RRGGBBAA`. Devolve nil no que nao reconhecer, para a
  /// tela cair no vidro sem tonalidade em vez de num preto sem explicacao.
  convenience init?(hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6 || s.count == 8, let n = UInt64(s, radix: 16) else { return nil }
    let temAlfa = s.count == 8
    let r = CGFloat((n >> (temAlfa ? 24 : 16)) & 0xFF) / 255
    let g = CGFloat((n >> (temAlfa ? 16 : 8)) & 0xFF) / 255
    let b = CGFloat((n >> (temAlfa ? 8 : 0)) & 0xFF) / 255
    let a = temAlfa ? CGFloat(n & 0xFF) / 255 : 1
    self.init(red: r, green: g, blue: b, alpha: a)
  }
}
