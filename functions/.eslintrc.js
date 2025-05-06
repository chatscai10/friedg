module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google", // 或者選擇其他基礎風格指南，如 'airbnb-base'
  ],
  parserOptions: {
    ecmaVersion: 2020, // 或根據 Node.js 版本調整
  },
  rules: {
    "quotes": ["error", "double"],
    "indent": ["error", 2],
    "object-curly-spacing": ["error", "always"],
    "require-jsdoc": "off", // 暫時關閉 JSDoc 要求，可依需調整
    "valid-jsdoc": "warn", // 將 valid-jsdoc 降級為警告
    "max-len": ["warn", { "code": 120 }], // 放寬行長度限制
    // 可根據團隊偏好加入更多規則
  },
};
