import * as admin from 'firebase-admin';

/**
 * 廣告請求上下文介面
 * 包含廣告請求時的相關信息，用於精準投放
 */
export interface AdRequestContext {
  deviceType?: 'desktop' | 'mobile' | 'tablet';  // 設備類型
  browser?: string;                              // 瀏覽器類型
  location?: {                                   // 位置信息
    country?: string;                            // 國家/地區
    city?: string;                               // 城市
    coordinates?: {                              // 精確坐標
      lat: number;                               // 緯度
      lng: number;                               // 經度
    }
  };
  userInfo?: {                                   // 用戶信息
    userId?: string;                             // 用戶ID（如有）
    tenantId?: string;                           // 租戶ID（如適用）
    userAgent?: string;                          // User Agent字符串
    language?: string;                           // 語言設置
  };
  timestamp?: Date | admin.firestore.Timestamp;  // 請求時間
}

/**
 * 廣告服務響應介面
 * 包含返回給前端的廣告信息
 */
export interface AdServeResponse {
  creative: AdCreative | null;                   // 廣告創意
  assignment?: {                                 // 相關的分配信息
    id: string;                                  // 分配ID
    placementId: string;                         // 廣告位置ID
  };
  trackingInfo?: {                               // 追蹤信息
    impressionUrl: string;                       // 曝光追蹤URL
    clickUrl: string;                            // 點擊追蹤URL
  };
}

/**
 * 廣告放置位置介面
 * 定義系統中顯示廣告的位置
 */
export interface AdPlacement {
  id: string;                          // 廣告位置ID
  name: string;                        // 廣告位置名稱，如"首頁頂部橫幅"
  description?: string;                // 廣告位置描述
  type: 'banner' | 'popup' | 'inpage' | 'feed' | 'listing'; // 廣告位置類型
  location: string;                    // 位置路徑，如"home/top"
  size: {                              // 廣告尺寸規格
    width: number;                     // 寬度，單位像素
    height: number;                    // 高度，單位像素
  };
  maxAdsPerView: number;               // 單次展示最大廣告數
  status: 'active' | 'inactive';       // 廣告位置狀態
  tags?: string[];                     // 標籤，用於分類和篩選
  availableToTenants?: string[];       // 可使用此廣告位的租戶ID清單
  pricePerImpression?: number;         // 每次展示價格
  pricePerClick?: number;              // 每次點擊價格
  createdAt: Date | admin.firestore.Timestamp; // 創建時間
  updatedAt: Date | admin.firestore.Timestamp; // 更新時間
}

/**
 * 廣告活動介面
 * 定義廣告活動相關屬性
 */
export interface AdCampaign {
  id: string;                          // 廣告活動ID
  tenantId: string;                    // 租戶ID
  name: string;                        // 活動名稱
  description?: string;                // 活動描述
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'; // 活動狀態
  budget: number;                      // 總預算
  startDate: Date | admin.firestore.Timestamp; // 開始日期
  endDate?: Date | admin.firestore.Timestamp;  // 結束日期
  targetAudience?: {                   // 目標受眾
    ageRange?: {                       // 年齡範圍
      min?: number;                    // 最小年齡
      max?: number;                    // 最大年齡
    };
    gender?: 'male' | 'female' | 'all'; // 性別
    location?: string[];               // 地理位置
    interests?: string[];              // 興趣標籤
  };
  schedule?: {                         // 排程詳情
    daysOfWeek?: number[];            // 週幾播放 (0-6，0代表週日)
    hoursOfDay?: number[];            // 一天中的哪些小時播放 (0-23)
  };
  placementIds: string[];              // 投放位置ID清單
  contentIds: string[];                // 廣告內容ID清單
  dailyBudget?: number;                // 每日預算限制
  bidStrategy?: 'auto' | 'manual';     // 出價策略
  manualBid?: {                        // 手動出價設定
    maxBidPerImpression?: number;      // 每次展示最高出價
    maxBidPerClick?: number;           // 每次點擊最高出價
  };
  performance?: {                      // 廣告表現數據
    impressions: number;               // 曝光數
    clicks: number;                    // 點擊數
    conversions: number;               // 轉換數
    spend: number;                     // 已花費金額
    ctr: number;                       // 點擊率 (Click-Through Rate)
    cpc: number;                       // 每次點擊成本 (Cost Per Click)
    cpm: number;                       // 千次曝光成本 (Cost Per Mille)
    lastUpdated: Date | admin.firestore.Timestamp; // 數據更新時間
  };
  createdAt: Date | admin.firestore.Timestamp; // 創建時間
  updatedAt: Date | admin.firestore.Timestamp; // 更新時間
}

/**
 * 廣告創意介面
 * 定義廣告的具體內容和素材
 */
export interface AdCreative {
  id: string;                          // 廣告創意ID
  tenantId: string;                    // 租戶ID
  campaignId?: string;                 // 關聯的廣告活動ID
  name: string;                        // 創意名稱
  type: 'image' | 'video' | 'html' | 'text'; // 創意類型
  status: 'draft' | 'active' | 'paused' | 'archived'; // 創意狀態
  content: {                           // 創意內容
    title?: string;                    // 標題
    description?: string;              // 描述文字
    imageUrl?: string;                 // 圖片URL
    videoUrl?: string;                 // 視頻URL
    htmlContent?: string;              // HTML內容
    callToAction?: {                   // 行動呼籲
      text: string;                    // 按鈕文字
      url: string;                     // 跳轉連結
    };
    dimensions: {                      // 尺寸
      width: number;                   // 寬度
      height: number;                  // 高度
    };
  };
  compatiblePlacements?: string[];     // 兼容的廣告位ID清單
  targetUrl: string;                   // 目標跳轉URL
  trackingPixelUrl?: string;           // 追蹤像素URL
  performance?: {                      // 創意表現數據
    impressions: number;               // 曝光數
    clicks: number;                    // 點擊數
    ctr: number;                       // 點擊率
    lastUpdated: Date | admin.firestore.Timestamp; // 數據更新時間
  };
  startDate?: Date | admin.firestore.Timestamp; // 開始展示日期
  endDate?: Date | admin.firestore.Timestamp;   // 結束展示日期
  approvalStatus?: 'pending' | 'approved' | 'rejected'; // 審核狀態
  approvalFeedback?: string;           // 審核反饋
  tags?: string[];                     // 標籤
  createdAt: Date | admin.firestore.Timestamp; // 創建時間
  updatedAt: Date | admin.firestore.Timestamp; // 更新時間
}

/**
 * 廣告放置分配介面
 * 定義特定廣告創意在特定廣告位置的投放關係
 */
export interface AdPlacementAssignment {
  id: string;                          // 分配ID
  placementId: string;                 // 廣告位置ID
  creativeId: string;                  // 廣告創意ID
  campaignId?: string;                 // 關聯的廣告活動ID
  tenantId: string;                    // 租戶ID
  priority: number;                    // 優先級 (數字越高越優先)
  status: 'active' | 'inactive' | 'scheduled' | 'completed'; // 分配狀態
  startDate: Date | admin.firestore.Timestamp; // 開始投放日期
  endDate?: Date | admin.firestore.Timestamp;  // 結束投放日期
  schedule?: {                         // 投放排程詳情
    daysOfWeek?: number[];            // 週幾投放 (0-6，0代表週日)
    hoursOfDay?: number[];            // 一天中的哪些小時投放 (0-23)
  };
  displayConditions?: {                // 顯示條件
    deviceTypes?: string[];           // 設備類型 (desktop, mobile, tablet)
    browsers?: string[];              // 瀏覽器類型
    geoTargeting?: {                  // 地理位置定向
      countries?: string[];           // 國家/地區
      cities?: string[];              // 城市
      radius?: {                      // 半徑定向
        lat: number;                  // 緯度
        lng: number;                  // 經度
        km: number;                   // 公里
      }
    }
  };
  impressionLimit?: number;            // 曝光次數限制
  clickLimit?: number;                 // 點擊次數限制
  performance?: {                      // 效能數據
    impressions: number;               // 曝光次數
    clicks: number;                    // 點擊次數
    ctr: number;                       // 點擊率
    lastUpdated: Date | admin.firestore.Timestamp; // 更新時間
  };
  createdAt: Date | admin.firestore.Timestamp; // 創建時間
  updatedAt: Date | admin.firestore.Timestamp; // 更新時間
  createdBy?: string;                  // 創建者ID
  updatedBy?: string;                  // 更新者ID
} 