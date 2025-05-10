import React from 'react';
import { Box, Typography, Container, Paper } from '@mui/material';
import RankingList, { RankingItemProps } from '../common/RankingList';

// 排名示例數據
const rankingData: RankingItemProps[] = [
  { rank: 1, userName: 'Jessie Ben', score: 1105 },
  { rank: 2, userName: '王小明', score: 975 },
  { rank: 3, userName: 'Emma Thompson', score: 862 },
  { rank: 4, userName: '李大華', score: 750 },
  { rank: 5, userName: 'Mark Johnson', score: 689 },
];

const RankingExample: React.FC = () => {
  return (
    <Container maxWidth="md">
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          my: 4, 
          borderRadius: 3,
          background: 'linear-gradient(180deg, #2a2b38 0%, #1f2029 100%)'
        }}
      >
        <Typography 
          variant="h4" 
          component="h1" 
          sx={{ 
            mb: 4, 
            textAlign: 'center',
            color: '#ffeba7',
            fontWeight: 'bold'
          }}
        >
          排行榜示例
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <RankingList items={rankingData} />
        </Box>
      </Paper>
    </Container>
  );
};

export default RankingExample; 