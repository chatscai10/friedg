const express = require("express");
const { checkAuth } = require("../middleware/auth.middleware");
const {
  signIn,
  signUp,
  signOut,
  resetPassword,
  verifyEmail,
  refreshToken,
} = require("./auth.handlers");

// eslint-disable-next-line new-cap
const router = express.Router();

/**
 * @swagger
 * /auth/signin:
 *   post:
 *     summary: 用戶登入
 *     description: 使用電子郵件和密碼登入系統
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: 登入成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 認證失敗
 */
router.post("/signin", signIn);

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: 用戶註冊
 *     description: 註冊新用戶（僅限顧客角色）
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - displayName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               displayName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: 註冊成功
 *       400:
 *         description: 請求參數錯誤
 *       409:
 *         description: 用戶已存在
 */
router.post("/signup", signUp);

/**
 * @swagger
 * /auth/signout:
 *   post:
 *     summary: 用戶登出
 *     description: 登出當前用戶
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: 登出成功
 *       401:
 *         description: 未認證
 */
router.post("/signout", checkAuth, signOut);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: 重設密碼
 *     description: 發送重設密碼的郵件
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: 重設密碼郵件已發送
 *       400:
 *         description: 請求參數錯誤
 */
router.post("/reset-password", resetPassword);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: 發送驗證郵件
 *     description: 發送電子郵件驗證郵件
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               redirectUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: 驗證郵件已發送
 *       401:
 *         description: 未認證
 */
router.post("/verify-email", checkAuth, verifyEmail);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: 刷新令牌
 *     description: 使用刷新令牌獲取新的訪問令牌
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: 令牌刷新成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 無效的刷新令牌
 */
router.post("/refresh-token", refreshToken);

module.exports = router; 