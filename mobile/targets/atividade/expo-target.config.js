/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'GizAtividade',
  // Live Activity NAO precisa de App Group: o conteudo vai do app para a
  // extensao pelo proprio ActivityKit, em processo. Widget de tela de inicio
  // precisaria, e App Group nao e emitido para conta Apple gratuita — por isso
  // este alvo comeca so com a Live Activity.
  entitlements: {},
}
