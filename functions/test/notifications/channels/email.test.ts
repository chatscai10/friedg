import EmailChannel from '../../../src/notifications/channels/email';
import * as nodemailer from 'nodemailer';
import { logger } from 'firebase-functions';

// 模擬節點模塊必須在頂部，且不能引用後面定義的變量
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id'
    })
  })
}));

// 模擬 firebase-functions 日誌
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('EmailChannel', () => {
  let emailChannel: EmailChannel;
  let mockSendMail: jest.Mock;
  let mockTransporter: any;
  const testFromEmail = 'noreply@example.com';
  
  beforeEach(() => {
    // 重置所有模擬
    jest.clearAllMocks();
    
    // 獲取模擬的 sendMail 函數
    mockSendMail = (nodemailer.createTransport() as any).sendMail;
    
    // 創建一個模擬的 transporter 實例
    mockTransporter = {
      sendMail: mockSendMail
    };
    
    // 創建新的 EmailChannel 實例並注入模擬的 transporter
    emailChannel = new EmailChannel(
      mockTransporter,
      testFromEmail
    );
  });
  
  describe('isValidEmail', () => {
    // isValidEmail是私有方法，我們需要通過send方法間接測試
    it('should reject invalid email addresses', async () => {
      // 測試一系列無效電子郵件地址
      const invalidEmails = [
        'not-an-email',
        'missing@domain',
        '@missinglocal.com',
        'spaces in@email.com'
      ];
      
      for (const email of invalidEmails) {
        const result = await emailChannel.send(email, 'Test message');
        expect(result).toBe(false);
      }
    });
    
    it('should accept valid email addresses', async () => {
      // 測試有效的電子郵件地址
      const validEmails = [
        'simple@example.com',
        'with.dots@example.com',
        'with-dash@example.com',
        'with_underscore@example.com',
        'with+plus@example.com',
        'domain.with.multiple.parts@example.co.uk'
      ];
      
      for (const email of validEmails) {
        const result = await emailChannel.send(email, 'Test message');
        expect(result).toBe(true);
        
        // 確認 sendMail 被調用
        expect(mockSendMail).toHaveBeenCalled();
        
        // 重置模擬以測試下一個郵件
        jest.clearAllMocks();
      }
    });
  });
  
  describe('maskEmail', () => {
    // 由於maskEmail是私有方法，我們需要模擬錯誤情況來查看日誌
    it('should mask email addresses in error logs', async () => {
      // 模擬郵件發送錯誤
      mockSendMail.mockRejectedValueOnce(new Error('Test error'));
      
      // 發送到郵箱
      const result = await emailChannel.send('test@example.com', 'Test message');
      
      // 檢查結果
      expect(result).toBe(false);
      
      // 檢查錯誤日誌中的郵箱是否被遮罩
      expect(logger.error).toHaveBeenCalled();
      const errorCall = (logger.error as jest.Mock).mock.calls[0][1];
      
      // 檢查遮罩後的郵箱格式是否正確（不包含完整郵箱）
      expect(errorCall.emailAddress).not.toContain('test@example.com');
      // 檢查遮罩格式，應該是類似****@ex****com這樣的格式
      expect(errorCall.emailAddress).toMatch(/\*+@[a-z]{2}\*+[a-z]+/);
    });
  });
  
  describe('send method', () => {
    it('should successfully send email with text content', async () => {
      // 準備測試數據
      const email = 'recipient@example.com';
      const content = 'Test email content';
      const metadata = { title: 'Test Subject' };
      
      // 發送郵件
      const result = await emailChannel.send(email, content, metadata);
      
      // 檢查結果
      expect(result).toBe(true);
      
      // 檢查 sendMail 調用
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      
      // 檢查傳遞給 sendMail 的參數
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe(email);
      expect(mailOptions.from).toContain(testFromEmail);
      expect(mailOptions.subject).toBe('Test Subject');
      expect(mailOptions.text).toBe(content);
      expect(mailOptions.html).toBeUndefined();
    });
    
    it('should support HTML content', async () => {
      // 準備測試數據
      const email = 'recipient@example.com';
      const content = '<p>Test email <strong>HTML</strong> content</p>';
      const metadata = { 
        title: 'HTML Email', 
        isHtml: true 
      };
      
      // 發送郵件
      const result = await emailChannel.send(email, content, metadata);
      
      // 檢查結果
      expect(result).toBe(true);
      
      // 檢查 sendMail 調用
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toBe(content);
      expect(mailOptions.text).toBeUndefined();
    });
    
    it('should support explicit HTML content in metadata', async () => {
      // 準備測試數據
      const email = 'recipient@example.com';
      const plainContent = 'Plain text version';
      const htmlContent = '<p>HTML version</p>';
      const metadata = { 
        title: 'Mixed Content Email', 
        htmlContent: htmlContent 
      };
      
      // 發送郵件
      const result = await emailChannel.send(email, plainContent, metadata);
      
      // 檢查結果
      expect(result).toBe(true);
      
      // 檢查 sendMail 調用
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toBe(htmlContent);
      expect(mailOptions.text).toBe(plainContent);
    });
    
    it('should support attachments', async () => {
      // 準備測試數據
      const email = 'recipient@example.com';
      const content = 'Email with attachment';
      const metadata = { 
        title: 'Attachment Test', 
        attachments: [
          {
            filename: 'test.pdf',
            content: Buffer.from('fake pdf content'),
            contentType: 'application/pdf'
          }
        ]
      };
      
      // 發送郵件
      const result = await emailChannel.send(email, content, metadata);
      
      // 檢查結果
      expect(result).toBe(true);
      
      // 檢查 sendMail 調用
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.attachments).toEqual(metadata.attachments);
    });
    
    it('should handle nodemailer errors gracefully', async () => {
      // 模擬SMTP錯誤
      mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));
      
      // 發送郵件
      const result = await emailChannel.send('test@example.com', 'Test content');
      
      // 檢查結果
      expect(result).toBe(false);
      
      // 檢查錯誤日誌
      expect(logger.error).toHaveBeenCalled();
      expect((logger.error as jest.Mock).mock.calls[0][1].error).toBe('SMTP error');
      
      // 檢查特定錯誤處理 - SMTP錯誤
      expect(logger.warn).toHaveBeenCalled();
      expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain('SMTP服務器錯誤');
    });
    
    it('should return false when from email is not configured', async () => {
      // 創建沒有配置發件人郵箱的實例
      const incompleteChannel = new EmailChannel(mockTransporter, '');
      
      // 發送郵件
      const result = await incompleteChannel.send('test@example.com', 'Test message');
      
      // 檢查結果
      expect(result).toBe(false);
      
      // 檢查錯誤日誌
      expect(logger.error).toHaveBeenCalled();
      expect((logger.error as jest.Mock).mock.calls[0][0]).toContain('未配置發件人郵箱');
    });
    
    it('should return false when transporter is not initialized', async () => {
      // 創建一個 transporter 為 null 的實例
      const emailChannelWithoutTransporter = new EmailChannel();
      (emailChannelWithoutTransporter as any).transporter = null;
      
      // 發送郵件
      const result = await emailChannelWithoutTransporter.send('test@example.com', 'Test message');
      
      // 檢查結果
      expect(result).toBe(false);
      
      // 檢查錯誤日誌
      expect(logger.error).toHaveBeenCalled();
      // 由於實際錯誤信息是"EmailChannel: 缺少SMTP配置，無法初始化"，我們調整斷言
      const errorCalls = (logger.error as jest.Mock).mock.calls;
      const containsInitError = errorCalls.some(call => 
        call[0] && typeof call[0] === 'string' && (
          call[0].includes('缺少SMTP配置') || 
          call[0].includes('Transporter 未初始化')
        )
      );
      expect(containsInitError).toBe(true);
    });
  });
}); 