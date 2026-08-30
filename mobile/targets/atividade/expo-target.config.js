/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'OstinatoAtividade',
  // O alvo desenha DUAS coisas, e elas tem exigencias diferentes:
  //
  //   Live Activity  -> ActivityConfiguration. Nao precisa de App Group: o
  //                     conteudo vai do app para a extensao pelo ActivityKit.
  //   Widget de tela -> StaticConfiguration. Roda em outro processo, com outro
  //                     sandbox, e so le o que estiver no container do grupo.
  //
  // Por isso o grupo entra aqui E no alvo do app (plugins/grupo.js). Faltando em
  // um dos dois, o widget aparece na galeria e desenha vazio, sem erro.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.ostinato.app'],
  },
}
