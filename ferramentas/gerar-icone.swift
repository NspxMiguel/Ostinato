// Gera o icone do app a partir das formas do handoff, sem dependencia externa:
// o proprio macOS rasteriza. Rodar com: swift icone.swift <saida.png>
import AppKit

let lado = 1024.0
let k = lado / 160.0   // o handoff descreve num quadrado de 160

let img = NSImage(size: NSSize(width: lado, height: lado))
img.lockFocus()

NSColor.black.setFill()
NSRect(x: 0, y: 0, width: lado, height: lado).fill()

// O eixo Y do AppKit cresce para CIMA; o do SVG do handoff, para baixo.
// Amplia em torno do centro: o desenho do handoff ocupava ~65% do quadro, e
// icone de iOS que deixa margem larga parece pequeno ao lado dos vizinhos.
let zoom = 1.32
func p(_ x: Double, _ y: Double) -> NSPoint {
  let zx = 80 + (x - 80) * zoom
  let zy = 80 + (y - 80) * zoom
  return NSPoint(x: zx * k, y: (160 - zy) * k)
}

let cinza = NSColor(calibratedWhite: 1, alpha: 0.42)
cinza.setFill()

// A aba do capelo: um losango.
let aba = NSBezierPath()
aba.move(to: p(80, 44)); aba.line(to: p(132, 66)); aba.line(to: p(80, 88)); aba.line(to: p(28, 66))
aba.close(); aba.fill()

// O barrete embaixo dela.
let corpo = NSBezierPath()
corpo.move(to: p(52, 77)); corpo.line(to: p(80, 89)); corpo.line(to: p(108, 77)); corpo.line(to: p(108, 100))
corpo.curve(to: p(80, 114), controlPoint1: p(108, 108), controlPoint2: p(96, 114))
corpo.curve(to: p(52, 100), controlPoint1: p(64, 114), controlPoint2: p(52, 108))
corpo.close(); corpo.fill()

// A borla: o unico acento de cor.
let amarelo = NSColor(srgbRed: 1, green: 0.839, blue: 0.039, alpha: 1)
amarelo.setStroke(); amarelo.setFill()
let cordao = NSBezierPath()
cordao.lineWidth = 4 * k * zoom
cordao.lineCapStyle = .round
cordao.move(to: p(124, 70)); cordao.line(to: p(124, 100)); cordao.stroke()
let centroNo = p(124, 106)
let raioNo = 7 * k * zoom
let no = NSBezierPath(ovalIn: NSRect(x: centroNo.x - raioNo, y: centroNo.y - raioNo, width: raioNo * 2, height: raioNo * 2))
no.fill()

img.unlockFocus()

guard let tiff = img.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else { exit(1) }
try! png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
print("ok")
