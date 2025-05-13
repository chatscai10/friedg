import { firestore } from '../firebase';
import { 
  AttendanceLog, 
  ClockInRequest, 
  ClockOutRequest, 
  AttendanceStatus,
  calculateDistance,
  ClockSource
} from './attendance.types';
import { BusinessHours, DailyOperatingHours, Coordinates } from '../../src/types/core-params';

/**
 * 考勤服務類 - 處理打卡相關業務邏輯
 */
export class AttendanceService {
  /**
   * 處理上班打卡
   * @param employeeId 員工ID
   * @param tenantId 租戶ID
   * @param storeId 店鋪ID
   * @param request 打卡請求資料
   * @returns 打卡記錄或錯誤
   */
  public static async clockIn(
    employeeId: string, 
    tenantId: string, 
    storeId: string, 
    request: ClockInRequest
  ): Promise<AttendanceLog | null | { error: string, code?: string, details?: any }> {
    try {
      // 1. 獲取店鋪資訊
      const storeInfo = await this.getStoreInfo(tenantId, storeId);
      if (!storeInfo) {
        return {
          error: '找不到店鋪資訊',
          code: 'STORE_NOT_FOUND'
        };
      }

      if (!storeInfo.coords || !storeInfo.geofenceRadius) {
        return {
          error: '店鋪地理位置資訊不完整',
          code: 'INCOMPLETE_STORE_INFO'
        };
      }

      // 2. GPS位置驗證
      const distance = calculateDistance(
        request.latitude,
        request.longitude,
        storeInfo.coords.latitude,
        storeInfo.coords.longitude
      );
      
      const isWithinFence = distance <= storeInfo.geofenceRadius;

      // 3. 獲取當前時間和日期（使用伺服器時間）
      const now = new Date();
      const timestamp = now.toISOString();
      const date = now.toISOString().split('T')[0]; // YYYY-MM-DD格式
      
      // 4. 檢查營業時間
      const isWithinBusinessHours = this.checkBusinessHours(now, storeInfo.businessHours);
      
      // 5. 檢查重複打卡
      const existingClockIn = await this.findTodayClockInRecord(tenantId, employeeId, date);
      if (existingClockIn) {
        return {
          error: '今天已經打過上班卡',
          code: 'DUPLICATE_CLOCK_IN',
          details: { existingRecord: existingClockIn }
        };
      }

      // 6. 關聯排班資訊（選填）
      const scheduleInfo = await this.getEmployeeSchedule(tenantId, employeeId, date);
      
      // 7. 判定出勤狀態
      let status = AttendanceStatus.CLOCKED_IN;
      
      // 不在電子圍欄內
      if (!isWithinFence) {
        status = AttendanceStatus.INVALID_LOCATION;
      }
      // 不在營業時間內
      else if (!isWithinBusinessHours) {
        status = AttendanceStatus.OUTSIDE_BUSINESS_HOURS;
      }
      // 有排班資訊，判斷是否遲到
      else if (scheduleInfo && scheduleInfo.scheduledStartTime) {
        const scheduledStartTime = new Date(scheduleInfo.scheduledStartTime);
        // 遲到判定邏輯（根據專案報告定義的遲到規則）
        const lateThresholdMinutes = 15; // 假設遲到閾值為15分鐘，實際應從設定獲取
        const minutesLate = (now.getTime() - scheduledStartTime.getTime()) / (1000 * 60);
        
        if (minutesLate > lateThresholdMinutes) {
          status = AttendanceStatus.LATE_CLOCK_IN;
        }
      }

      // 8. 資料庫操作
      const attendanceId = this.generateAttendanceId();
      
      const attendanceLog: AttendanceLog = {
        attendanceId,
        employeeId,
        tenantId,
        storeId,
        date,
        clockInTime: timestamp,
        clockInCoords: {
          latitude: request.latitude,
          longitude: request.longitude
        },
        isWithinFence,
        status,
        source: ClockSource.MOBILE_APP,
        deviceInfo: request.deviceInfo || null,
        notes: request.notes || null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      // 寫入資料庫
      await firestore
        .collection('attendances')
        .doc(attendanceId)
        .set(attendanceLog);

      return attendanceLog;
      
    } catch (error) {
      console.error('上班打卡失敗:', error);
      return {
        error: '處理打卡請求時發生錯誤',
        code: 'INTERNAL_SERVER_ERROR',
        details: error
      };
    }
  }

  /**
   * 處理下班打卡
   * @param employeeId 員工ID
   * @param tenantId 租戶ID
   * @param storeId 店鋪ID
   * @param request 打卡請求資料
   * @returns 打卡記錄或錯誤
   */
  public static async clockOut(
    employeeId: string, 
    tenantId: string, 
    storeId: string, 
    request: ClockOutRequest
  ): Promise<AttendanceLog | null | { error: string, code?: string, details?: any }> {
    try {
      // 1. 獲取店鋪資訊
      const storeInfo = await this.getStoreInfo(tenantId, storeId);
      if (!storeInfo) {
        return {
          error: '找不到店鋪資訊',
          code: 'STORE_NOT_FOUND'
        };
      }

      if (!storeInfo.coords || !storeInfo.geofenceRadius) {
        return {
          error: '店鋪地理位置資訊不完整',
          code: 'INCOMPLETE_STORE_INFO'
        };
      }

      // 2. GPS位置驗證
      const distance = calculateDistance(
        request.latitude,
        request.longitude,
        storeInfo.coords.latitude,
        storeInfo.coords.longitude
      );
      
      const isWithinFence = distance <= storeInfo.geofenceRadius;

      // 3. 獲取當前時間和日期（使用伺服器時間）
      const now = new Date();
      const timestamp = now.toISOString();
      const date = now.toISOString().split('T')[0]; // YYYY-MM-DD格式
      
      // 4. 檢查營業時間
      const isWithinBusinessHours = this.checkBusinessHours(now, storeInfo.businessHours);
      
      // 5. 獲取對應的上班打卡記錄
      const clockInRecord = await this.findTodayClockInRecord(tenantId, employeeId, date);
      if (!clockInRecord) {
        return {
          error: '找不到今天的上班打卡記錄',
          code: 'MISSING_CLOCK_IN'
        };
      }

      // 6. 檢查是否已打過下班卡
      if (clockInRecord.clockOutTime) {
        return {
          error: '今天已經打過下班卡',
          code: 'DUPLICATE_CLOCK_OUT',
          details: { existingRecord: clockInRecord }
        };
      }

      // 7. 關聯排班資訊（選填）
      const scheduleInfo = await this.getEmployeeSchedule(tenantId, employeeId, date);
      
      // 8. 判定出勤狀態
      let status = AttendanceStatus.CLOCKED_OUT;
      
      // 不在電子圍欄內
      if (!isWithinFence) {
        status = AttendanceStatus.INVALID_LOCATION_CLOCK_OUT;
      }
      // 不在營業時間內
      else if (!isWithinBusinessHours) {
        status = AttendanceStatus.OUTSIDE_BUSINESS_HOURS_CLOCK_OUT;
      }
      // 有排班資訊，判斷是否早退
      else if (scheduleInfo && scheduleInfo.scheduledEndTime) {
        const scheduledEndTime = new Date(scheduleInfo.scheduledEndTime);
        // 早退判定邏輯（根據專案報告定義的早退規則）
        const earlyThresholdMinutes = 15; // 假設早退閾值為15分鐘，實際應從設定獲取
        const minutesEarly = (scheduledEndTime.getTime() - now.getTime()) / (1000 * 60);
        
        if (minutesEarly > earlyThresholdMinutes) {
          status = AttendanceStatus.EARLY_CLOCK_OUT;
        }
      }

      // 9. 計算工作時間（分鐘）
      const clockInTime = new Date(clockInRecord.clockInTime);
      const workDurationMinutes = Math.round((now.getTime() - clockInTime.getTime()) / (1000 * 60));

      // 10. 更新出勤記錄
      const updatedAttendanceLog: Partial<AttendanceLog> = {
        clockOutTime: timestamp,
        clockOutCoords: {
          latitude: request.latitude,
          longitude: request.longitude
        },
        isWithinFenceClockOut: isWithinFence,
        status,
        workDurationMinutes,
        notes: clockInRecord.notes 
          ? `${clockInRecord.notes}; ${request.notes || ''}`
          : request.notes || null,
        updatedAt: timestamp
      };

      // 更新資料庫
      await firestore
        .collection('attendances')
        .doc(clockInRecord.attendanceId)
        .update(updatedAttendanceLog);

      // 返回完整的更新後記錄
      return {
        ...clockInRecord,
        ...updatedAttendanceLog
      } as AttendanceLog;
      
    } catch (error) {
      console.error('下班打卡失敗:', error);
      return {
        error: '處理打卡請求時發生錯誤',
        code: 'INTERNAL_SERVER_ERROR',
        details: error
      };
    }
  }

  /**
   * 獲取店鋪資訊
   */
  private static async getStoreInfo(tenantId: string, storeId: string): Promise<any | null> {
    try {
      const storeDoc = await firestore
        .collection('tenants')
        .doc(tenantId)
        .collection('stores')
        .doc(storeId)
        .get();
      
      if (!storeDoc.exists) return null;
      
      const storeData = storeDoc.data();
      
      // 處理座標格式轉換
      let coords = null;
      
      if (storeData) {
        if (storeData.coords) {
          // 已經是標準格式，直接使用
          coords = storeData.coords;
        } else if (storeData.geolocation) {
          // 舊格式：geolocation
          coords = {
            latitude: storeData.geolocation.latitude || storeData.geolocation.lat,
            longitude: storeData.geolocation.longitude || storeData.geolocation.lng,
            radius: storeData.geolocation.radius
          };
        } else if (storeData.latitude !== undefined && storeData.longitude !== undefined) {
          // 直接使用頂層經緯度屬性
          coords = {
            latitude: storeData.latitude,
            longitude: storeData.longitude,
            radius: storeData.radius || 100
          };
        }
      }
      
      return {
        id: storeDoc.id,
        ...storeData,
        coords // 覆蓋或添加標準座標格式
      };
    } catch (error) {
      console.error('獲取店鋪資訊失敗:', error);
      return null;
    }
  }

  /**
   * 檢查是否在營業時間內
   */
  private static checkBusinessHours(currentTime: Date, businessHours: any): boolean {
    if (!businessHours) return true; // 如果沒有設定營業時間，預設允許打卡
    
    // 獲取今天是星期幾 (0-6, 0代表星期日)
    const dayOfWeek = currentTime.getDay();
    
    // 轉換索引為星期名稱
    const dayMap: { [key: number]: keyof BusinessHours } = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };
    
    const dayName = dayMap[dayOfWeek];
    
    // 檢查 businessHours 是否為舊格式（陣列格式）
    if (Array.isArray(businessHours)) {
      // 舊格式：陣列形式，查找對應星期的項目
      const dayEntry = businessHours.find(day => day.day === dayOfWeek);
      if (!dayEntry || !dayEntry.isOpen) return false;
      
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      
      // 解析營業開始時間
      const [openHour, openMinute] = dayEntry.openTime.split(':').map(Number);
      const openTotalMinutes = openHour * 60 + openMinute;
      
      // 解析營業結束時間
      const [closeHour, closeMinute] = dayEntry.closeTime.split(':').map(Number);
      const closeTotalMinutes = closeHour * 60 + closeMinute;
      
      // 彈性時間（早到和晚走的允許時間，單位：分鐘）
      const flexTimeMinutes = 30; // 假設允許提前30分鐘上班，延後30分鐘下班，實際應從設定獲取
      
      // 檢查當前時間是否在允許的時間範圍內
      return (currentTotalMinutes >= (openTotalMinutes - flexTimeMinutes) && 
              currentTotalMinutes <= (closeTotalMinutes + flexTimeMinutes));
    } else {
      // 新格式：物件形式，以星期為鍵名
      const timeRanges = businessHours[dayName] as Array<{ start: string; end: string }> | undefined;
      
      // 如果今天沒有營業時間設定或沒有時間範圍，返回false
      if (!timeRanges || timeRanges.length === 0) return false;
      
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      
      // 彈性時間（早到和晚走的允許時間，單位：分鐘）
      const flexTimeMinutes = 30; // 假設允許提前30分鐘上班，延後30分鐘下班，實際應從設定獲取
      
      // 檢查是否在任何一個時間範圍內
      for (const timeRange of timeRanges) {
        // 解析營業開始時間
        const [startHour, startMinute] = timeRange.start.split(':').map(Number);
        const startTotalMinutes = startHour * 60 + startMinute;
        
        // 解析營業結束時間
        const [endHour, endMinute] = timeRange.end.split(':').map(Number);
        const endTotalMinutes = endHour * 60 + endMinute;
        
        // 檢查當前時間是否在允許的時間範圍內
        if (currentTotalMinutes >= (startTotalMinutes - flexTimeMinutes) && 
            currentTotalMinutes <= (endTotalMinutes + flexTimeMinutes)) {
          return true;
        }
      }
      
      return false;
    }
  }

  /**
   * 查找當日的上班打卡記錄
   */
  private static async findTodayClockInRecord(
    tenantId: string, 
    employeeId: string, 
    date: string
  ): Promise<AttendanceLog | null> {
    try {
      const querySnapshot = await firestore
        .collection('attendances')
        .where('tenantId', '==', tenantId)
        .where('employeeId', '==', employeeId)
        .where('date', '==', date)
        .orderBy('clockInTime', 'desc')
        .limit(1)
        .get();
      
      if (querySnapshot.empty) return null;
      
      const doc = querySnapshot.docs[0];
      return {
        attendanceId: doc.id,
        ...doc.data()
      } as AttendanceLog;
    } catch (error) {
      console.error('查找上班打卡記錄失敗:', error);
      return null;
    }
  }

  /**
   * 獲取員工排班資訊
   */
  private static async getEmployeeSchedule(
    tenantId: string, 
    employeeId: string, 
    date: string
  ): Promise<any | null> {
    try {
      const querySnapshot = await firestore
        .collection('tenants')
        .doc(tenantId)
        .collection('schedules')
        .where('employeeId', '==', employeeId)
        .where('date', '==', date)
        .limit(1)
        .get();
      
      if (querySnapshot.empty) return null;
      
      const doc = querySnapshot.docs[0];
      return {
        scheduleId: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('獲取排班資訊失敗:', error);
      return null;
    }
  }

  /**
   * 生成唯一的考勤記錄ID
   */
  private static generateAttendanceId(): string {
    return `attendance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 