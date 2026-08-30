/**
 * Ajustes do APK que o template do Expo nao expoe.
 *
 * A pasta `android/` e gerada pelo `expo prebuild` e nao entra no repositorio,
 * entao editar `build.gradle` a mao dura ate o proximo prebuild. Um plugin de
 * configuracao e o unico jeito de a mudanca sobreviver.
 *
 * O que ele faz, e por que:
 *
 * 1. **Um APK por arquitetura.** O APK universal saiu com 116 MB, e 90 MB
 *    disso eram quatro copias das bibliotecas nativas. Quem instala precisa de
 *    uma. O universal continua sendo gerado, para quando nao se sabe o alvo.
 * 2. **Tira `SYSTEM_ALERT_WINDOW` do release.** A permissao vem do menu de
 *    desenvolvimento do React Native; num app publicado ela e uma permissao
 *    sensivel pedida a toa, e a Play Store cobra explicacao por ela.
 */
const { withAppBuildGradle, withAndroidManifest } = require('expo/config-plugins')

const SPLITS = `
    // Adicionado por plugins/android-apk.js
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a', 'x86_64'
            universalApk true
        }
    }
`

function comSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes('plugins/android-apk.js')) return cfg
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /(\n\s*signingConfigs\s*\{)/,
      `${SPLITS}$1`,
    )
    return cfg
  })
}

function semJanelaDeSistema(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifesto = cfg.modResults.manifest
    manifesto['uses-permission'] = (manifesto['uses-permission'] ?? []).filter(
      (p) => p.$['android:name'] !== 'android.permission.SYSTEM_ALERT_WINDOW',
    )
    // `tools:node="remove"` e o que impede a permissao de voltar pela fusao
    // do manifesto do proprio React Native.
    manifesto.$['xmlns:tools'] = 'http://schemas.android.com/tools'
    manifesto['uses-permission'].push({
      $: {
        'android:name': 'android.permission.SYSTEM_ALERT_WINDOW',
        'tools:node': 'remove',
      },
    })
    return cfg
  })
}

module.exports = (config) => semJanelaDeSistema(comSplits(config))
