// 演示封面渐变调色板（accent 0-7），与 Flutter 的 accentFor 取值对应。
// 用于无封面时的本地渐变占位，避免任何外链图片。

export interface Accent {
  from: string;
  to: string;
  text: string;
}

export const ACCENTS: Accent[] = [
  { from: '#e8743b', to: '#b8431a', text: '#fff3ea' }, // 0 暖橙
  { from: '#d9a441', to: '#9c6f1c', text: '#fff7e6' }, // 1 金
  { from: '#3b9ae8', to: '#1a5fb8', text: '#eaf4ff' }, // 2 蓝
  { from: '#7b5ce8', to: '#4a2fb8', text: '#f2ecff' }, // 3 紫
  { from: '#3bc4a8', to: '#1a8f78', text: '#e7fff8' }, // 4 青
  { from: '#e85c8a', to: '#b81f55', text: '#ffeef5' }, // 5 粉
  { from: '#5ce8b8', to: '#1f9c74', text: '#e7fff3' }, // 6 绿
  { from: '#c45ce8', to: '#7a1fb8', text: '#f7eaff' }, // 7 品红
];

export function accentOf(n: number): Accent {
  return ACCENTS[((n % 8) + 8) % 8];
}
