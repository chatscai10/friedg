import { InventoryItemService } from '../inventory-item.service';
import { InventoryItemRepository } from '../../repositories/inventory-item.repository';
import { createMockInventoryItem } from '../../../../test/utils/mock-generator';
import { ItemNotFoundError } from '../../utils/errors';

// 模擬儲存庫
jest.mock('../../repositories/inventory-item.repository');

describe('InventoryItemService 測試', () => {
  let service: InventoryItemService;
  let mockRepository: jest.Mocked<InventoryItemRepository>;

  beforeEach(() => {
    // 清除所有模擬
    jest.clearAllMocks();
    
    // 創建模擬實例
    mockRepository = new InventoryItemRepository() as jest.Mocked<InventoryItemRepository>;
    service = new InventoryItemService(mockRepository);
  });

  describe('createItem 方法', () => {
    it('應成功創建庫存項目', async () => {
      const mockItem = createMockInventoryItem();
      mockRepository.createItem.mockResolvedValue(mockItem);
      
      const result = await service.createItem(mockItem);
      
      expect(result).toEqual(mockItem);
      expect(mockRepository.createItem).toHaveBeenCalledWith(mockItem);
    });

    it('創建項目時應處理錯誤', async () => {
      const mockItem = createMockInventoryItem({ name: '' }); // 無效資料
      const mockError = new Error('驗證失敗');
      
      mockRepository.createItem.mockRejectedValue(mockError);
      
      await expect(service.createItem(mockItem)).rejects.toThrow();
    });
  });
  
  describe('getItemById 方法', () => {
    it('應從儲存庫獲取項目', async () => {
      const mockItem = createMockInventoryItem();
      mockRepository.getById.mockResolvedValue(mockItem);
      
      const result = await service.getItemById(mockItem.id, mockItem.tenantId);
      
      expect(result).toEqual(mockItem);
      expect(mockRepository.getById).toHaveBeenCalledWith(mockItem.id, mockItem.tenantId);
    });
    
    it('當項目不存在時應拋出錯誤', async () => {
      mockRepository.getById.mockResolvedValue(null);
      
      await expect(service.getItemById('non-existent', 'tenant-123'))
        .rejects.toThrow(ItemNotFoundError);
    });
    
    it('應從緩存中獲取項目(如果存在)', async () => {
      const mockItem = createMockInventoryItem();
      mockRepository.getById.mockResolvedValue(mockItem);
      
      // 第一次呼叫，從儲存庫獲取
      await service.getItemById(mockItem.id, mockItem.tenantId);
      
      // 第二次呼叫，應該從緩存獲取
      await service.getItemById(mockItem.id, mockItem.tenantId);
      
      // 儲存庫方法應只被呼叫一次
      expect(mockRepository.getById).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('listItems 方法', () => {
    it('應返回庫存項目列表', async () => {
      const mockItems = [
        createMockInventoryItem(),
        createMockInventoryItem(),
        createMockInventoryItem()
      ];
      const mockFilter = { tenantId: 'tenant-123' };
      const mockResponse = {
        items: mockItems,
        total: mockItems.length,
        page: 1,
        pageSize: 10
      };
      
      mockRepository.listItems.mockResolvedValue(mockResponse);
      
      const result = await service.listItems(mockFilter);
      
      expect(result).toEqual(mockResponse);
      expect(mockRepository.listItems).toHaveBeenCalledWith(mockFilter);
    });
  });
  
  describe('updateItem 方法', () => {
    it('應成功更新庫存項目', async () => {
      const mockItem = createMockInventoryItem();
      const updateData = { name: '更新的名稱', price: 999 };
      
      mockRepository.updateItem.mockResolvedValue({
        ...mockItem,
        ...updateData
      });
      
      const result = await service.updateItem(
        mockItem.id,
        mockItem.tenantId,
        updateData
      );
      
      expect(result.name).toBe(updateData.name);
      expect(result.price).toBe(updateData.price);
      expect(mockRepository.updateItem).toHaveBeenCalledWith(
        mockItem.id,
        mockItem.tenantId,
        updateData
      );
    });
  });
  
  describe('deleteItem 方法', () => {
    it('應成功刪除庫存項目', async () => {
      const mockItem = createMockInventoryItem();
      mockRepository.deleteItem.mockResolvedValue({ success: true });
      
      const result = await service.deleteItem(
        mockItem.id,
        mockItem.tenantId,
        'user-123'
      );
      
      expect(result).toEqual({ success: true });
      expect(mockRepository.deleteItem).toHaveBeenCalledWith(
        mockItem.id,
        mockItem.tenantId,
        'user-123'
      );
    });
  });
}); 