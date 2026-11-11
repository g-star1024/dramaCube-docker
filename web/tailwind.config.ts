import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // DramaCube 暖色调暗色主题（与 Flutter Web 离线演示视觉对齐）
        bg: {
          DEFAULT: '#0f0d0c',
          soft: '#171312',
          card: '#1f1a18',
          hover: '#2a2320',
        },
        ink: {
          DEFAULT: '#f5efe9',
          soft: '#cbbfb6',
          dim: '#8c8079',
        },
        accent: {
          DEFAULT: '#e8743b', // 暖橙主强调色
          soft: '#f0a06b',
        },
        line: '#2e2724',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      maxWidth: {
        shell: '1600px',
      },
    },
  },
  plugins: [],
};

export default config;
