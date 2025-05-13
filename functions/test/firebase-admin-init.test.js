const sinon = require('sinon');
const chai = require('chai');
const { expect } = chai;

// 導入 mock 模組
const { admin } = require('./firebase-admin.mock');

describe('Firebase Admin 初始化測試', function() {
  it('應該成功初始化 Firebase Admin', function() {
    // 在測試中確認 admin.apps 不為空（表示已初始化）
    expect(admin.apps).to.not.be.empty;
    
    // 嘗試使用 firestore
    const db = admin.firestore();
    expect(db).to.exist;
    
    // 嘗試使用其他服務
    const auth = admin.auth();
    expect(auth).to.exist;
  });
}); 