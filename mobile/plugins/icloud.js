/**
 * Liga o iCloud — entitlement e codigo — de uma vez so.
 *
 * Nada aqui roda enquanto `extra.icloud` for falso no app.json, e e assim que o
 * app funciona hoje: conta Apple gratuita nao emite o entitlement de iCloud.
 *
 * Por que entitlement e flag de compilacao andam juntos: `CKContainer(identifier:)`
 * NAO devolve erro quando falta o entitlement — ele derruba o processo com
 * EXC_BREAKPOINT, de dentro do CloudKit, antes de qualquer `try`. Nenhum
 * `do/catch` pega isso. E conferir o entitlement em tempo de execucao tambem
 * nao serve: o `SecTaskCreateFromSelf` que faria isso e do macOS.
 *
 * Entao a trava e de compilacao: com `extra.icloud` ligado, este plugin poe o
 * entitlement E define `GIZ_ICLOUD`. Os dois nascem juntos e nao tem como
 * discordar — sem conta paga, o binario nem menciona CKContainer.
 *
 * O dia de ligar: comprar a conta, criar o container iCloud.dev.nspx.giz no
 * painel da Apple, criar os seis record types de docs/CLOUDKIT.md, e trocar
 * `extra.icloud` para true.
 */
const { withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins')

const CONTAINER = 'iCloud.dev.nspx.giz'

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
      if (lista.includes('GIZ_ICLOUD')) continue
      bloco.buildSettings.SWIFT_ACTIVE_COMPILATION_CONDITIONS = `${lista} GIZ_ICLOUD`
    }
    return cfg
  })
}

module.exports = (config) => {
  if (!config?.extra?.icloud) return config
  return comFlagDeCompilacao(comEntitlements(config))
}
