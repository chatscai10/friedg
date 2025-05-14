/**
 * Firebase Cloud Functions 入口文件 - Gen 2 版本
 * 使用 Firebase Functions v2 API
 */

// 確保 Firebase Admin SDK 首先初始化
import * as admin from 'firebase-admin';
// 立即初始化 Admin SDK，確保其他模塊可以使用它
admin.initializeApp();
console.log('Firebase Admin SDK initialized with default settings.');

// 導入 orders 模塊的 Gen 2 函數
import {
  getOrders,
  getOrder,
  newOrder,
  updateStatus,
  recordPayment,
  getOrderStatistics,
  generateOrderReceipt,
  getOrderHistory
} from './orders/index.v2';

// 導入 notifications 模塊的 Gen 2 函數
import {
  orderStatusChangeHandler,
  sendOrderNotification,
  updateNotificationPreferences,
  sendSMSNotification,
  sendEmailNotification,
  sendPushNotification,
  getUserNotifications,
  markNotificationAsRead
} from './notifications/index.v2';

// 導入 equity 模塊的 Gen 2 函數
import {
  getHolders,
  calculateDistribution,
  updateEquity,
  getTransactions,
  validateTransfer
} from './equity/handlers.v2';

import {
  generateMonthlyEquityReports,
  weeklyEquityValuationUpdate,
  dailyVestingNotifications,
  quarterlyTransactionArchiving
} from './equity/schedule.handlers.v2';

// 導入 financial 模塊的 Gen 2 函數
import {
  generateMonthlyProfitReports
} from './financial/schedules.v2';

import {
  calculateProfitForPeriod,
  getProfitReports
} from './financial/services/profitCalculation.v2';

// 導出所有 Gen 2 函數

// Orders 模塊
export const ordersGetList = getOrders;
export const ordersGetDetail = getOrder;
export const ordersCreate = newOrder;
export const ordersUpdateStatus = updateStatus;
export const ordersRecordPayment = recordPayment;
export const ordersGetStatistics = getOrderStatistics;
export const ordersGenerateReceipt = generateOrderReceipt;
export const ordersGetHistory = getOrderHistory;

// Notifications 模塊
export const notificationsOrderStatusChange = orderStatusChangeHandler;
export const notificationsSendOrder = sendOrderNotification;
export const notificationsUpdatePreferences = updateNotificationPreferences;
export const notificationsSendSMS = sendSMSNotification;
export const notificationsSendEmail = sendEmailNotification;
export const notificationsSendPush = sendPushNotification;
export const notificationsGetUserList = getUserNotifications;
export const notificationsMarkAsRead = markNotificationAsRead;

// Equity 模塊
export const equityGetHolders = getHolders;
export const equityCalculateDistribution = calculateDistribution;
export const equityUpdate = updateEquity;
export const equityGetTransactions = getTransactions;
export const equityValidateTransfer = validateTransfer;
export const equityGenerateMonthlyReports = generateMonthlyEquityReports;
export const equityUpdateWeeklyValuations = weeklyEquityValuationUpdate;
export const equityNotifyDailyVesting = dailyVestingNotifications;
export const equityArchiveQuarterlyTransactions = quarterlyTransactionArchiving;

// Financial 模塊
export const financialGenerateMonthlyProfitReports = generateMonthlyProfitReports;
export const financialCalculateProfitForPeriod = calculateProfitForPeriod;
export const financialGetProfitReports = getProfitReports;
