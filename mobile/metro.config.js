const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const raizDoRepo = path.resolve(__dirname, '..')
const config = getDefaultConfig(__dirname)

// A logica do LootFlow vive em ../src e e COMPARTILHADA com a versao web —
// nao e copia. O Metro precisa vigiar a raiz do repositorio para enxergar
// aqueles arquivos, e precisa saber resolver os pacotes de ../node_modules,
// porque a web e o app dividem dependencias como zustand e date-fns.
config.watchFolders = [raizDoRepo]
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(raizDoRepo, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = false

// Um React so, sempre.
//
// A logica compartilhada mora em ../src e, resolvida a partir dali, o Metro
// acha o React da RAIZ (o da versao web). Duas copias do React no mesmo bundle
// dao "Invalid hook call" e derrubam o app na abertura. Estes pacotes passam a
// resolver sempre para a copia do app, venha o import de onde vier.
const UNICOS = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'zustand', 'scheduler']

config.resolver.resolveRequest = (contexto, nome, plataforma) => {
  if (UNICOS.includes(nome) || nome.startsWith('zustand/')) {
    return contexto.resolveRequest(
      { ...contexto, originModulePath: path.join(__dirname, 'index.ts') },
      nome,
      plataforma,
    )
  }
  return contexto.resolveRequest(contexto, nome, plataforma)
}

module.exports = withNativeWind(config, { input: './global.css' })
