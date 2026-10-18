/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0A0803',       // Ultra deep luxury obsidian gold
          surface: '#120E06',  // Deep dark gold surface
          card: '#1A1409',     // Rich dark gold card
          border: '#332710',   // Ornate gold border
          hover: '#29200D',    // Hover state
          darker: '#060502'
        },
        gold: {
          50: '#FFFDF2',
          100: '#FFFBE6',
          200: '#FFF3B8',
          300: '#FFE68A',
          400: '#F5D061',     // Bright Shimmering Gold
          500: '#D4AF37',     // Core Royal Gold (ရွှေဥဒေါင်း ရွှေရောင်)
          600: '#B8860B',     // Dark Metallic Goldenrod
          700: '#996F08',     // Deep Burnished Gold
          800: '#7A5805',
          900: '#4D3703',     // Darkest Gold
          metallic: '#E5B842',
          amber: '#FFC107',
          crown: '#FFDF73'
        },
        navy: {
          700: '#141824',
          750: '#101420',
          800: '#0F131E',
          900: '#0A0D14',
          950: '#06080D'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Outfit', 'Padauk', 'sans-serif'],
        serif: ['Cinzel', 'serif']
      },
      boxShadow: {
        'gold': '0 0 25px -4px rgba(212, 175, 55, 0.45)',
        'gold-lg': '0 0 40px -5px rgba(212, 175, 55, 0.7)',
        'gold-sm': '0 0 12px -2px rgba(212, 175, 55, 0.4)',
        'gold-inner': 'inset 0 0 15px rgba(212, 175, 55, 0.25)',
      }
    },
  },
  plugins: [],
}
