/**
 * 未彌補虧損追蹤服務
 * 負責計算、更新並維護股權池的累計未彌補虧損
 */

import * as admin from 'firebase-admin';

// Firestore 引用
const db = admin.firestore();
const equityPoolCollection = db.collection('equity_pool');

/**
 * 更新股權池的未彌補虧損
 * 
 * @param poolId 股權池ID
 * @param quarterlyNetProfit 季度稅後淨利（可正可負）
 * @returns 更新後的未彌補虧損值
 */
export async function updateUncompensatedLosses(
  poolId: string, 
  quarterlyNetProfit: number
): Promise<number> {
  try {
    console.log(`更新股權池 ${poolId} 的未彌補虧損，季度淨利: ${quarterlyNetProfit}`);
    
    // 1. 獲取股權池的當前未彌補虧損值
    const poolDoc = await equityPoolCollection.doc(poolId).get();
    
    if (!poolDoc.exists) {
      console.error(`股權池 ${poolId} 不存在`);
      throw new Error(`股權池 ${poolId} 不存在`);
    }
    
    const poolData = poolDoc.data() || {};
    const currentUncompensatedLosses = poolData.uncompensatedLosses || 0;
    
    // 2. 根據季度淨利計算新的未彌補虧損值
    let newUncompensatedLosses = currentUncompensatedLosses;
    
    if (quarterlyNetProfit < 0) {
      // 當季虧損，增加未彌補虧損
      newUncompensatedLosses += Math.abs(quarterlyNetProfit);
      console.log(`季度虧損 ${Math.abs(quarterlyNetProfit)}，未彌補虧損從 ${currentUncompensatedLosses} 增加到 ${newUncompensatedLosses}`);
    } else if (quarterlyNetProfit > 0) {
      // 當季盈利，減少未彌補虧損（但不低於0）
      newUncompensatedLosses = Math.max(0, currentUncompensatedLosses - quarterlyNetProfit);
      console.log(`季度盈利 ${quarterlyNetProfit}，未彌補虧損從 ${currentUncompensatedLosses} 減少到 ${newUncompensatedLosses}`);
    }
    
    // 3. 更新股權池文件中的未彌補虧損值
    await equityPoolCollection.doc(poolId).update({
      uncompensatedLosses: newUncompensatedLosses,
      updatedAt: admin.firestore.Timestamp.now().toDate()
    });
    
    console.log(`成功更新股權池 ${poolId} 的未彌補虧損為 ${newUncompensatedLosses}`);
    
    // 4. 返回更新後的值
    return newUncompensatedLosses;
  } catch (error) {
    console.error(`更新股權池 ${poolId} 的未彌補虧損時發生錯誤:`, error);
    throw error;
  }
} 