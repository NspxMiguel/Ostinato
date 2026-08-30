import ExpoModulesCore
import Speech
import AVFoundation

/**
 Anotar falando, como o microfone do WhatsApp.

 Duas escolhas que valem explicar:

 **`requiresOnDeviceRecognition = true`.** O reconhecimento roda no aparelho, e
 nao na nuvem da Apple. E mais lento em modelo antigo e as vezes erra mais, mas
 o que a pessoa dita aqui e a prova dela na sexta e o trabalho de historia — nao
 tem por que isso sair do telefone. Se o idioma nao tiver modelo baixado, cai
 para o servidor, porque um ditado que nao funciona e pior que um ditado que
 sai do aparelho.

 **Resultado parcial a cada palavra.** O texto aparece enquanto a pessoa fala,
 como no WhatsApp. Ditado que so mostra no fim parece travado, e a pessoa
 desiste no meio.
 */
public class VozModule: Module {
  private var reconhecedor: SFSpeechRecognizer?
  private var pedido: SFSpeechAudioBufferRecognitionRequest?
  private var tarefa: SFSpeechRecognitionTask?
  private let motor = AVAudioEngine()
  private var ultimoTexto = ""

  public func definition() -> ModuleDefinition {
    Name("Voz")

    Events("aoOuvir", "aoTerminar", "aoFalhar")

    AsyncFunction("permissao") { (promise: Promise) in
      SFSpeechRecognizer.requestAuthorization { estado in
        guard estado == .authorized else {
          promise.resolve(false)
          return
        }
        AVAudioSession.sharedInstance().requestRecordPermission { podeGravar in
          promise.resolve(podeGravar)
        }
      }
    }

    Function("disponivel") { (idioma: String) -> Bool in
      SFSpeechRecognizer(locale: Locale(identifier: idioma))?.isAvailable ?? false
    }

    AsyncFunction("comecar") { (idioma: String, promise: Promise) in
      do {
        try self.comecar(idioma: idioma)
        promise.resolve(true)
      } catch {
        promise.reject("voz", error.localizedDescription)
      }
    }

    AsyncFunction("parar") { (promise: Promise) in
      self.parar()
      promise.resolve(self.ultimoTexto)
    }

    OnDestroy {
      self.parar()
    }
  }

  private func comecar(idioma: String) throws {
    parar()
    ultimoTexto = ""

    guard let r = SFSpeechRecognizer(locale: Locale(identifier: idioma)), r.isAvailable else {
      throw NSError(domain: "ostinato.voz", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "ditado indisponivel em \(idioma)"])
    }
    reconhecedor = r

    let sessao = AVAudioSession.sharedInstance()
    try sessao.setCategory(.record, mode: .measurement, options: .duckOthers)
    try sessao.setActive(true, options: .notifyOthersOnDeactivation)

    let p = SFSpeechAudioBufferRecognitionRequest()
    p.shouldReportPartialResults = true
    if r.supportsOnDeviceRecognition {
      p.requiresOnDeviceRecognition = true
    }
    pedido = p

    let entrada = motor.inputNode
    entrada.removeTap(onBus: 0)
    entrada.installTap(onBus: 0, bufferSize: 1024, format: entrada.outputFormat(forBus: 0)) {
      buffer, _ in
      p.append(buffer)
    }
    motor.prepare()
    try motor.start()

    tarefa = r.recognitionTask(with: p) { [weak self] resultado, erro in
      guard let self else { return }
      if let resultado {
        self.ultimoTexto = resultado.bestTranscription.formattedString
        self.sendEvent("aoOuvir", [
          "texto": self.ultimoTexto,
          "final": resultado.isFinal,
        ])
        if resultado.isFinal {
          self.parar()
          self.sendEvent("aoTerminar", ["texto": self.ultimoTexto])
        }
        return
      }
      if let erro {
        // Silencio prolongado tambem chega como erro. Se ja havia texto, isso e
        // fim de fala, nao falha — tratar como falha apagaria o que a pessoa
        // acabou de ditar.
        self.parar()
        if self.ultimoTexto.isEmpty {
          self.sendEvent("aoFalhar", ["motivo": erro.localizedDescription])
        } else {
          self.sendEvent("aoTerminar", ["texto": self.ultimoTexto])
        }
      }
    }
  }

  private func parar() {
    if motor.isRunning {
      motor.stop()
      motor.inputNode.removeTap(onBus: 0)
    }
    pedido?.endAudio()
    tarefa?.cancel()
    pedido = nil
    tarefa = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
