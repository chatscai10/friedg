import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 這裡可以添加全局測試設置，如模擬 matchMedia 等瀏覽器 API
// 或定義自定義 matchers

// 處理 MUI 的 Portal 等功能
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
}); 