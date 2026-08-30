import ExpoModulesCore
import CloudKit

/**
 A porta de nuvem do Giz, sobre o banco PRIVADO do iCloud do usuario.

 O que este arquivo NAO faz, de proposito: decidir quem vence quando dois
 aparelhos editam o mesmo registro. Isso e do `nucleo/sync/mesclar.ts`, que e
 TypeScript puro e tem uma bateria de teste rodando sem CloudKit nenhum. Aqui so
 existe transporte — e e por isso que trocar isto pelo Firestore, quando o
 Android entrar, nao mexe em regra nenhuma.

 Por que CKFetchRecordZoneChangesOperation e nao CKSyncEngine: o CKSyncEngine e
 orientado a eventos, com delegate e ciclo de vida proprio, e a interface que o
 nucleo ja tem e `puxar(desde) / empurrar(mudancas)`. O token de mudanca da zona
 casa exatamente com o `desde`, sem adaptador no meio.

 CADA REGISTRO E UM BLOB JSON. Nao ha um campo do CloudKit por campo do modelo,
 e isso e escolha: o schema do CloudKit e imutavel depois de publicado, e um
 campo novo no `Compromisso` obrigaria a migrar o container. Com um `json` so,
 o formato dos dados e o do app, e quem entende dele e o TypeScript.

 ESTE MODULO NAO RODA EM CONTA APPLE GRATUITA: o entitlement
 `com.apple.developer.icloud-services` nao e emitido para time pessoal. Sem ele,
 `disponivel()` responde falso e o app inteiro continua funcionando no aparelho.
 */
public class NuvemModule: Module {
  private static let identificadorDoContainer = "iCloud.dev.nspx.giz"
  private static let nomeDaZona = "giz"

  /**
   CKContainer(identifier:) NAO devolve erro quando o app nao tem o entitlement
   de iCloud: ele DERRUBA O PROCESSO com EXC_BREAKPOINT, dentro do proprio
   CloudKit, antes de qualquer `try` nosso ter chance.

   Medido aqui em 29/08/2026, em conta Apple gratuita: tocar em Ajustes fechava o
   app e voltava para a tela de inicio. Sem erro no console, sem nada no Metro —
   so um .ips no DiagnosticReports. `do/catch` nao pega, `try?` nao pega, e o
   `catch` do lado do JavaScript muito menos, porque o processo ja morreu.

   Conferir o entitlement em tempo de execucao tambem nao serve: o
   `SecTaskCreateFromSelf` que faria isso e do macOS, e nao existe no iOS.

   Por isso a trava e de COMPILACAO. O mesmo plugin que adiciona o entitlement
   (`plugins/icloud.js`, ligado por `extra.icloud` no app.json) define
   `GIZ_ICLOUD`. Entitlement e codigo nascem juntos e nao tem como discordar:
   sem conta paga, este arquivo nem chega a mencionar CKContainer.
   */
  private lazy var container = CKContainer(identifier: NuvemModule.identificadorDoContainer)
  private var banco: CKDatabase { container.privateCloudDatabase }
  private var zona = CKRecordZone(zoneName: NuvemModule.nomeDaZona)
  private var zonaCriada = false

  public func definition() -> ModuleDefinition {
    Name("Nuvem")

#if !GIZ_ICLOUD
    // Sem conta paga, o modulo existe e responde — mas nao encosta no CloudKit.
    AsyncFunction("disponivel") { (promise: Promise) in promise.resolve(false) }
    AsyncFunction("motivo") { (promise: Promise) in promise.resolve("sem-entitlement-icloud") }
    AsyncFunction("puxar") { (_: String?, promise: Promise) in
      promise.reject("sem-entitlement", "iCloud nao habilitado neste build")
    }
    AsyncFunction("empurrar") { (_: [[String: Any]], promise: Promise) in
      promise.reject("sem-entitlement", "iCloud nao habilitado neste build")
    }
#else

    AsyncFunction("disponivel") { (promise: Promise) in
      self.container.accountStatus { estado, erro in
        // Qualquer erro aqui — inclusive a falta do entitlement — significa que
        // nao da para sincronizar. O app nao pode quebrar por causa disso.
        if erro != nil {
          promise.resolve(false)
          return
        }
        promise.resolve(estado == .available)
      }
    }

    AsyncFunction("motivo") { (promise: Promise) in
      self.container.accountStatus { estado, erro in
        if let erro { promise.resolve("erro: \(erro.localizedDescription)"); return }
        switch estado {
        case .available: promise.resolve("ok")
        case .noAccount: promise.resolve("sem-conta-icloud")
        case .restricted: promise.resolve("restrito")
        case .couldNotDetermine: promise.resolve("indeterminado")
        case .temporarilyUnavailable: promise.resolve("temporariamente-indisponivel")
        @unknown default: promise.resolve("desconhecido")
        }
      }
    }

    AsyncFunction("puxar") { (desde: String?, promise: Promise) in
      self.garantirZona { erro in
        if let erro { promise.reject("zona", erro.localizedDescription); return }
        self.buscarMudancas(desde: desde, promise: promise)
      }
    }

    AsyncFunction("empurrar") { (mudancas: [[String: Any]], promise: Promise) in
      self.garantirZona { erro in
        if let erro { promise.reject("zona", erro.localizedDescription); return }
        self.enviar(mudancas: mudancas, promise: promise)
      }
    }
#endif
  }

  // MARK: - zona

  /// A zona customizada existe para poder buscar por delta. O banco privado
  /// padrao nao entrega token de mudanca por zona, e sem token cada abertura do
  /// app baixaria a base inteira.
  private func garantirZona(_ pronto: @escaping (Error?) -> Void) {
    if zonaCriada { pronto(nil); return }
    let op = CKModifyRecordZonesOperation(recordZonesToSave: [zona], recordZoneIDsToDelete: nil)
    op.modifyRecordZonesResultBlock = { resultado in
      switch resultado {
      case .success:
        self.zonaCriada = true
        pronto(nil)
      case .failure(let erro):
        pronto(erro)
      }
    }
    banco.add(op)
  }

  // MARK: - puxar

  private func buscarMudancas(desde: String?, promise: Promise) {
    let config = CKFetchRecordZoneChangesOperation.ZoneConfiguration()
    config.previousServerChangeToken = Self.tokenDe(texto: desde)

    let op = CKFetchRecordZoneChangesOperation(
      recordZoneIDs: [zona.zoneID],
      configurationsByRecordZoneID: [zona.zoneID: config]
    )
    op.fetchAllChanges = false // um lote por chamada: quem pagina e o nucleo

    var recebidas: [[String: Any]] = []
    var novoToken: CKServerChangeToken?
    var temMais = false

    op.recordWasChangedBlock = { _, resultado in
      guard case .success(let registro) = resultado else { return }
      if let m = Self.mudancaDe(registro: registro) { recebidas.append(m) }
    }
    op.recordZoneChangeTokensUpdatedBlock = { _, token, _ in novoToken = token }
    op.recordZoneFetchResultBlock = { _, resultado in
      if case .success(let dados) = resultado {
        novoToken = dados.serverChangeToken
        temMais = dados.moreComing
      }
    }
    op.fetchRecordZoneChangesResultBlock = { resultado in
      switch resultado {
      case .failure(let erro):
        promise.reject("puxar", erro.localizedDescription)
      case .success:
        promise.resolve([
          "mudancas": recebidas,
          "marca": Self.textoDe(token: novoToken) ?? desde ?? "",
          "temMais": temMais,
        ])
      }
    }
    banco.add(op)
  }

  // MARK: - empurrar

  private func enviar(mudancas: [[String: Any]], promise: Promise) {
    var registros: [CKRecord] = []
    for m in mudancas {
      guard let tabela = m["tabela"] as? String,
            let registro = m["registro"] as? [String: Any],
            let id = registro["id"] as? String,
            let json = try? JSONSerialization.data(withJSONObject: registro),
            let texto = String(data: json, encoding: .utf8)
      else { continue }

      let ck = CKRecord(
        recordType: Self.tipoDe(tabela: tabela),
        recordID: CKRecord.ID(recordName: "\(tabela)|\(id)", zoneID: zona.zoneID)
      )
      ck["tabela"] = tabela as CKRecordValue
      ck["json"] = texto as CKRecordValue
      ck["atualizadoEm"] = ((registro["atualizadoEm"] as? NSNumber) ?? 0) as CKRecordValue
      registros.append(ck)
    }

    let op = CKModifyRecordsOperation(recordsToSave: registros, recordIDsToDelete: nil)
    // O servidor NAO arbitra: quem decidiu o que enviar foi a mesclagem do
    // nucleo, e ela ja considerou a versao remota. Sobrescrever e o certo aqui.
    op.savePolicy = .allKeys
    op.isAtomic = false

    var rejeitadas: [[String: Any]] = []
    op.perRecordSaveBlock = { id, resultado in
      if case .failure = resultado {
        // Volta o que o servidor tem, para o nucleo mesclar de novo em vez de
        // dar a mudanca por perdida.
        let partes = id.recordName.split(separator: "|", maxSplits: 1)
        if partes.count == 2 {
          rejeitadas.append(["tabela": String(partes[0]), "registro": ["id": String(partes[1])]])
        }
      }
    }
    op.modifyRecordsResultBlock = { resultado in
      switch resultado {
      case .failure(let erro):
        promise.reject("empurrar", erro.localizedDescription)
      case .success:
        promise.resolve(["marca": "", "rejeitadas": rejeitadas])
      }
    }
    banco.add(op)
  }

  // MARK: - conversao

  private static func tipoDe(tabela: String) -> String {
    // O CloudKit exige tipo comecando em maiuscula.
    tabela.prefix(1).uppercased() + tabela.dropFirst()
  }

  private static func mudancaDe(registro: CKRecord) -> [String: Any]? {
    guard let tabela = registro["tabela"] as? String,
          let texto = registro["json"] as? String,
          let dados = texto.data(using: .utf8),
          let objeto = try? JSONSerialization.jsonObject(with: dados) as? [String: Any]
    else { return nil }
    return ["tabela": tabela, "registro": objeto]
  }

  private static func textoDe(token: CKServerChangeToken?) -> String? {
    guard let token,
          let dados = try? NSKeyedArchiver.archivedData(
            withRootObject: token, requiringSecureCoding: true)
    else { return nil }
    return dados.base64EncodedString()
  }

  private static func tokenDe(texto: String?) -> CKServerChangeToken? {
    guard let texto, !texto.isEmpty, let dados = Data(base64Encoded: texto) else { return nil }
    return try? NSKeyedUnarchiver.unarchivedObject(
      ofClass: CKServerChangeToken.self, from: dados)
  }
}
