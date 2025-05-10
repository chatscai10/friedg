/**
 * 租戶探索平台資料模型
 * 包含店家專頁、搜尋和排行榜相關的資料結構定義
 */

/**
 * 店家營業時間
 */
export interface BusinessHours {
  day: number;           // 星期幾 (0-6, 0為星期日)
  isOpen: boolean;       // 是否營業
  openTime?: string;     // 開始營業時間 (格式: HH:MM)
  closeTime?: string;    // 結束營業時間 (格式: HH:MM)
  breakStart?: string;   // 休息開始時間 (格式: HH:MM)
  breakEnd?: string;     // 休息結束時間 (格式: HH:MM)
}

/**
 * 店家地理位置
 */
export interface StoreLocation {
  address: string;       // 完整地址
  city: string;          // 城市
  district?: string;     // 區域
  postalCode?: string;   // 郵遞區號
  lat: number;           // 緯度
  lng: number;           // 經度
}

/**
 * 店家聯絡資訊
 */
export interface StoreContact {
  phone: string;         // 電話
  email?: string;        // 電子郵件
  websiteUrl?: string;   // 網站URL
  lineId?: string;       // LINE ID
  facebookUrl?: string;  // Facebook專頁
  instagramUrl?: string; // Instagram帳號
}

/**
 * 店家營業狀態
 */
export type StoreStatus = 
  | 'active'             // 正常營業
  | 'temporarily_closed' // 暫時關閉
  | 'permanently_closed' // 永久關閉
  | 'coming_soon';       // 即將開業

/**
 * 店家公開資訊 (用於店家專頁)
 */
export interface PublicStoreProfile {
  id: string;                   // 店家ID (同storeId)
  tenantId: string;             // 租戶ID
  name: string;                 // 店家名稱
  slug?: string;                // URL友善名稱 (用於生成專頁URL)
  description?: string;         // 店家描述/簡介
  shortDescription?: string;    // 簡短描述 (用於列表頁)
  logoUrl?: string;             // 店家Logo URL
  coverImageUrl?: string;       // 店家封面圖片URL
  images?: string[];            // 店家圖片集 URLs
  location: StoreLocation;      // 地理位置
  contact: StoreContact;        // 聯絡資訊
  businessHours: BusinessHours[]; // 營業時間
  tags?: string[];              // 標籤 (例如: 咖啡廳, 寵物友善, 提供素食)
  categories?: string[];        // 分類 (例如: 餐廳, 飲料店, 服飾)
  status: StoreStatus;          // 營業狀態
  rating?: number;              // 平均評分 (1-5)
  ratingCount?: number;         // 評分數量
  hasOnlineOrdering: boolean;   // 是否提供線上點餐
  onlineOrderingUrl?: string;   // 線上點餐連結
  specialOffers?: {             // 特別優惠/活動
    title: string;              // 優惠標題
    description: string;        // 優惠描述
    startDate?: Date;           // 開始日期
    endDate?: Date;             // 結束日期
    imageUrl?: string;          // 優惠圖片
  }[];
  featuredMenuItems?: {         // 精選菜單項目
    name: string;               // 品項名稱
    description?: string;       // 品項描述
    price: number;              // 價格
    imageUrl?: string;          // 品項圖片URL
  }[];
  amenities?: string[];         // 設施/服務 (例如: 免費WiFi, 停車場, 無障礙設施)
  createdAt: Date;              // 創建時間
  updatedAt: Date;              // 更新時間
  lastSyncedAt: Date;           // 最後同步時間
}

/**
 * 用於搜尋/篩選店家的參數
 */
export interface StoreSearchParams {
  query?: string;               // 搜尋關鍵字
  location?: {                  // 地理位置
    lat: number;                // 緯度
    lng: number;                // 經度
    radius?: number;            // 半徑 (公尺)
  };
  categories?: string[];        // 分類篩選
  tags?: string[];              // 標籤篩選
  status?: StoreStatus[];       // 狀態篩選
  hasOnlineOrdering?: boolean;  // 是否提供線上點餐
  minRating?: number;           // 最低評分 (1-5)
  sort?: 'distance' | 'rating' | 'recommended'; // 排序方式
  limit?: number;               // 返回數量限制
  offset?: number;              // 分頁偏移
}

/**
 * 排行榜類型
 */
export type RankingType = 
  | 'top_rated'         // 評價最高的店家
  | 'most_popular'      // 最受歡迎的店家（訂單量）
  | 'trending'          // 近期熱門（成長最快）
  | 'new_stores'        // 新加入的店家
  | 'featured'          // 精選店家（由平台推薦，可付費置頂）
  | 'special_offers';   // 有特別優惠的店家

/**
 * 排行榜時間範圍
 */
export type RankingPeriod = 
  | 'all_time'          // 所有時間
  | 'this_week'         // 本週
  | 'this_month'        // 本月
  | 'last_30_days'      // 最近30天
  | 'last_90_days';     // 最近90天

/**
 * 排行榜項目
 */
export interface RankedStoreItem {
  storeId: string;           // 店家ID
  rank: number;              // 排名順序
  name: string;              // 店家名稱
  score: number;             // 排名分數（根據排行榜類型有不同含義）
  imageUrl?: string;         // 店家圖片URL
  location?: {               // 簡化的地理位置
    city: string;            // 城市
    district?: string;       // 區域
  };
  tags?: string[];           // 店家標籤（最多3個）
  category?: string;         // 主要分類
  isPaid?: boolean;          // 是否為付費置頂
}

/**
 * 排行榜結果
 */
export interface StoreRankingResult {
  id: string;                       // 排行榜ID (例如: top_rated_all_time)
  type: RankingType;                // 排行榜類型
  period: RankingPeriod;            // 時間範圍
  title: string;                    // 排行榜標題
  description?: string;             // 排行榜描述
  rankedStores: RankedStoreItem[];  // 排名店家列表
  calculatedAt: Date;               // 計算時間
  nextUpdateAt: Date | null;        // 下次更新時間
  metaData?: {                      // 額外資訊
    totalCount: number;             // 參與排名的店家總數
    minScore?: number;              // 最低分數
    maxScore?: number;              // 最高分數
    averageScore?: number;          // 平均分數
  };
} 