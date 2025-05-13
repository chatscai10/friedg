import { AxiosError } from 'axios';
import { FirebaseError } from 'firebase/app';

/**
 * 處理API錯誤的統一方法
 * 用於提取並格式化來自API的錯誤信息
 * 
 * @param error - 捕獲的錯誤對象
 * @returns 格式化的錯誤信息
 */
export const handleApiError = (error: unknown): string => {
  // 處理Axios錯誤
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<{ message?: string, errorCode?: string }>;
    
    if (axiosError.response?.data) {
      // 返回API響應中的錯誤消息（如果存在）
      return axiosError.response.data.message || 
             `操作失敗 (錯誤碼: ${axiosError.response.data.errorCode || axiosError.response.status})`;
    }
    
    // 網絡錯誤或請求被取消
    if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
      return '請求超時，請檢查您的網絡連接';
    }
    
    if (!axiosError.response) {
      return '無法連接到服務器，請檢查您的網絡連接';
    }
    
    // 使用HTTP狀態碼
    const statusCode = axiosError.response.status;
    switch (statusCode) {
      case 401:
        return '未授權的操作，請重新登入';
      case 403:
        return '您沒有執行此操作的權限';
      case 404:
        return '請求的資源不存在';
      case 500:
      case 502:
      case 503:
        return '伺服器出現問題，請稍後再試';
      default:
        return `操作失敗 (錯誤碼: ${statusCode})`;
    }
  }
  
  // 處理Firebase錯誤
  if (error && typeof error === 'object' && 'code' in error) {
    const firebaseError = error as FirebaseError;
    
    // 映射常見的Firebase錯誤代碼
    switch (firebaseError.code) {
      case 'auth/user-not-found':
        return '找不到用戶，請檢查您的登入資訊';
      case 'auth/wrong-password':
        return '密碼不正確';
      case 'auth/invalid-email':
        return '無效的電子郵件格式';
      case 'auth/email-already-in-use':
        return '此電子郵件已被使用';
      case 'auth/weak-password':
        return '密碼強度不足，請使用更複雜的密碼';
      case 'auth/network-request-failed':
        return '網絡請求失敗，請檢查您的連接';
      case 'auth/too-many-requests':
        return '頻繁的登入嘗試，請稍後再試';
      case 'auth/operation-not-allowed':
        return '此操作不被允許';
      case 'auth/account-exists-with-different-credential':
        return '已存在使用不同認證方式的帳號';
      case 'auth/requires-recent-login':
        return '此操作需要重新登入，請先登出後再嘗試';
      // Firestore 錯誤
      case 'permission-denied':
        return '您沒有執行此操作的權限';
      case 'unavailable':
        return '服務暫時不可用，請稍後再試';
      case 'data-loss':
        return '數據丟失或損壞';
      case 'deadline-exceeded':
        return '操作超時，請稍後再試';
      default:
        // 使用Firebase提供的錯誤消息
        return firebaseError.message || `操作失敗 (錯誤碼: ${firebaseError.code})`;
    }
  }
  
  // 處理基本JavaScript錯誤
  if (error instanceof Error) {
    return error.message || '發生未知錯誤';
  }
  
  // 處理其他錯誤類型
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  // 未知錯誤類型
  return '發生未知錯誤';
};

/**
 * 嘗試執行函數並處理錯誤
 * 用於異步操作中的錯誤處理
 * 
 * @param fn - 要執行的異步函數
 * @param errorHandler - 錯誤處理函數
 * @returns 函數執行結果或空值
 */
export const tryCatchAsync = async <T>(
  fn: () => Promise<T>,
  errorHandler: (error: unknown) => void
): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    const errorMessage = handleApiError(error);
    errorHandler(errorMessage);
    return null;
  }
}; 