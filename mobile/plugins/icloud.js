/**
 * Liga (ou nao) o CloudKit.
 *
 * O motivo original desta chave era a conta gratuita, que nao emite o entitlement
 * de iCloud. A conta paga existe desde 29/08/2026 e o app ja assina por ela — o
 * que ainda falta e OUTRA coisa: o container `iCloud.com.ostinato.app` precisa
 * existir, e criar container e operacao do portal de desenvolvedor, onde a conta
 * dele responde "Access Unavailable" por ser membro de App Store Connect e nao do
 * Developer Program.
 *
 * Por que a chave nao pode simplesmente ficar ligada: sem o entitlement, o
 * `CKContainer(identifier:)` nao lanca erro — ele DERRUBA o processo. O app
 * fechava sozinho ao abrir Ajustes, e a unica evidencia era um `.ips` em
 * ~/Library/Logs/DiagnosticReports. Por isso o CloudKit e compilado para fora
 * (`#if OSTINATO_ICLOUD`) em vez de so nao ser chamado.
 *
 * O dia de ligar: criar o container no portal, `extra.icloud = true`, e
 * `expo prebuild`. Ate la, Ajustes diz "Nao incluido nesta versao" — que e a
 * verdade, e nao mais "precisa de conta paga", que virou mentira.
 */
const { withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins')

const CONTAINER = 'iCloud.com.ostinato.app'

function comEntitlements(config) {
  return withEntitlementsPlist(config, (cfg) => {
    cfg.modResults['com.apple.developer.icloud-services'] = ['CloudKit']
    cfg.modResults['com.apple.developer.icloud-container-identifiers'] = [CONTAINER]
    cfg.modResults['com.apple.developer.ubiquity-kvstore-identifier'] = '$(TeamIdentifierPrefix)$(CFBundleIdentifier)'
    return cfg
  })
}

function comFlagDeCompilacao(config) {
  return withXcodeProject(config, (cfg) => {
    const configuracoes = cfg.modResults.pbxXCBuildConfigurationSection()
    for (const chave of Object.keys(configuracoes)) {
      const bloco = configuracoes[chave]
      if (!bloco?.buildSettings) continue
      const atual = bloco.buildSettings.SWIFT_ACTIVE_COMPILATION_CONDITIONS
      const lista = String(atual ?? '$(inherited)')
      if (lista.includes('OSTINATO_ICLOUD')) continue
      bloco.buildSettings.SWIFT_ACTIVE_COMPILATION_CONDITIONS = `${lista} OSTINATO_ICLOUD`
    }
    return cfg
  })
}

module.exports = (config) => {
  if (!config?.extra?.icloud) return config
  return comFlagDeCompilacao(comEntitlements(config))
}
