/**
 * Liga (ou nao) o alvo de extensao que desenha a Live Activity e o widget.
 *
 * MEDIDO em 30/08/2026, conta Apple gratuita, com xcodebuild -allowProvisioningUpdates:
 *
 *   error: No profiles for 'dev.nspx.ostinato.widget' were found: Xcode couldn't
 *   find any iOS App Development provisioning profiles matching
 *   'dev.nspx.ostinato.widget'. (in target 'OstinatoAtividade')
 *
 * Nao e a permissao que falta — e o ALVO que nao consegue existir. Conta gratuita
 * nao emite perfil para extensao nenhuma, e `-allowProvisioningUpdates` nao
 * resolve. Como a extensao vai embutida no app, ela derruba o build do app
 * inteiro para aparelho: sem a chave abaixo, nao daria para instalar no iPhone.
 *
 * No SIMULADOR nada disso vale — ele nao exige perfil — e e por isso que a Live
 * Activity e a Dynamic Island ja rodam e ja foram vistas funcionando.
 *
 * O padrao e LIGADO porque e onde o app e desenvolvido e visto. Para instalar
 * no iPhone antes da conta paga, trocar `extra.widget` para false e rodar
 * `expo prebuild --clean`: o alvo sai do projeto, o app assina, e a unica coisa
 * que se perde e a Live Activity. Nenhum codigo e apagado.
 */
module.exports = (config) => {
  if (config?.extra?.widget === false) return config
  // O plugin de verdade so entra quando a chave permite.
  const alvos = require('@bacons/apple-targets/app.plugin')
  return alvos(config)
}
