/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'sedo-green': '#2EBD8E',
        'sedo-green-dark': '#239E76',
        'sedo-green-light': '#E8F8F2',
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
