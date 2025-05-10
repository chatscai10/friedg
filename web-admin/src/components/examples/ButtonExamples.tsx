import * as React from 'react';
import { Box, Typography, Container, Stack } from '@mui/material';
import PsychedelicButton from '../common/PsychedelicButton';

/**
 * 按鈕樣式範例頁面
 * 展示各種自定義按鈕樣式的使用
 */
const ButtonExamples: React.FC = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          按鈕樣式範例
        </Typography>
        
        <Typography variant="subtitle1" gutterBottom sx={{ mb: 3 }}>
          以下展示了各種自定義按鈕樣式的使用方法
        </Typography>
        
        <Stack spacing={4}>
          <Box>
            <Typography variant="h6" gutterBottom>
              迷幻風格按鈕
            </Typography>
            <Typography variant="body2" gutterBottom sx={{ mb: 2 }}>
              基於風格/按鈕-迷幻.txt實作的特效按鈕，懸停時會產生模糊光暈效果
            </Typography>
            <PsychedelicButton>
              查看更多
            </PsychedelicButton>
          </Box>
          
          <Box>
            <Typography variant="h6" gutterBottom>
              帶禁用狀態的迷幻按鈕
            </Typography>
            <PsychedelicButton disabled>
              已停用按鈕
            </PsychedelicButton>
          </Box>
        </Stack>
      </Box>
    </Container>
  );
};

export default ButtonExamples; 