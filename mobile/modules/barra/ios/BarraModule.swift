import ExpoModulesCore
import UIKit

/**
 A barra de abas em Liquid Glass de verdade, montada como o UIKit manda.

 O header do SDK (UIGlassEffect.h) e explicito sobre a montagem, e era isso que
 eu vinha fazendo errado do lado do JavaScript:

     "add individual glass elements to the visual effect view's contentView by
      nesting UIVisualEffectViews configured with UIGlassEffect. In that
      configuration, the glass container will render all glass elements in one
      combined view"

 Ou seja: o container e UM `UIVisualEffectView` com `UIGlassContainerEffect`, e
 cada peca de vidro e um `UIVisualEffectView` com `UIGlassEffect` DENTRO do
 `contentView` dele, como IRMAOS. Vidro dentro de vidro — que era o meu arranjo —
 nao funde nada: `spacing` so tem efeito entre elementos do mesmo container.

 O `spacing` e a distancia em que duas pecas COMECAM a se fundir. E ele que
 produz a gota se esticando quando a bolha passa perto da borda da barra.

 O arrasto e um `UIPanGestureRecognizer` na barra inteira: a bolha segue o dedo
 em tempo real e, ao soltar, uma mola leva ela para a aba mais proxima. Sem o
 arrasto o material fica correto e morto — o que faz parecer liquido e a mao
 poder empurrar.
 */

private let ICONES = ["circle", "list.bullet", "square.grid.2x2", "slider.horizontal.3"]

class BarraView: ExpoView {
  /// Os rotulos das abas. A quantidade define a largura de cada uma.
  var rotulos: [String] = [] { didSet { remontar() } }
  var ativa: Int = 0 { didSet { if !arrastando { moverIndicador(para: ativa, animado: true) } } }
  var corAtiva: UIColor = .white
  var corInativa: UIColor = UIColor.white.withAlphaComponent(0.4)

  let aoTrocar = EventDispatcher()

  private var container: UIVisualEffectView!
  private var barra: UIVisualEffectView!
  private var indicador: UIVisualEffectView!
  private var itens: [(icone: UIImageView, rotulo: UILabel)] = []
  private var arrastando = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    montarCamadas()
  }

  private func montarCamadas() {
    if #available(iOS 26.0, *) {
      let cont = UIGlassContainerEffect()
      // 24pt: acima disso as pecas se fundem cedo demais e a bolha "gruda" na
      // borda o tempo todo; abaixo, a fusao nunca acontece e o efeito some.
      cont.spacing = 24
      container = UIVisualEffectView(effect: cont)

      let vidroDaBarra = UIGlassEffect(style: .clear)
      vidroDaBarra.tintColor = UIColor.black.withAlphaComponent(0.30)
      barra = UIVisualEffectView(effect: vidroDaBarra)

      let vidroDoIndicador = UIGlassEffect(style: .regular)
      vidroDoIndicador.isInteractive = true
      vidroDoIndicador.tintColor = UIColor.white.withAlphaComponent(0.16)
      indicador = UIVisualEffectView(effect: vidroDoIndicador)
    } else {
      // Abaixo do iOS 26 nao existe Liquid Glass. O material de sistema e o mais
      // proximo, e a barra continua utilizavel — so nao e liquida.
      container = UIVisualEffectView(effect: nil)
      barra = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialDark))
      indicador = UIVisualEffectView(effect: UIBlurEffect(style: .systemThickMaterialDark))
    }

    addSubview(container)
    // Os dois vao no contentView do CONTAINER, como irmaos. É a montagem que o
    // header descreve, e a unica em que `spacing` faz alguma coisa.
    container.contentView.addSubview(barra)
    container.contentView.addSubview(indicador)

    let arrasto = UIPanGestureRecognizer(target: self, action: #selector(arrastou(_:)))
    let toque = UITapGestureRecognizer(target: self, action: #selector(tocou(_:)))
    barra.addGestureRecognizer(arrasto)
    barra.addGestureRecognizer(toque)
    barra.isUserInteractionEnabled = true
  }

  private func remontar() {
    for item in itens {
      item.icone.removeFromSuperview()
      item.rotulo.removeFromSuperview()
    }
    itens = []

    for (i, texto) in rotulos.enumerated() {
      let icone = UIImageView(
        image: UIImage(systemName: ICONES[min(i, ICONES.count - 1)])?
          .withConfiguration(UIImage.SymbolConfiguration(pointSize: 19, weight: .regular)))
      icone.contentMode = .center

      let rotulo = UILabel()
      rotulo.text = texto
      rotulo.font = .systemFont(ofSize: 12, weight: .regular)
      rotulo.textAlignment = .center
      // Sem largura fixa e com uma linha: "Ajustes" vira "Réglages" em frances,
      // e o que nao cabe encolhe em vez de sumir.
      rotulo.adjustsFontSizeToFitWidth = true
      rotulo.minimumScaleFactor = 0.8
      rotulo.numberOfLines = 1

      // Os rotulos ficam ACIMA do indicador, senao a bolha passa por cima deles.
      container.contentView.addSubview(icone)
      container.contentView.addSubview(rotulo)
      itens.append((icone, rotulo))
    }
    pintar()
    setNeedsLayout()
  }

  private func pintar() {
    for (i, item) in itens.enumerated() {
      let ativo = i == ativa
      item.icone.tintColor = ativo ? corAtiva : corInativa
      item.rotulo.textColor = ativo ? corAtiva : corInativa
      item.rotulo.font = .systemFont(ofSize: 12, weight: ativo ? .semibold : .regular)
    }
  }

  private var larguraDaAba: CGFloat {
    guard !itens.isEmpty else { return 0 }
    return barra.bounds.width / CGFloat(itens.count)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    container.frame = bounds
    barra.frame = bounds
    barra.layer.cornerRadius = bounds.height / 2
    barra.layer.cornerCurve = .continuous
    barra.clipsToBounds = true

    let respiro: CGFloat = 6
    indicador.frame = CGRect(
      x: CGFloat(ativa) * larguraDaAba + respiro / 2,
      y: respiro,
      width: max(0, larguraDaAba - respiro),
      height: bounds.height - respiro * 2)
    indicador.layer.cornerRadius = indicador.bounds.height / 2
    indicador.layer.cornerCurve = .continuous
    indicador.clipsToBounds = true

    for (i, item) in itens.enumerated() {
      let x = CGFloat(i) * larguraDaAba
      item.icone.frame = CGRect(x: x, y: 10, width: larguraDaAba, height: 22)
      item.rotulo.frame = CGRect(x: x + 4, y: 34, width: larguraDaAba - 8, height: 16)
    }
  }

  private func moverIndicador(para indice: Int, animado: Bool) {
    let destino = CGFloat(indice) * larguraDaAba + 3
    let aplicar = { self.indicador.frame.origin.x = destino }
    guard animado else { aplicar(); pintar(); return }
    // Mola sem pressa de propósito: rápido demais vira teletransporte e o
    // movimento — que é o que faz o material parecer líquido — se perde.
    UIView.animate(
      withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.78,
      initialSpringVelocity: 0.4, options: [.allowUserInteraction], animations: aplicar)
    pintar()
  }

  private func indiceEm(_ x: CGFloat) -> Int {
    guard larguraDaAba > 0 else { return 0 }
    return min(max(Int(x / larguraDaAba), 0), max(0, itens.count - 1))
  }

  @objc private func tocou(_ g: UITapGestureRecognizer) {
    let i = indiceEm(g.location(in: barra).x)
    if i != ativa { aoTrocar(["indice": i]) }
    moverIndicador(para: i, animado: true)
  }

  /// A bolha segue o dedo, e só decide a aba quando ele sai.
  @objc private func arrastou(_ g: UIPanGestureRecognizer) {
    let x = g.location(in: barra).x
    switch g.state {
    case .began:
      arrastando = true
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
    case .changed:
      // Preso à barra, e centrado no dedo: seguir sem limite deixaria a bolha
      // sair pela lateral, que é onde o efeito deixa de parecer físico.
      let meio = larguraDaAba / 2
      let livre = min(max(x - meio, 0), barra.bounds.width - larguraDaAba) + 3
      indicador.frame.origin.x = livre
      let sob = indiceEm(x)
      if sob != ativa {
        ativa = sob
        pintar()
      }
    case .ended, .cancelled, .failed:
      arrastando = false
      let i = indiceEm(x)
      aoTrocar(["indice": i])
      moverIndicador(para: i, animado: true)
    default:
      break
    }
  }
}

public class BarraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Barra")

    View(BarraView.self) {
      Events("aoTrocar")
      Prop("rotulos") { (view: BarraView, valor: [String]) in view.rotulos = valor }
      Prop("ativa") { (view: BarraView, valor: Int) in view.ativa = valor }
    }
  }
}
