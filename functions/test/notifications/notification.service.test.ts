import * as admin from 'firebase-admin';
import { NotificationService } from '../../src/notifications/notification.service';
import { NotificationEventType, NotificationChannelType, NotificationPreferences } from '../../src/notifications/notification.types';

// 模擬firebase-admin
jest.mock('firebase-admin', () => {
  const firestore = {
    FieldValue: {
      serverTimestamp: jest.fn().mockReturnValue('mock-timestamp')
    },
    Timestamp: {
      now: jest.fn().mockReturnValue('mock-timestamp')
    }
  };
  
  return {
    firestore: jest.fn().mockReturnValue(firestore),
    __esModule: true,
    ...jest.requireActual('firebase-admin')
  };
});

// 模擬日誌記錄
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// 由於無法直接訪問NotificationService的私有方法，我們需要使用類型斷言
// 這允許我們直接測試私有方法
type PrivateNotificationService = {
  replaceTemplateVariables: (template: string, variables: Record<string, string>) => string;
  isInQuietHours: (preferences: NotificationPreferences) => boolean;
  timeStringToMinutes: (timeString: string) => number;
  formatPhoneNumber: (phoneNumber: string) => string;
  mapOrderStatusToEventType: (oldStatus: string, newStatus: string) => NotificationEventType | null;
};

describe('NotificationService', () => {
  // 創建NotificationService實例，用於測試
  let notificationService: NotificationService & PrivateNotificationService;
  
  // 模擬Firestore數據庫
  let mockFirestore: any;
  let mockCollection: jest.Mock;
  let mockDoc: jest.Mock;
  let mockWhere: jest.Mock;
  let mockLimit: jest.Mock;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockUpdate: jest.Mock;
  
  beforeEach(() => {
    // 重置所有模擬
    jest.clearAllMocks();
    
    // 設置模擬數據庫函數
    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockLimit = jest.fn().mockReturnThis();
    mockWhere = jest.fn().mockReturnThis();
    mockDoc = jest.fn().mockReturnValue({
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
      collection: jest.fn().mockImplementation(() => ({ doc: mockDoc }))
    });
    mockCollection = jest.fn().mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
      limit: mockLimit,
      get: mockGet
    });
    
    mockFirestore = {
      collection: mockCollection
    };
    
    // 模擬admin.firestore().collection調用
    (admin as any).firestore = jest.fn().mockReturnValue(mockFirestore);
    
    // 創建NotificationService實例
    notificationService = new NotificationService() as NotificationService & PrivateNotificationService;
    
    // 直接設置db屬性為模擬對象
    (notificationService as any).db = mockFirestore;
  });
  
  describe('replaceTemplateVariables', () => {
    it('should replace template variables with values', () => {
      // 準備測試數據
      const template = 'Hello {name}, your order #{orderNumber} is ready.';
      const variables = {
        name: 'John',
        orderNumber: '12345'
      };
      
      // 調用方法
      const result = notificationService.replaceTemplateVariables(template, variables);
      
      // 驗證結果
      expect(result).toBe('Hello John, your order #12345 is ready.');
    });
    
    it('should leave unreplaced variables as is', () => {
      // 準備測試數據
      const template = 'Hello {name}, your payment of {amount} is due.';
      const variables = {
        name: 'John'
        // 未提供amount變數
      };
      
      // 調用方法
      const result = notificationService.replaceTemplateVariables(template, variables);
      
      // 驗證結果
      expect(result).toBe('Hello John, your payment of {amount} is due.');
    });
    
    it('should handle empty templates and variables', () => {
      // 空模板
      expect(notificationService.replaceTemplateVariables('', {})).toBe('');
      
      // 無變數的模板
      expect(notificationService.replaceTemplateVariables('Plain text', {})).toBe('Plain text');
      
      // 空變數對象
      expect(notificationService.replaceTemplateVariables('Hello {name}', {})).toBe('Hello {name}');
    });
  });
  
  describe('isInQuietHours', () => {
    it('should return false when quiet hours are disabled', () => {
      // 準備測試數據 - 勿擾時段禁用
      const preferences: NotificationPreferences = {
        userId: 'test-user',
        channels: { appPush: true, sms: true, email: true },
        orderUpdates: true,
        promotions: false,
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00'
        },
        updatedAt: admin.firestore.Timestamp.now() as any
      };
      
      // 調用方法
      const result = notificationService.isInQuietHours(preferences);
      
      // 驗證結果
      expect(result).toBe(false);
    });
    
    it('should correctly identify time within quiet hours (non-crossing midnight)', () => {
      // 模擬當前時間為14:30
      jest.spyOn(global.Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(global.Date.prototype, 'getMinutes').mockReturnValue(30);
      
      // 準備測試數據 - 勿擾時段為13:00-16:00
      const preferences: NotificationPreferences = {
        userId: 'test-user',
        channels: { appPush: true, sms: true, email: true },
        orderUpdates: true,
        promotions: false,
        quietHours: {
          enabled: true,
          startTime: '13:00',
          endTime: '16:00'
        },
        updatedAt: admin.firestore.Timestamp.now() as any
      };
      
      // 調用方法
      const result = notificationService.isInQuietHours(preferences);
      
      // 驗證結果
      expect(result).toBe(true);
    });
    
    it('should correctly identify time outside quiet hours (non-crossing midnight)', () => {
      // 模擬當前時間為12:00
      jest.spyOn(global.Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(global.Date.prototype, 'getMinutes').mockReturnValue(0);
      
      // 準備測試數據 - 勿擾時段為13:00-16:00
      const preferences: NotificationPreferences = {
        userId: 'test-user',
        channels: { appPush: true, sms: true, email: true },
        orderUpdates: true,
        promotions: false,
        quietHours: {
          enabled: true,
          startTime: '13:00',
          endTime: '16:00'
        },
        updatedAt: admin.firestore.Timestamp.now() as any
      };
      
      // 調用方法
      const result = notificationService.isInQuietHours(preferences);
      
      // 驗證結果
      expect(result).toBe(false);
    });
    
    it('should handle quiet hours crossing midnight', () => {
      // 模擬當前時間為23:30
      jest.spyOn(global.Date.prototype, 'getHours').mockReturnValue(23);
      jest.spyOn(global.Date.prototype, 'getMinutes').mockReturnValue(30);
      
      // 準備測試數據 - 勿擾時段為22:00-08:00
      const preferences: NotificationPreferences = {
        userId: 'test-user',
        channels: { appPush: true, sms: true, email: true },
        orderUpdates: true,
        promotions: false,
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00'
        },
        updatedAt: admin.firestore.Timestamp.now() as any
      };
      
      // 調用方法
      const result = notificationService.isInQuietHours(preferences);
      
      // 驗證結果
      expect(result).toBe(true);
      
      // 模擬當前時間為02:00
      jest.spyOn(global.Date.prototype, 'getHours').mockReturnValue(2);
      jest.spyOn(global.Date.prototype, 'getMinutes').mockReturnValue(0);
      
      // 再次調用方法
      const result2 = notificationService.isInQuietHours(preferences);
      
      // 驗證結果
      expect(result2).toBe(true);
      
      // 模擬當前時間為12:00（不在勿擾時段）
      jest.spyOn(global.Date.prototype, 'getHours').mockReturnValue(12);
      jest.spyOn(global.Date.prototype, 'getMinutes').mockReturnValue(0);
      
      // 再次調用方法
      const result3 = notificationService.isInQuietHours(preferences);
      
      // 驗證結果
      expect(result3).toBe(false);
    });
  });
  
  describe('timeStringToMinutes', () => {
    it('should convert time string to minutes correctly', () => {
      // 測試各種時間格式
      expect(notificationService.timeStringToMinutes('00:00')).toBe(0);
      expect(notificationService.timeStringToMinutes('01:30')).toBe(130);
      expect(notificationService.timeStringToMinutes('12:00')).toBe(1200);
      expect(notificationService.timeStringToMinutes('23:59')).toBe(2359);
    });
  });
  
  describe('formatPhoneNumber', () => {
    it('should format Taiwan mobile numbers correctly', () => {
      // 測試台灣手機號碼格式
      expect(notificationService.formatPhoneNumber('0912345678')).toBe('+886912345678');
      expect(notificationService.formatPhoneNumber('912345678')).toBe('+886912345678');
    });
    
    it('should preserve E.164 formatted numbers', () => {
      expect(notificationService.formatPhoneNumber('+886912345678')).toBe('+886912345678');
      expect(notificationService.formatPhoneNumber('+12025550123')).toBe('+12025550123');
    });
    
    it('should handle non-standard formats', () => {
      expect(notificationService.formatPhoneNumber('(02) 1234-5678')).toBe('(02) 1234-5678');
    });
  });
  
  describe('mapOrderStatusToEventType', () => {
    it('should map order status changes to correct event types', () => {
      // 測試各種狀態變更
      expect(notificationService.mapOrderStatusToEventType('PENDING', 'CONFIRMED'))
        .toBe(NotificationEventType.ORDER_CONFIRMED);
        
      expect(notificationService.mapOrderStatusToEventType('CONFIRMED', 'PREPARING'))
        .toBe(NotificationEventType.ORDER_PREPARING);
        
      expect(notificationService.mapOrderStatusToEventType('PREPARING', 'READY'))
        .toBe(NotificationEventType.ORDER_READY);
        
      expect(notificationService.mapOrderStatusToEventType('READY', 'DELIVERING'))
        .toBe(NotificationEventType.ORDER_DELIVERING);
        
      expect(notificationService.mapOrderStatusToEventType('DELIVERING', 'COMPLETED'))
        .toBe(NotificationEventType.ORDER_COMPLETED);
        
      expect(notificationService.mapOrderStatusToEventType('CONFIRMED', 'CANCELLED'))
        .toBe(NotificationEventType.ORDER_CANCELLED);
        
      expect(notificationService.mapOrderStatusToEventType('PENDING', 'REJECTED'))
        .toBe(NotificationEventType.ORDER_REJECTED);
    });
    
    it('should return null for status changes that do not require notifications', () => {
      // 測試不需要通知的狀態變更
      expect(notificationService.mapOrderStatusToEventType('READY', 'READY')).toBeNull();
      expect(notificationService.mapOrderStatusToEventType('PENDING', 'UNKNOWN')).toBeNull();
    });
  });
}); 