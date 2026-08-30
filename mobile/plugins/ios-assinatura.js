/**
 * Deixa o projeto de iOS pronto para assinar sozinho.
 *
 * A pasta `ios/` e regenerada pelo `expo prebuild` e nao entra no repositorio,
 * entao escolher o time na interface do Xcode dura ate o proximo prebuild.
 * Com isto, o projeto ja nasce com assinatura automatica apontando para o time
 * do certificado que existe nesta maquina.
 */
const fs = require('node:fs')
const path = require('node:path')
const { withDangerousMod, withXcodeProject, withEntitlementsPlist } = require('expo/config-plugins')

// O time e o campo OU do certificado, nao o numero entre parenteses do nome
// dele — confundir os dois faz o Xcode dizer "No Account for Team".
const TIME = 'ZTJU92P9H4' // OU do "Apple Development: miguel@keepok.com.br"

/** Aponta os alvos do app para o time, com assinatura automatica. */
function comTime(config) {
  return withXcodeProject(config, (cfg) => {
    const configuracoes = cfg.modResults.pbxXCBuildConfigurationSection()
    for (const chave of Object.keys(configuracoes)) {
      const bloco = configuracoes[chave]
      if (!bloco?.buildSettings) continue
      const alvo = bloco.buildSettings.PRODUCT_NAME
      if (!alvo || !String(alvo).includes('Giz')) continue
      bloco.buildSettings.DEVELOPMENT_TEAM = TIME
      bloco.buildSettings.CODE_SIGN_STYLE = 'Automatic'
    }
    return cfg
  })
}

/**
 * Time pessoal (gratuito) da Apple nao assina Push Notifications: o
 * `aps-environment` que o expo-notifications adiciona faz o Xcode recusar a
 * criacao do perfil e o archive falha inteiro. A notificacao LOCAL, que e a
 * que o app usa, nao depende desse entitlement — so o push remoto depende.
 */
function semPushRemoto(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment']
    return cfg
  })
}

/**
 * Leva o `.env` para dentro do build do Xcode.
 *
 * A fase que empacota o JavaScript roda com o diretorio em `ios/`, e o
 * `@expo/env` procura o `.env` na raiz do projeto (`mobile/`). Resultado: o
 * bundle de release saia SEM uma credencial sequer do Firebase, e o app dizia
 * "firebase nao configurado" ao tocar em entrar — enquanto o mesmo comando
 * rodado a mao, de dentro de `mobile/`, embutia tudo certo. Levou horas para
 * aparecer porque o build passava e so o login falhava.
 *
 * O `react-native-xcode.sh` carrega `ios/.xcode.env.local` antes de empacotar,
 * entao e ali que as variaveis entram. O arquivo e gerado a cada prebuild
 * porque `ios/` inteiro e regenerado.
 */
function comEnvDoXcode(config) {
  return withDangerousMod(config, ['ios', (cfg) => {
    const raiz = cfg.modRequest.projectRoot
    const env = path.join(raiz, '.env')
    if (!fs.existsSync(env)) return cfg
    const linhas = fs.readFileSync(env, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => `export ${l}`)
    const cabecalho = [
      '# Gerado pelo plugin ios-assinatura a cada prebuild.',
      '# Sem isto o bundle de release sai sem as credenciais do Firebase,',
      '# porque a fase de build roda em ios/ e o .env mora em mobile/.',
      '',
    ]
    fs.writeFileSync(
      path.join(cfg.modRequest.platformProjectRoot, '.xcode.env.local'),
      cabecalho.concat(linhas).join('\n') + '\n',
    )
    return cfg
  }])
}

module.exports = (config) => comEnvDoXcode(semPushRemoto(comTime(config)))
