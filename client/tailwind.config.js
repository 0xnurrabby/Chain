
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          bg: '#f7f9fc',
          card: '#ffffff',
          tint1: '#eef5ff',
          tint2: '#effaf5',
          tint3: '#fff7ec',
          tint4: '#f7f1ff',
          accent: '#3b82f6'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.05)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
}
