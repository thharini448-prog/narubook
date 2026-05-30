/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        anime: {
          dark: '#08080E',       // Ultra deep cosmic dark background
          card: '#10101E',       // Slate dark card color
          cardHover: '#16162A',  // Slate dark card hover color
          blue: '#00f0ff',       // Cyber neon cyan
          pink: '#ff007f',       // Cyber neon hot pink
          purple: '#bd00ff',     // Cyber neon violet
          text: '#E2E8F0',       // Light slate text color
          muted: '#64748B',      // Slate gray muted text
          // Gauges warnings
          yellow: '#FFDE00',
          orange: '#FF7C00',
          red: '#FF1F59'
        }
      },
      boxShadow: {
        'neon-blue': '0 0 8px rgba(0, 240, 255, 0.4), 0 0 20px rgba(0, 240, 255, 0.1)',
        'neon-pink': '0 0 8px rgba(255, 0, 127, 0.4), 0 0 20px rgba(255, 0, 127, 0.1)',
        'neon-purple': '0 0 8px rgba(189, 0, 255, 0.4), 0 0 20px rgba(189, 0, 255, 0.1)',
        'neon-glow': '0 0 15px rgba(0, 240, 255, 0.5), 0 0 30px rgba(189, 0, 255, 0.2)'
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, #00f0ff 0%, #bd00ff 50%, #ff007f 100%)',
        'dark-gradient': 'linear-gradient(180deg, #08080E 0%, #10101E 100%)'
      }
    },
  },
  plugins: [],
}
