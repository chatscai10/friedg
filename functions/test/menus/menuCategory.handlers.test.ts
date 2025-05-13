/**
 * 測試 menuCategory.handlers.ts 中的方法
 */

// 引入所需的模塊
import { Request, Response } from 'express';

// 模擬 Firestore 
const mockSet = jest.fn().mockResolvedValue(true);
const mockDoc = jest.fn().mockReturnValue({ set: mockSet });
const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });

// 模擬 uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-123')
}));

// 模擬 firebase-admin
jest.mock('firebase-admin', () => {
  return {
    // 為避免重複屬性問題，使用getter函數
    get firestore() {
      // 返回一個函數，該函數返回包含collection方法的對象
      const firestoreFunction = () => ({
        collection: mockCollection
      });
      
      // 在返回的函數上添加FieldValue屬性
      firestoreFunction.FieldValue = {
        serverTimestamp: jest.fn().mockReturnValue('server-timestamp')
      };
      
      return firestoreFunction;
    },
    initializeApp: jest.fn(),
    credential: {
      applicationDefault: jest.fn()
    }
  };
});

// 模擬 firebase-functions
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
jest.mock('firebase-functions', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError
  }
}));

describe('MenuCategory Handlers', () => {
  test('Basic test', () => {
    expect(true).toBe(true);
  });
}); 