import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FloatingLabelInput from './FloatingLabelInput';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../styles/theme';

// 創建一個包裝組件，提供必要的 MUI 主題
const renderWithTheme = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

describe('FloatingLabelInput', () => {
  // 每個測試後清理
  afterEach(() => {
    cleanup();
  });

  // 測試元件能否正確渲染
  it('渲染時不會崩潰', () => {
    renderWithTheme(<FloatingLabelInput label="測試標籤" />);
    const labelElement = screen.getByText('測試標籤');
    expect(labelElement).toBeInTheDocument();
  });

  // 測試用戶輸入時值能正確更新
  it('用戶輸入時更新值', async () => {
    const handleChange = vi.fn();
    renderWithTheme(
      <FloatingLabelInput
        label="使用者名稱"
        onChange={handleChange}
      />
    );

    // 使用 userEvent 更接近實際用戶交互
    const user = userEvent.setup();
    const inputElement = screen.getByLabelText('使用者名稱');
    
    await user.type(inputElement, 'test@example.com');
    
    expect(handleChange).toHaveBeenCalled();
    expect(inputElement).toHaveValue('test@example.com');
  });

  // 測試初始值是否正確設置
  it('初始值正確設置', () => {
    renderWithTheme(
      <FloatingLabelInput
        label="電子郵件"
        value="initial@example.com"
      />
    );
    
    const inputElement = screen.getByLabelText('電子郵件');
    expect(inputElement).toHaveValue('initial@example.com');
    
    // 檢查是否有 filled 狀態的 class
    const inputRoot = inputElement.closest('.MuiInput-root');
    expect(inputRoot).toHaveClass('Mui-filled');
  });

  // 測試錯誤狀態
  it('顯示錯誤狀態和輔助文字', () => {
    renderWithTheme(
      <FloatingLabelInput
        label="用戶名"
        error={true}
        helperText="用戶名已被使用"
      />
    );
    
    // 檢查輔助文字是否顯示
    const helperText = screen.getByText('用戶名已被使用');
    expect(helperText).toBeInTheDocument();
    
    // 檢查錯誤狀態
    const formControl = helperText.closest('.MuiFormControl-root');
    expect(formControl).toHaveClass('Mui-error');
  });

  // 測試必填屬性
  it('顯示必填標記', () => {
    renderWithTheme(
      <FloatingLabelInput
        label="必填欄位"
        required={true}
      />
    );
    
    // 檢查標籤是否包含必填標記
    const labelElement = screen.getByText('必填欄位', { exact: false });
    expect(labelElement).toHaveClass('Mui-required');
  });
}); 