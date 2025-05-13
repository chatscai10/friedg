import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { Provider } from 'react-redux';
import { store } from './store';
import { auth } from './firebaseConfig';
import { fetchCurrentUser } from './store/authSlice';

// 添加基本錯誤處理
console.log('main.tsx執行中...');
console.log('當前URL:', window.location.href);

// 確保root元素存在
let rootElement = document.getElementById('root');
if (!rootElement) {
  console.warn('找不到root元素，動態創建一個');
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

// 設置 Firebase Auth 狀態監聽
const setupAuthStateListener = () => {
  auth.onAuthStateChanged((user) => {
    // 當用戶狀態變化時，dispatch action 來更新 Redux store
    console.log('Firebase Auth 狀態變化:', user ? '用戶已登入' : '用戶未登入');
    store.dispatch(fetchCurrentUser());
  });
};

// 初始化 Auth 監聽
setupAuthStateListener();

// 確保DOM已加載
const renderApp = () => {
  try {
    console.log('嘗試渲染React應用...');
    const root = ReactDOM.createRoot(rootElement!);
    root.render(
      <React.StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </React.StrictMode>
    );
    console.log('React應用渲染完成');
  } catch (error) {
    console.error('React渲染失敗:', error);
    // 顯示錯誤信息在頁面上
    rootElement!.innerHTML = `
      <div style="padding: 20px; color: red; text-align: center;">
        <h1>應用加載失敗</h1>
        <p>請檢查控制台錯誤或刷新頁面</p>
        <pre>${error instanceof Error ? error.message : String(error)}</pre>
      </div>
    `;
  }
};

// 確保在DOM完全加載後渲染
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
