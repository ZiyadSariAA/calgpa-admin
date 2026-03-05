/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D5A3D',
          light: '#E8F0EA',
          dark: '#1E3D2A',
        },
        secondary: {
          DEFAULT: '#3B82F6',
          light: '#DBEAFE',
        },
        background: '#FAF9F6',
        surface: '#FFFFFF',
        textPrimary: '#1A1A1A',
        textSecondary: '#6B6B6B',
        border: '#E5E5E5',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        sm: '0 1px 4px rgba(0,0,0,0.04)',
        md: '0 2px 8px rgba(0,0,0,0.06)',
        lg: '0 4px 14px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
