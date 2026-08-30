/**
 * Traduz os textos de permissao do iOS.
 *
 * `NSMicrophoneUsageDescription` e os irmaos dele vivem no Info.plist, que tem
 * UM valor so — entao um app com interface em quatro idiomas pedia o microfone
 * em portugues para quem esta lendo tudo em ingles. O i18n do app nao alcanca
 * esse texto: quem o mostra e o sistema, antes de o JavaScript existir.
 *
 * O jeito da Apple e um `InfoPlist.strings` por idioma. Este plugin escreve os
 * arquivos e registra `CFBundleLocalizations`, senao o iOS nem procura por eles.
 *
 * Sobre o texto do ditado: o proprio dialogo do sistema avisa que o audio pode
 * ir para a Apple, e ele nao da para mudar. Dizer aqui "roda no aparelho" sem
 * ressalva contradiria o que o usuario esta lendo logo acima — por isso a frase
 * diz "quando o idioma tem modelo baixado", que e a verdade: e o que o
 * `requiresOnDeviceRecognition` consegue garantir, e so nesse caso.
 */
const fs = require('node:fs')
const path = require('node:path')
const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins')

const TEXTOS = {
  pt: {
    NSMicrophoneUsageDescription: 'Para você anotar a tarefa falando, em vez de digitar.',
    NSSpeechRecognitionUsageDescription:
      'Para transformar o que você fala em tarefa. Quando o idioma tem modelo baixado, o reconhecimento acontece no próprio aparelho.',
    NSCameraUsageDescription: 'Para ler o horário ou a tarefa a partir de uma foto do papel.',
    NSPhotoLibraryUsageDescription: 'Para ler o horário a partir de uma imagem que você já tem.',
  },
  en: {
    NSMicrophoneUsageDescription: 'So you can jot a task down by speaking instead of typing.',
    NSSpeechRecognitionUsageDescription:
      'To turn what you say into a task. When the language has an on-device model, recognition happens on the device itself.',
    NSCameraUsageDescription: 'To read your timetable or task from a photo of the paper.',
    NSPhotoLibraryUsageDescription: 'To read your timetable from an image you already have.',
  },
  es: {
    NSMicrophoneUsageDescription: 'Para que apuntes la tarea hablando, en vez de escribir.',
    NSSpeechRecognitionUsageDescription:
      'Para convertir lo que dices en una tarea. Cuando el idioma tiene modelo descargado, el reconocimiento ocurre en el propio dispositivo.',
    NSCameraUsageDescription: 'Para leer el horario o la tarea desde una foto del papel.',
    NSPhotoLibraryUsageDescription: 'Para leer el horario desde una imagen que ya tienes.',
  },
  fr: {
    NSMicrophoneUsageDescription: 'Pour noter le devoir en parlant, plutôt qu’en tapant.',
    NSSpeechRecognitionUsageDescription:
      'Pour transformer ce que vous dites en devoir. Quand la langue dispose d’un modèle téléchargé, la reconnaissance se fait sur l’appareil.',
    NSCameraUsageDescription: 'Pour lire l’emploi du temps ou le devoir depuis une photo du papier.',
    NSPhotoLibraryUsageDescription: 'Pour lire l’emploi du temps depuis une image que vous avez déjà.',
  },
}

/** O iOS só procura tradução nos idiomas declarados aqui. */
function comIdiomasDeclarados(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.CFBundleLocalizations = Object.keys(TEXTOS)
    cfg.modResults.CFBundleDevelopmentRegion = 'en'
    return cfg
  })
}

function escapar(valor) {
  return valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function comArquivosDeTraducao(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const nome = cfg.modRequest.projectName
      for (const [idioma, textos] of Object.entries(TEXTOS)) {
        const pasta = path.join(cfg.modRequest.platformProjectRoot, nome, `${idioma}.lproj`)
        fs.mkdirSync(pasta, { recursive: true })
        const linhas = [
          '/* Gerado por plugins/textos-de-permissao.js a cada prebuild. */',
          ...Object.entries(textos).map(([chave, valor]) => `"${chave}" = "${escapar(valor)}";`),
          '',
        ]
        fs.writeFileSync(path.join(pasta, 'InfoPlist.strings'), linhas.join('\n'), 'utf8')
      }
      return cfg
    },
  ])
}

/**
 * Registra os arquivos no projeto do Xcode.
 *
 * Escrever o `.lproj` no disco nao basta: o que nao esta no alvo nao entra no
 * bundle, e a permissao voltaria a sair no idioma unico do Info.plist — sem erro
 * nenhum para denunciar. Medido: sem este passo, `ls Ostinato.app | grep lproj`
 * volta vazio.
 *
 * O grupo e montado a mao porque os atalhos do pacote `xcode`
 * (`addLocalizationVariantGroup`, `addResourceFile` com `variantGroup`) procuram
 * um grupo chamado "Resources" que o modelo do Expo nao tem, e quebram com
 * "Cannot read properties of null (reading 'path')".
 */
function comArquivosNoAlvo(config) {
  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults
    const nome = cfg.modRequest.projectName
    const idiomas = Object.keys(TEXTOS)

    // Prebuild sem --clean roda sobre um projeto que ja pode ter o grupo.
    const variantes = proj.hash.project.objects.PBXVariantGroup ?? {}
    for (const chave of Object.keys(variantes)) {
      if (variantes[chave]?.name === 'InfoPlist.strings') return cfg
    }

    for (const idioma of idiomas) proj.addKnownRegion(idioma)

    const grupoKey = proj.pbxCreateVariantGroup('InfoPlist.strings')

    for (const idioma of idiomas) {
      const arquivo = {
        uuid: proj.generateUuid(),
        fileRef: proj.generateUuid(),
        basename: idioma,
        path: `${idioma}.lproj/InfoPlist.strings`,
        // `text.plist.strings` e o que o Xcode grava; sem isso ele trata o
        // arquivo como binario e nao le a traducao.
        lastKnownFileType: 'text.plist.strings',
        sourceTree: '"<group>"',
        group: 'Resources',
      }
      proj.addToPbxFileReferenceSection(arquivo)
      proj.addToPbxVariantGroup(arquivo, grupoKey)
    }

    // O grupo inteiro entra como UM recurso; e assim que o Xcode empacota
    // localizacao, e e o que faz as pastas .lproj aparecerem no bundle.
    const recurso = {
      uuid: proj.generateUuid(),
      fileRef: grupoKey,
      basename: 'InfoPlist.strings',
      group: 'Resources',
    }
    proj.addToPbxBuildFileSection(recurso)
    proj.addToPbxResourcesBuildPhase(recurso)

    // E o grupo precisa aparecer na arvore do projeto, senao o Xcode o ignora.
    const grupoDoApp = proj.findPBXGroupKey({ name: nome }) ?? proj.getFirstProject().firstProject.mainGroup
    proj.addToPbxGroup({ uuid: grupoKey, basename: 'InfoPlist.strings' }, grupoDoApp)

    return cfg
  })
}

module.exports = (config) => comArquivosNoAlvo(comArquivosDeTraducao(comIdiomasDeclarados(config)))
