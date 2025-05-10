import * as React from 'react';
import { Box, Typography, Container, Stack, Paper, Grid } from '@mui/material';
import ShiningText from '../common/ShiningText';

/**
 * 文字效果範例頁面
 * 展示各種自定義文字效果的使用
 */
const TextEffectsExamples: React.FC = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          文字效果範例
        </Typography>
        
        <Typography variant="subtitle1" gutterBottom sx={{ mb: 3 }}>
          以下展示了各種自定義文字效果的使用方法
        </Typography>
        
        <Stack spacing={4}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              質感白色燈光效果文字
            </Typography>
            
            <Typography variant="body2" gutterBottom sx={{ mb: 3 }}>
              基於風格/文字-質感白色燈.txt實作的發光文字效果，具有金屬質感和動態光澤掃描效果
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  基本用法（作為文字片段）:
                </Typography>
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  這是一個句子中的<ShiningText>發光文字效果</ShiningText>示例。
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  作為獨立標題:
                </Typography>
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <ShiningText variant="h4">白金質感標題</ShiningText>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  作為連結:
                </Typography>
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <ShiningText isLink href="#" onClick={(e) => { e.preventDefault(); alert('連結被點擊'); }}>
                    早期體驗新功能
                  </ShiningText>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  不同大小:
                </Typography>
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <ShiningText variant="h3">大標題效果</ShiningText>
                  <ShiningText variant="h6">中等標題效果</ShiningText>
                  <ShiningText>正常文字大小</ShiningText>
                  <ShiningText variant="caption">小型說明文字</ShiningText>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Stack>
      </Box>
    </Container>
  );
};

export default TextEffectsExamples; 