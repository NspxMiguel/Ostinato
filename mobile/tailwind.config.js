/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Os nomes que o expo-font registra, para as classes font-* valerem.
        sans:   ['Geist_400Regular'],
        medium: ['Geist_500Medium'],
        semi:   ['Geist_600SemiBold'],
        bold:   ['Geist_700Bold'],
        black:  ['Geist_800ExtraBold'],
        mono:   ['JetBrainsMono_400Regular'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
      colors: {
        // Apontam para os tokens: trocar o tema troca todas de uma vez.
        'base-bg': 'var(--bg)',
        surface: { DEFAULT: 'var(--surface-1)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' },
        borda: 'var(--borda)',
        'borda-forte': 'var(--borda-forte)',
        texto: {
          1: 'var(--texto-1)',
          2: 'var(--texto-2)',
          3: 'var(--texto-3)',
          4: 'var(--texto-4)',
        },
        primary: 'var(--primaria)',
        profit: 'var(--lucro)',
        loss: 'var(--perda)',
        gold: 'var(--ouro)',
      },
    },
  },
  plugins: [],
}
