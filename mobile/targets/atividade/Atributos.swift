import ActivityKit
import Foundation

/**
 O contrato da Live Activity.

 ESTE ARQUIVO EXISTE DUAS VEZES, identico, aqui e em
 `modules/atividade/ios/Atributos.swift`. Nao e descuido: o app e a extensao de
 widget sao alvos separados do Xcode, e o ActivityKit exige que os dois conhecam
 o mesmo tipo. Compartilhar por framework custaria um terceiro alvo para uma
 struct de seis campos.

 Se mudar um campo, mude nos DOIS. O teste que pega o esquecimento e simples: a
 Live Activity para de aparecer.
 */
public struct OstinatoAtributos: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// O que vence, ja formatado — quem sabe traduzir e o TypeScript.
    public var titulo: String
    public var materia: String
    /// Quando vence, em segundos desde 1970. A contagem regressiva e do sistema.
    public var venceEm: Double
    /// Cor da materia em "#RRGGBB".
    public var cor: String

    public init(titulo: String, materia: String, venceEm: Double, cor: String) {
      self.titulo = titulo
      self.materia = materia
      self.venceEm = venceEm
      self.cor = cor
    }
  }

  /// O tipo do compromisso, ja traduzido ("Prova", "Entrega").
  public var tipo: String

  public init(tipo: String) {
    self.tipo = tipo
  }
}
