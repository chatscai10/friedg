import React, { useState } from 'react';
import { Box, Typography, Container, Paper } from '@mui/material';
import CommentBoard, { Comment } from '../common/CommentBoard';

// 示例數據
const initialComments: Comment[] = [
  {
    id: '1',
    userName: 'Yassine Zanina',
    timeStamp: 'Wednesday, March 13th at 2:45pm',
    content: "I've been using this product for a few days now and I'm really impressed! The interface is intuitive and easy to use, and the features are exactly what I need to streamline my workflow.",
    likes: 14,
    online: true,
  },
  {
    id: '2',
    userName: '王小明',
    timeStamp: 'Tuesday, March 12th at 10:30am',
    content: '這個系統真的很好用，我們團隊的工作效率提高了不少。特別是訂單管理部分，讓我們可以更準確地掌握銷售情況。',
    likes: 7,
    userAvatar: 'https://i.pravatar.cc/150?img=3',
    online: false,
  },
  {
    id: '3',
    userName: 'Lisa Johnson',
    timeStamp: 'Monday, March 11th at 4:15pm',
    content: 'The customer support team is amazing! I had a few questions about setting up my account and they responded quickly with clear instructions.',
    likes: 5,
    userAvatar: 'https://i.pravatar.cc/150?img=5',
    online: true,
  },
];

const CommentBoardExample: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>(initialComments);

  // 處理添加評論
  const handleAddComment = (content: string) => {
    const newComment: Comment = {
      id: `${comments.length + 1}`,
      userName: '目前用戶',
      timeStamp: new Date().toLocaleString(),
      content,
      likes: 0,
      userLiked: false,
      online: true,
    };
    setComments([newComment, ...comments]);
  };

  // 處理點贊評論
  const handleLikeComment = (id: string) => {
    setComments(
      comments.map((comment) => {
        if (comment.id === id) {
          return {
            ...comment,
            likes: comment.userLiked ? comment.likes - 1 : comment.likes + 1,
            userLiked: !comment.userLiked,
          };
        }
        return comment;
      })
    );
  };

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
          公佈欄示例
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <CommentBoard 
            title="系統公告與用戶評論" 
            comments={comments} 
            onAddComment={handleAddComment} 
            onLikeComment={handleLikeComment}
          />
        </Box>
      </Paper>
    </Container>
  );
};

export default CommentBoardExample; 