/**
 * O App Group que o widget de tela de inicio precisa.
 *
 * A Live Activity nao precisa disto: o conteudo dela viaja do app para a extensao
 * pelo proprio ActivityKit, em processo. O widget de tela de inicio e outro
 * processo, com outro sandbox — ele so le o que estiver num container
 * compartilhado. Sem o grupo nos DOIS alvos, o widget compila, aparece na galeria
 * e desenha vazio, sem erro nenhum.
 *
 * O identificador acompanha o bundle do app: um grupo por app, nao um grupo por
 * portfolio.
 */
const { withEntitlementsPlist } = require('expo/config-plugins')

const GRUPO = 'group.com.ostinato.app'

module.exports = (config) => {
  if (config?.extra?.widget === false) return config
  return withEntitlementsPlist(config, (mod) => {
    const atuais = mod.modResults['com.apple.security.application-groups'] ?? []
    if (!atuais.includes(GRUPO)) {
      mod.modResults['com.apple.security.application-groups'] = [...atuais, GRUPO]
    }
    return mod
  })
}
