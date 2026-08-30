/**
 * Liga (ou nao) o alvo de extensao que desenha a Live Activity e o widget.
 *
 * MEDIDO em 30/08/2026, conta Apple gratuita, com xcodebuild -allowProvisioningUpdates
 * para `generic/platform=iOS`:
 *
 *   error: No Accounts: Add a new account in Accounts settings. (target 'Ostinato')
 *   error: No profiles for 'dev.nspx.ostinato' were found       (target 'Ostinato')
 *   error: No profiles for 'dev.nspx.ostinato.widget' were found (target 'OstinatoAtividade')
 *
 * Repare que o alvo do APP falha igual. A explicacao nao e a Apple recusar a
 * capability: o `xcodebuild` nao CRIA nem ATUALIZA perfil, so usa o que ja esta
 * em cache — e nao ha nenhum perfil de `dev.nspx.ostinato` em
 * ~/Library/Developer/Xcode/UserData/Provisioning Profiles/. Um archive pela
 * interface do Xcode cria o perfil, e a linha de comando volta a funcionar.
 *
 * O QUE NAO ESTA MEDIDO: se o perfil do alvo de EXTENSAO nasce pela interface.
 * Ninguem conseguiu levar esse teste ate o fim ainda. Ate alguem medir, isto
 * aqui e uma chave de conveniencia, e nao a prova de um limite da Apple.
 *
 * No SIMULADOR nada disso vale — ele nao exige perfil — e e por isso que a Live
 * Activity e a Dynamic Island ja rodam e ja foram vistas funcionando.
 *
 * O padrao e LIGADO porque e onde o app e desenvolvido e visto. Se o alvo
 * atrapalhar um build para aparelho, trocar `extra.widget` para false e rodar
 * `expo prebuild --clean`: o alvo sai do projeto e a unica coisa que se perde e
 * a Live Activity. Nenhum codigo e apagado.
 */
module.exports = (config) => {
  if (config?.extra?.widget === false) return config
  // O plugin de verdade so entra quando a chave permite.
  const alvos = require('@bacons/apple-targets/app.plugin')
  return alvos(config)
}
