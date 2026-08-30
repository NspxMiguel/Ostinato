const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const raizDoRepo = path.resolve(__dirname, '..')
const config = getDefaultConfig(__dirname)

// A logica do Giz vive em ../nucleo, fora de mobile/, e e TypeScript puro —
// e ela que o Android e a web vao reaproveitar sem copia. O Metro precisa
// vigiar a raiz do repositorio para enxergar aqueles arquivos.
config.watchFolders = [raizDoRepo]
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(raizDoRepo, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = false

// Um React so, sempre.
//
// A logica compartilhada mora em ../nucleo e, resolvida a partir dali, o Metro
// pode achar um React da raiz do repositorio. Duas copias do React no mesmo
// bundle dao "Invalid hook call" e derrubam o app na abertura. Estes pacotes
// passam a resolver sempre para a copia do app, venha o import de onde vier.
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
