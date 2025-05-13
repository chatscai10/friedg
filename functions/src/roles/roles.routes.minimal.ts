import * as express from 'express';
import * as admin from 'firebase-admin';

const router = express.Router();

// 獲取角色列表 - 簡化版本，只返回測試數據
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/v1/roles 請求收到');
    
    // 返回測試數據
    res.status(200).json({
      status: 'success',
      data: [
        {
          roleId: 'test-role-1',
          roleName: '測試角色1',
          description: '這是一個測試角色',
          createdAt: new Date().toISOString()
        },
        {
          roleId: 'test-role-2',
          roleName: '測試角色2',
          description: '這是另一個測試角色',
          createdAt: new Date().toISOString()
        }
      ],
      message: '成功獲取角色列表'
    });
  } catch (error) {
    console.error('獲取角色列表時出錯:', error);
    res.status(500).json({
      status: 'error',
      message: '獲取角色列表時發生錯誤',
      error: error.message
    });
  }
});

// 獲取角色詳情 - 簡化版本
router.get('/:roleId', async (req, res) => {
  try {
    const { roleId } = req.params;
    console.log(`GET /api/v1/roles/${roleId} 請求收到`);
    
    // 返回測試數據
    res.status(200).json({
      status: 'success',
      data: {
        roleId: roleId,
        roleName: '測試角色' + roleId,
        description: `這是角色${roleId}的詳情`,
        createdAt: new Date().toISOString()
      },
      message: '成功獲取角色詳情'
    });
  } catch (error) {
    console.error('獲取角色詳情時出錯:', error);
    res.status(500).json({
      status: 'error',
      message: '獲取角色詳情時發生錯誤',
      error: error.message
    });
  }
});

export default router; 