import ExpoModulesCore
import AVFoundation

/**
 O som do alarme: importar um arquivo da pessoa, converter, guardar e ouvir.

 Pedido dele em 30/08/2026: *"opção tbm de mudar o som do alarme... coloca ate
 uma opcao de upar mp3 se der"*.

 Da, com uma conversao no meio — e e por ela que este modulo existe.

 **MP3 nao toca como alerta no iOS.** Nem o `AlarmKit` nem a notificacao aceitam:
 o som de alerta tem que ser CAF, AIFF ou WAV, com no maximo 30 segundos. Passar
 um `.mp3` para `AlertSound.named` nao da erro — o sistema simplesmente toca o
 som padrao, e a pessoa conclui que a escolha dela foi ignorada. Entao aqui todo
 arquivo que entra e reescrito em CAF e cortado em 30s.

 **Onde o arquivo mora importa tanto quanto o formato.** `AlertSound.named` e
 `UNNotificationSound` procuram na bundle do app e em `Library/Sounds` do
 container. Bundle so aceita o que foi compilado junto; `Library/Sounds` aceita
 o que a pessoa trouxe depois. E por isso que da para importar sem recompilar.
 */
public class SomModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SomDoAlarme")

    /// Os sons que a pessoa ja importou, pelo nome de arquivo.
    Function("importados") { () -> [String] in
      (try? FileManager.default.contentsOfDirectory(atPath: Self.pasta().path))?.sorted() ?? []
    }

    /**
     Importa um arquivo de audio e devolve o nome com que ele ficou guardado.

     `rotulo` vira o nome do arquivo, sem acento e sem espaco: ele viaja para o
     `AlertSound.named` como texto puro, e caractere estranho ali some sem aviso.
     */
    AsyncFunction("importar") { (uri: String, rotulo: String, promise: Promise) in
      Task.detached {
        do {
          let nome = try await Self.converter(uri: uri, rotulo: rotulo)
          promise.resolve(nome)
        } catch {
          promise.reject("som", error.localizedDescription)
        }
      }
    }

    /// Apaga um som importado. Nao mexe em quem ja esta agendado com ele —
    /// o alarme guarda o nome, e nome que nao resolve cai no som padrao.
    Function("remover") { (nome: String) -> Bool in
      (try? FileManager.default.removeItem(at: Self.pasta().appendingPathComponent(nome))) != nil
    }

    /**
     Toca o som, para ouvir antes de escolher.

     Sem isto, escolher som e apostar: os nomes nao dizem nada e a unica forma de
     conferir seria esperar o alarme tocar de madrugada.
     */
    AsyncFunction("ouvir") { (nome: String, promise: Promise) in
      Task { @MainActor in
        do {
          try AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
          try AVAudioSession.sharedInstance().setActive(true)
          let url = Self.pasta().appendingPathComponent(nome)
          Self.tocador = try AVAudioPlayer(contentsOf: url)
          Self.tocador?.play()
          promise.resolve(true)
        } catch {
          promise.resolve(false)
        }
      }
    }

    Function("parar") { () -> Void in
      Self.tocador?.stop()
      Self.tocador = nil
    }
  }

  /// Retido numa propriedade: `AVAudioPlayer` local e desalocado antes de soar.
  private static var tocador: AVAudioPlayer?

  /// `Library/Sounds`, criada na primeira vez. É onde o iOS procura.
  private static func pasta() -> URL {
    let base = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("Sounds", isDirectory: true)
    try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
    return base
  }

  /// Só letra, número e hífen: o nome viaja como texto para o `AlertSound`.
  private static func limpar(_ bruto: String) -> String {
    let semAcento = bruto.folding(options: .diacriticInsensitive, locale: .current)
    let ok = semAcento.map { $0.isLetter || $0.isNumber ? $0 : "-" }
    let junto = String(ok).lowercased()
    return junto.isEmpty ? "som" : String(junto.prefix(40))
  }

  /// Reescreve qualquer áudio como CAF de até 30 s.
  private static func converter(uri: String, rotulo: String) async throws -> String {
    guard let origem = URL(string: uri) ?? URL(fileURLWithPath: uri) as URL? else {
      throw NSError(domain: "som", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "arquivo invalido"])
    }
    let ativo = AVURLAsset(url: origem)
    let nome = "\(limpar(rotulo))-\(Int(Date().timeIntervalSince1970)).caf"
    let destino = pasta().appendingPathComponent(nome)
    try? FileManager.default.removeItem(at: destino)

    guard
      let sessao = AVAssetExportSession(asset: ativo, presetName: AVAssetExportPresetPassthrough)
        ?? AVAssetExportSession(asset: ativo, presetName: AVAssetExportPresetAppleM4A)
    else {
      throw NSError(domain: "som", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "nao consegui ler o audio"])
    }

    // O corte em 30s nao e capricho: o iOS ignora som de alerta mais longo, e
    // ignorar em silencio e o pior desfecho possivel para esta tela.
    let duracao = try await ativo.load(.duration)
    let teto = CMTime(seconds: 30, preferredTimescale: 600)
    sessao.timeRange = CMTimeRange(start: .zero, duration: CMTimeMinimum(duracao, teto))
    sessao.outputURL = destino
    sessao.outputFileType = .caf
    sessao.audioTimePitchAlgorithm = .spectral

    try await sessao.export(to: destino, as: .caf)
    return nome
  }
}
