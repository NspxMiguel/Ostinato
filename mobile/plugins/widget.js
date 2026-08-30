/**
 * Liga (ou nao) o alvo de extensao que desenha a Live Activity e o widget.
 *
 * A chave nasceu quando a conta era gratuita e o alvo de extensao nao
 * provisionava. ISSO ACABOU em 30/08/2026: o app passou a assinar pelo time pago
 * `SW36PU2B3T`, e os DOIS alvos — `Ostinato` e `OstinatoAtividade` — chegaram
 * juntos ate a assinatura, pedindo so o registro do aparelho. Widget de tela de
 * inicio e Live Activity rodam os dois no iPhone dele desde entao.
 *
 * Entao a chave deixou de ser uma trava da Apple e virou o que sempre deveria ter
 * sido: conveniencia para tirar o alvo do projeto quando ele atrapalhar um build.
 * `extra.widget = false` mais `expo prebuild --clean` remove o alvo; nenhum codigo
 * e apagado, e o que se perde e o widget e a Live Activity.
 *
 * O App Group vive em `plugins/grupo.js`, e precisa estar nos dois alvos: o widget
 * roda em outro processo e so le o que estiver no container compartilhado.
 */
module.exports = (config) => {
  if (config?.extra?.widget === false) return config
  // O plugin de verdade so entra quando a chave permite.
  const alvos = require('@bacons/apple-targets/app.plugin')
  return alvos(config)
}
