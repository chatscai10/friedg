import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as line from '@line/bot-sdk';
import { CustomerFeedback, QuestionAnswer, LineBotInteraction, BotState } from './types';
import { v4 as uuidv4 } from 'uuid';

// 預設租戶ID - 實際使用時應根據機器人配置獲取
const DEFAULT_TENANT_ID = 'default_tenant';

// LINE Bot Channel配置，從環境變數中獲取
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

// 創建LINE Client實例
const lineClient = new line.Client(lineConfig);

/**
 * LINE Bot Webhook函數
 * 處理來自LINE平台的事件，並根據事件類型執行對應邏輯
 */
export const lineBotWebhook = functions.https.onRequest(async (req, res) => {
  // 記錄收到的請求
  console.log('Received LINE webhook request');
  
  // 檢查 HTTP 方法
  if (req.method !== 'POST') {
    console.error(`Invalid request method: ${req.method}`);
    res.status(405).send('Method Not Allowed');
    return;
  }

  // 驗證LINE平台請求簽名
  const signature = req.headers['x-line-signature'] as string;
  if (!signature) {
    console.error('Missing LINE signature');
    res.status(400).send('Bad Request: Missing signature');
    return;
  }

  try {
    // 驗證請求簽名
    const body = JSON.stringify(req.body);
    const isValid = line.validateSignature(body, lineConfig.channelSecret, signature);
    
    if (!isValid) {
      console.error('Invalid LINE signature');
      res.status(401).send('Unauthorized: Invalid signature');
      return;
    }

    // 確認請求合法後，處理LINE事件
    await handleLineEvents(req.body.events);
    
    // 返回成功響應
    res.status(200).send('OK');
    return;
  } catch (error) {
    console.error('Error processing LINE webhook:', error);
    res.status(500).send('Internal Server Error');
    return;
  }
});

/**
 * 處理LINE平台事件
 * 
 * @param events LINE事件陣列
 */
async function handleLineEvents(events: line.WebhookEvent[]): Promise<void> {
  // 檢查事件陣列是否存在
  if (!events || events.length === 0) {
    console.log('No events received');
    return;
  }

  // 遍歷處理每一個事件
  for (const event of events) {
    // 記錄事件詳情到日誌
    console.log('Received LINE event:', JSON.stringify(event));
    
    // 根據事件類型執行不同邏輯
    switch (event.type) {
      case 'message':
        if (event.message.type === 'text') {
          await handleTextMessage(event);
        } else {
          console.log(`Received ${event.message.type} message from ${event.source.userId || 'unknown user'}`);
        }
        break;
        
      case 'follow':
        console.log(`User ${event.source.userId} followed the bot`);
        await handleFollowEvent(event);
        break;
        
      case 'unfollow':
        console.log(`User ${event.source.userId} unfollowed the bot`);
        break;
        
      case 'postback':
        console.log(`Received postback event from ${event.source.userId}, data: ${event.postback.data}`);
        await handlePostbackEvent(event);
        break;
        
      default:
        console.log(`Received ${event.type} event`);
        break;
    }
  }
}

/**
 * 處理文字訊息
 * 
 * @param event LINE文字訊息事件
 */
async function handleTextMessage(event: line.MessageEvent): Promise<void> {
  if (event.message.type !== 'text' || !event.source.userId) {
    return;
  }
  
  const userId = event.source.userId;
  const messageText = event.message.text;
  
  try {
    // 1. 檢查用戶當前狀態，判斷是否是在提交評價
    const userState = await getUserState(userId);
    
    // 2. 根據用戶狀態處理文字訊息
    if (userState.currentState === 'asking_question' || messageText.toLowerCase().includes('評價')) {
      // 假設：用戶處於問卷回答階段，或者訊息包含「評價」關鍵字，視為提交評價
      await saveCustomerFeedback(userId, messageText, userState);
      
      // 回覆確認訊息
      await replyToUser(event.replyToken, '感謝您的評價！您的意見對我們非常重要。');
      
      // 更新用戶狀態為已完成
      await updateUserState(userId, 'completed');
    } else {
      // 其他一般訊息，簡單回覆
      await replyToUser(event.replyToken, '您好！如需提交評價，請輸入「我要評價」或回答我們的問題。');
    }
  } catch (error) {
    console.error('Error handling text message:', error);
  }
}

/**
 * 處理關注事件
 * 
 * @param event LINE關注事件
 */
async function handleFollowEvent(event: line.FollowEvent): Promise<void> {
  if (!event.source.userId) {
    return;
  }
  
  const userId = event.source.userId;
  
  try {
    // 初始化用戶狀態
    await initializeUserState(userId);
    
    // 發送歡迎訊息，邀請用戶提交評價
    await replyToUser(event.replyToken, '感謝您加入我們！您可以隨時輸入「我要評價」來提交您對我們服務的評價。');
  } catch (error) {
    console.error('Error handling follow event:', error);
  }
}

/**
 * 處理按鈕回傳事件
 * 
 * @param event LINE按鈕回傳事件
 */
async function handlePostbackEvent(event: line.PostbackEvent): Promise<void> {
  if (!event.source.userId) {
    return;
  }
  
  const userId = event.source.userId;
  const postbackData = event.postback.data;
  
  try {
    // 解析postback資料
    const params = new URLSearchParams(postbackData);
    const action = params.get('action');
    
    if (action === 'rate') {
      // 假設：用戶點擊了評分按鈕
      const rating = parseInt(params.get('value') || '0', 10);
      
      if (rating > 0 && rating <= 5) {
        // 獲取用戶狀態
        const userState = await getUserState(userId);
        
        // 儲存評分
        await saveCustomerRating(userId, rating, userState);
        
        // 回覆確認訊息，詢問額外評語
        await replyToUser(event.replyToken, `感謝您的${rating}分評價！您還有任何其他意見或建議嗎？`);
        
        // 更新用戶狀態
        await updateUserState(userId, 'asking_question');
      }
    }
  } catch (error) {
    console.error('Error handling postback event:', error);
  }
}

/**
 * 儲存顧客評價
 * 
 * @param userId LINE用戶ID
 * @param feedbackText 評價文字內容
 * @param userState 用戶當前狀態
 */
async function saveCustomerFeedback(
  userId: string, 
  feedbackText: string, 
  userState: LineBotInteraction
): Promise<void> {
  // 獲取關聯的訂單ID
  // 注意：這裡我們假設通過查詢用戶互動狀態獲取訂單ID
  // 實際情況可能需要從userState中取得，或查詢其他系統
  const orderId = await findRelevantOrderId(userId, userState);
  
  // 獲取店鋪ID（假設）
  const storeId = userState.feedback?.storeId || await findRelevantStoreId(userId);
  
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 創建問題回答對象
  const textAnswer: QuestionAnswer = {
    questionId: 'general_feedback', // 假設ID
    questionText: '您對我們的服務有何評價？',
    answerType: 'text',
    textAnswer: feedbackText
  };
  
  // 獲取或創建問卷ID
  const questionnaireId = userState.questionnaireId || 'default_questionnaire';
  
  // 創建評價記錄
  const feedback: Omit<CustomerFeedback, 'id'> = {
    tenantId: DEFAULT_TENANT_ID,
    lineUserId: userId,
    questionnaireId: questionnaireId,
    orderId: orderId,
    storeId: storeId,
    answers: [textAnswer],
    additionalComments: feedbackText,
    status: 'completed',
    feedbackChannel: 'line_bot',
    createdAt: now,
    completedAt: now
  };
  
  // 如果有評分，添加總體評分
  if (userState.feedback?.overallRating) {
    feedback.overallRating = userState.feedback.overallRating;
  }
  
  // 將評價記錄儲存至Firestore
  await db.collection('customerFeedback').add(feedback);
  console.log(`Saved customer feedback from user ${userId}`);
}

/**
 * 儲存顧客評分
 * 
 * @param userId LINE用戶ID
 * @param rating 評分（1-5分）
 * @param userState 用戶當前狀態
 */
async function saveCustomerRating(
  userId: string,
  rating: number,
  userState: LineBotInteraction
): Promise<void> {
  // 更新用戶互動資料中的評分
  const db = admin.firestore();
  const interactionRef = db.collection('lineBotInteractions').doc(userState.id);
  
  // 確保feedback屬性存在
  const feedback = userState.feedback || {};
  feedback.overallRating = rating;
  
  // 更新互動記錄
  await interactionRef.update({
    'feedback.overallRating': rating,
    lastInteractionAt: admin.firestore.Timestamp.now().toDate()
  });
  
  console.log(`Saved rating ${rating} from user ${userId}`);
}

/**
 * 獲取用戶當前狀態
 * 
 * @param userId LINE用戶ID
 * @returns 用戶互動狀態
 */
async function getUserState(userId: string): Promise<LineBotInteraction> {
  const db = admin.firestore();
  
  // 查詢用戶最近的互動記錄
  const snapshot = await db.collection('lineBotInteractions')
    .where('lineUserId', '==', userId)
    .orderBy('lastInteractionAt', 'desc')
    .limit(1)
    .get();
  
  // 如果找到記錄，返回該記錄
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as LineBotInteraction;
  }
  
  // 如果沒有記錄，初始化並返回新記錄
  return await initializeUserState(userId);
}

/**
 * 初始化用戶狀態
 * 
 * @param userId LINE用戶ID
 * @returns 新建的用戶互動狀態
 */
async function initializeUserState(userId: string): Promise<LineBotInteraction> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 創建新的互動記錄
  const newInteraction: Omit<LineBotInteraction, 'id'> = {
    lineUserId: userId,
    currentState: 'idle',
    lastInteractionAt: now,
    createdAt: now
  };
  
  // 寫入Firestore
  const docRef = await db.collection('lineBotInteractions').add(newInteraction);
  
  // 返回完整記錄（包含ID）
  return {
    ...newInteraction,
    id: docRef.id
  };
}

/**
 * 更新用戶狀態
 * 
 * @param userId LINE用戶ID
 * @param newState 新狀態
 */
async function updateUserState(userId: string, newState: BotState): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 獲取用戶當前記錄
  const userState = await getUserState(userId);
  
  // 更新狀態
  await db.collection('lineBotInteractions').doc(userState.id).update({
    currentState: newState,
    lastInteractionAt: now
  });
}

/**
 * 查找關聯的訂單ID
 * 
 * @param userId LINE用戶ID
 * @param userState 用戶當前狀態
 * @returns 關聯訂單ID或undefined
 */
async function findRelevantOrderId(
  userId: string,
  userState: LineBotInteraction
): Promise<string | undefined> {
  // 假設情境：
  // 1. 首先檢查用戶當前互動狀態中是否已有訂單ID
  if (userState.feedback?.orderId) {
    return userState.feedback.orderId;
  }
  
  // 2. 如果沒有，則嘗試從orders集合中查找該用戶最近的訂單
  // 注意：這是一個假設的邏輯，實際情況可能需要結合其他用戶識別方式（如會員ID）
  try {
    const db = admin.firestore();
    
    // 假設：通過line_user_id關聯查詢會員ID
    const memberSnapshot = await db.collection('members')
      .where('lineUserId', '==', userId)
      .limit(1)
      .get();
    
    if (!memberSnapshot.empty) {
      const memberId = memberSnapshot.docs[0].id;
      
      // 使用會員ID查詢最近訂單
      const orderSnapshot = await db.collection('orders')
        .where('memberId', '==', memberId)
        .where('status', '==', 'completed')  // 假設只考慮已完成的訂單
        .orderBy('completedAt', 'desc')
        .limit(1)
        .get();
      
      if (!orderSnapshot.empty) {
        return orderSnapshot.docs[0].id;
      }
    }
    
    // 如果上述查詢都未找到訂單，則返回undefined
    return undefined;
  } catch (error) {
    console.error('Error finding relevant order ID:', error);
    return undefined;
  }
}

/**
 * 查找關聯的店鋪ID
 * 
 * @param userId LINE用戶ID
 * @returns 店鋪ID或undefined
 */
async function findRelevantStoreId(userId: string): Promise<string | undefined> {
  // 假設的邏輯：根據LINE官方帳號關聯的店鋪ID
  // 實際情況可能需要更複雜的邏輯
  
  // 在真實實現中，可能需要：
  // 1. 從LINE消息的context或rich menu中獲取店鋪資訊
  // 2. 從用戶最近訪問或下單的店鋪獲取
  // 3. 從用戶上下文中獲取
  
  // 這裡簡化為一個預設值
  return 'default_store';
}

/**
 * 回覆用戶訊息
 * 
 * @param replyToken LINE回覆令牌
 * @param message 回覆訊息
 */
async function replyToUser(replyToken: string, message: string): Promise<void> {
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: message
    });
  } catch (error) {
    console.error('Error replying to user:', error);
  }
} 