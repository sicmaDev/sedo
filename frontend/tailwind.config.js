/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'sedo-green': 'hsl(158, 68%, 37%)',
        'sedo-green-dark': 'hsl(158, 55%, 32%)',
        'sedo-blue': 'hsl(221, 83%, 53%)',
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [],
};
