"use strict";
/**
 * 核心參數類型定義
 *
 * 此文件定義了整個應用程式中使用的核心參數標準介面
 * 所有使用這些參數的代碼都應該引用此文件中的定義
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POSITIONS = void 0;
exports.convertArrayToBusinessHours = convertArrayToBusinessHours;
exports.convertBusinessHoursToArray = convertBusinessHoursToArray;
exports.createScheduleMonth = createScheduleMonth;
/**
 * 標準職位列表
 */
exports.DEFAULT_POSITIONS = [
    { id: 'cashier', name: '收銀員' },
    { id: 'server', name: '服務員' },
    { id: 'chef', name: '廚師' },
    { id: 'manager', name: '經理' },
    { id: 'cleaner', name: '清潔員' }
];
/**
 * 工具函數：陣列格式營業時間轉換為物件格式
 * @param dailyHoursArray 陣列格式的營業時間
 * @returns 物件格式的營業時間
 */
function convertArrayToBusinessHours(dailyHoursArray) {
    const daysMap = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday'
    };
    const result = {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
    };
    dailyHoursArray.forEach(day => {
        var _a;
        const dayKey = daysMap[day.day];
        if (day.isOpen && day.openTime && day.closeTime) {
            (_a = result[dayKey]) === null || _a === void 0 ? void 0 : _a.push({
                start: day.openTime,
                end: day.closeTime
            });
        }
    });
    return result;
}
/**
 * 工具函數：物件格式營業時間轉換為陣列格式
 * @param businessHours 物件格式的營業時間
 * @returns 陣列格式的營業時間
 */
function convertBusinessHoursToArray(businessHours) {
    const daysMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
    };
    const result = [];
    Object.entries(businessHours).forEach(([day, timeRanges]) => {
        // 跳過 holidays
        if (day === 'holidays')
            return;
        const dayNumber = daysMap[day];
        if (dayNumber === undefined)
            return;
        if (timeRanges.length === 0) {
            // 沒有時間範圍，表示不營業
            result.push({
                day: dayNumber,
                isOpen: false
            });
        }
        else {
            // 使用第一個時間範圍
            const firstRange = timeRanges[0];
            result.push({
                day: dayNumber,
                isOpen: true,
                openTime: firstRange.start,
                closeTime: firstRange.end
            });
        }
    });
    return result;
}
/**
 * 工具函數：創建排班月份物件
 * @param year 年份
 * @param month 月份 (1-12)
 * @returns 排班月份物件
 */
function createScheduleMonth(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const formatDate = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };
    return {
        year,
        month,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}
//# sourceMappingURL=core-params.js.map