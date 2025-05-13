const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const baseUrl = 'http://localhost:5001/chicken-pos/asia-east1';

chai.use(chaiHttp);

// 測試核心API端點
describe('核心API端點測試', () => {
  // 測試健康檢查端點
  describe('GET /health', () => {
    it('應返回正確的健康狀態', (done) => {
      chai.request(baseUrl)
        .get('/api/health')
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('status', 'ok');
          expect(res.body).to.have.property('timestamp');
          done();
        });
    });
  });

  // 測試根路徑
  describe('GET /', () => {
    it('應返回所有可用的端點信息', (done) => {
      chai.request(baseUrl)
        .get('/api/')
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('status', 'success');
          expect(res.body).to.have.property('endpoints');
          expect(res.body.endpoints).to.have.property('attendance');
          expect(res.body.endpoints).to.have.property('management');
          expect(res.body.endpoints).to.have.property('system');
          expect(res.body.endpoints).to.have.property('profile');
          done();
        });
    });
  });
  
  // 測試角色API
  describe('角色API路由測試', () => {
    it('應能獲取角色列表', (done) => {
      chai.request(baseUrl)
        .get('/api/v1/roles')
        .end((err, res) => {
          // 如果未登入，應拒絕而非發生錯誤
          expect(res.status).to.be.oneOf([200, 401, 403]);
          if (res.status === 200) {
            expect(res.body).to.have.property('data');
          }
          done();
        });
    });
  });
  
  // 測試店鋪API
  describe('店鋪API路由測試', () => {
    it('應能獲取店鋪列表', (done) => {
      chai.request(baseUrl)
        .get('/api/v1/stores')
        .end((err, res) => {
          // 如果未登入，應拒絕而非發生錯誤
          expect(res.status).to.be.oneOf([200, 401, 403]);
          if (res.status === 200) {
            expect(res.body).to.have.property('data');
          }
          done();
        });
    });
  });
  
  // 測試用戶API
  describe('用戶API路由測試', () => {
    it('應能訪問用戶Profile端點', (done) => {
      chai.request(baseUrl)
        .get('/api/v1/profile/me')
        .end((err, res) => {
          // 如果未登入，應拒絕而非發生錯誤
          expect(res.status).to.be.oneOf([200, 401, 403]);
          if (res.status === 200) {
            expect(res.body).to.have.property('data');
          }
          done();
        });
    });
  });
  
  // 測試考勤API
  describe('考勤API路由測試', () => {
    it('應能訪問考勤日誌', (done) => {
      chai.request(baseUrl)
        .get('/api/v1/attendance/logs')
        .end((err, res) => {
          // 如果未登入，應拒絕而非發生錯誤
          expect(res.status).to.be.oneOf([200, 401, 403]);
          if (res.status === 200) {
            expect(res.body).to.have.property('data');
          }
          done();
        });
    });
  });
  
  // 測試測試API
  describe('測試API', () => {
    it('應能訪問測試端點', (done) => {
      chai.request(baseUrl)
        .get('/test')
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('status', 'success');
          expect(res.body).to.have.property('message');
          expect(res.body).to.have.property('requestInfo');
          done();
        });
    });
  });
  
  // 測試不存在的路由
  describe('測試不存在的路由', () => {
    it('應返回404狀態碼', (done) => {
      chai.request(baseUrl)
        .get('/api/non-existent-path')
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body).to.have.property('status', 'error');
          expect(res.body).to.have.property('message');
          done();
        });
    });
  });
}); 