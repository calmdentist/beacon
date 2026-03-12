import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#131313',
        paper: '#f8f6ef',
        ember: '#c94d2d',
        moss: '#41533b'
      }
    }
  },
  plugins: []
};

export default config;
