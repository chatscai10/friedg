import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Avatar, styled } from '@mui/material';
import { keyframes } from '@emotion/react';

// 定義動畫
const ripple = keyframes`
  0% {
    transform: scale(0);
    opacity: 0.6;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
`;

// 卡片容器
const Card = styled(Box)(({ theme }) => ({
  width: '450px',
  height: 'fit-content',
  backgroundColor: 'white',
  boxShadow: '0px 187px 75px rgba(0, 0, 0, 0.01), 0px 105px 63px rgba(0, 0, 0, 0.05), 0px 47px 47px rgba(0, 0, 0, 0.09), 0px 12px 26px rgba(0, 0, 0, 0.1), 0px 0px 0px rgba(0, 0, 0, 0.1)',
  borderRadius: '17px 17px 27px 27px',
}));

// 標題
const Title = styled(Typography)(({ theme }) => ({
  width: '100%',
  height: '50px',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  paddingLeft: '20px',
  borderBottom: '1px solid #f1f1f1',
  fontWeight: 700,
  fontSize: '13px',
  color: '#47484b',
  '&::after': {
    content: '""',
    width: '8ch',
    height: '1px',
    position: 'absolute',
    bottom: '-1px',
    backgroundColor: '#47484b',
  }
}));

// 評論容器
const Comments = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '35px 1fr',
  gap: '20px',
  padding: '20px',
}));

// 評論反應按鈕
const CommentReact = styled(Box)(({ theme }) => ({
  width: '35px',
  height: 'fit-content',
  display: 'grid',
  gridTemplateColumns: 'auto',
  margin: 0,
  backgroundColor: '#f1f1f1',
  borderRadius: '5px',
}));

// 評論反應按鈕
const ReactionButton = styled(Button)(({ theme }) => ({
  width: '35px',
  height: '35px',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
  border: 0,
  outline: 'none',
  minWidth: 'unset',
  padding: 0,
  '&::after': {
    content: '""',
    width: '40px',
    height: '40px',
    position: 'absolute',
    left: '-2.5px',
    top: '-2.5px',
    backgroundColor: '#f5356e',
    borderRadius: '50%',
    zIndex: 0,
    transform: 'scale(0)',
  },
  '&:hover::after': {
    animation: `${ripple} 0.6s ease-in-out forwards`,
  },
  '&:hover svg': {
    fill: '#f5356e',
  },
  '&:hover svg path': {
    stroke: '#f5356e',
    fill: '#f5356e',
  },
}));

// 分隔線
const Divider = styled('hr')(({ theme }) => ({
  width: '80%',
  height: '1px',
  backgroundColor: '#dfe1e6',
  margin: 'auto',
  border: 0,
}));

// 評論計數
const CommentCount = styled(Typography)(({ theme }) => ({
  height: '35px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 'auto',
  fontSize: '13px',
  fontWeight: 600,
  color: '#707277',
}));

// 評論內容容器
const CommentContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '15px',
  padding: 0,
  margin: 0,
}));

// 用戶信息
const User = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '40px 1fr',
  gap: '10px',
}));

// 用戶頭像容器
const UserPic = styled(Box)(({ theme }) => ({
  width: '40px',
  height: '40px',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f1f1f1',
  borderRadius: '50%',
  '&::after': {
    content: '""',
    width: '9px',
    height: '9px',
    position: 'absolute',
    right: '0px',
    bottom: '0px',
    borderRadius: '50%',
    backgroundColor: '#0fc45a',
    border: '2px solid #ffffff',
  }
}));

// 用戶信息
const UserInfo = styled(Box)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  gap: '3px',
}));

// 用戶名
const UserName = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '12px',
  color: '#47484b',
}));

// 時間戳
const TimeStamp = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '10px',
  color: '#acaeb4',
}));

// 評論內容
const CommentContent = styled(Typography)(({ theme }) => ({
  fontSize: '12px',
  color: '#47484b',
  lineHeight: 1.5,
}));

// 文本框容器
const TextBox = styled(Box)(({ theme }) => ({
  padding: '0 20px 20px 20px',
}));

// 文本框內部容器
const BoxContainer = styled(Box)(({ theme }) => ({
  border: '1px solid #f1f1f1',
  borderRadius: '8px',
  overflow: 'hidden',
}));

// 格式化工具欄
const Formatting = styled(Box)(({ theme }) => ({
  display: 'flex',
  padding: '8px',
  backgroundColor: '#f9f9f9',
  borderTop: '1px solid #f1f1f1',
}));

// 格式按鈕
const FormatButton = styled(Button)(({ theme }) => ({
  width: '35px',
  height: '35px',
  minWidth: 'unset',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  backgroundColor: 'transparent',
  border: 0,
  '&:hover svg path': {
    stroke: theme.palette.primary.main,
  },
}));

// 發送按鈕
const SendButton = styled(Button)(({ theme }) => ({
  width: '35px',
  height: '35px',
  minWidth: 'unset',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  marginLeft: 'auto',
  backgroundColor: theme.palette.primary.main,
  borderRadius: '5px',
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

// 自定義文本域
const CustomTextField = styled(TextField)(({ theme }) => ({
  width: '100%',
  '& .MuiInputBase-root': {
    padding: '10px 15px',
    fontSize: '13px',
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      border: 'none',
    },
    '&:hover fieldset': {
      border: 'none',
    },
    '&.Mui-focused fieldset': {
      border: 'none',
    },
  },
}));

// 心形圖標
const HeartIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#707277"
      strokeLinecap="round"
      strokeWidth="2"
      stroke="#707277"
      d="M19.4626 3.99415C16.7809 2.34923 14.4404 3.01211 13.0344 4.06801C12.4578 4.50096 12.1696 4.71743 12 4.71743C11.8304 4.71743 11.5422 4.50096 10.9656 4.06801C9.55962 3.01211 7.21909 2.34923 4.53744 3.99415C1.01807 6.15294 0.221721 13.2749 8.33953 19.2834C9.88572 20.4278 10.6588 21 12 21C13.3412 21 14.1143 20.4278 15.6605 19.2834C23.7783 13.2749 22.9819 6.15294 19.4626 3.99415Z"
    />
  </svg>
);

// 用戶圖標
const UserIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
    <path
      strokeLinejoin="round"
      fill="#707277"
      strokeLinecap="round"
      strokeWidth="2"
      stroke="#707277"
      d="M6.57757 15.4816C5.1628 16.324 1.45336 18.0441 3.71266 20.1966C4.81631 21.248 6.04549 22 7.59087 22H16.4091C17.9545 22 19.1837 21.248 20.2873 20.1966C22.5466 18.0441 18.8372 16.324 17.4224 15.4816C14.1048 13.5061 9.89519 13.5061 6.57757 15.4816Z"
    />
    <path
      strokeWidth="2"
      fill="#707277"
      stroke="#707277"
      d="M16.5 6.5C16.5 8.98528 14.4853 11 12 11C9.51472 11 7.5 8.98528 7.5 6.5C7.5 4.01472 9.51472 2 12 2C14.4853 2 16.5 4.01472 16.5 6.5Z"
    />
  </svg>
);

// 粗體圖標
const BoldIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
    <path
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeWidth="2.5"
      stroke="#707277"
      d="M5 6C5 4.58579 5 3.87868 5.43934 3.43934C5.87868 3 6.58579 3 8 3H12.5789C15.0206 3 17 5.01472 17 7.5C17 9.98528 15.0206 12 12.5789 12H5V6Z"
      clipRule="evenodd"
      fillRule="evenodd"
    />
    <path
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeWidth="2.5"
      stroke="#707277"
      d="M12.4286 12H13.6667C16.0599 12 18 14.0147 18 16.5C18 18.9853 16.0599 21 13.6667 21H8C6.58579 21 5.87868 21 5.43934 20.5607C5 20.1213 5 19.4142 5 18V12"
    />
  </svg>
);

// 斜體圖標
const ItalicIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M12 4H19" />
    <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M8 20L16 4" />
    <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M5 20H12" />
  </svg>
);

// 下劃線圖標
const UnderlineIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
    <path
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeWidth="2.5"
      stroke="#707277"
      d="M5.5 3V11.5C5.5 15.0899 8.41015 18 12 18C15.5899 18 18.5 15.0899 18.5 11.5V3"
    />
    <path strokeLinecap="round" strokeWidth="2.5" stroke="#707277" d="M3 21H21" />
  </svg>
);

// 表情圖標
const EmojiIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
    <circle strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#707277" r="10" cy="12" cx="12" />
    <path
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeWidth="2.5"
      stroke="#707277"
      d="M8 15C8.91212 16.2144 10.3643 17 12 17C13.6357 17 15.0879 16.2144 16 15"
    />
    <path
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeWidth="3"
      stroke="#707277"
      d="M8.00897 9L8 9M16 9L15.991 9"
    />
  </svg>
);

// 發送圖標
const SendIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#ffffff" d="M12 5L12 20" />
    <path
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeWidth="2.5"
      stroke="#ffffff"
      d="M7 9L11.2929 4.70711C11.6262 4.37377 11.7929 4.20711 12 4.20711C12.2071 4.20711 12.3738 4.37377 12.7071 4.70711L17 9"
    />
  </svg>
);

export interface Comment {
  id: string;
  userName: string;
  timeStamp: string;
  content: string;
  likes: number;
  userLiked?: boolean;
  userAvatar?: string;
  online?: boolean;
}

export interface CommentBoardProps {
  title?: string;
  comments: Comment[];
  onAddComment?: (comment: string) => void;
  onLikeComment?: (id: string) => void;
}

const CommentBoard: React.FC<CommentBoardProps> = ({
  title = 'Comments',
  comments = [],
  onAddComment,
  onLikeComment,
}) => {
  const [newComment, setNewComment] = useState('');

  const handleSubmit = () => {
    if (newComment.trim() && onAddComment) {
      onAddComment(newComment);
      setNewComment('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card>
      <Title>{title}</Title>
      {comments.map((comment) => (
        <Comments key={comment.id}>
          <CommentReact>
            <ReactionButton onClick={() => onLikeComment && onLikeComment(comment.id)}>
              <HeartIcon />
            </ReactionButton>
            <Divider />
            <CommentCount>{comment.likes}</CommentCount>
          </CommentReact>
          <CommentContainer>
            <User>
              <UserPic>
                {comment.userAvatar ? (
                  <Avatar src={comment.userAvatar} alt={comment.userName} sx={{ width: 40, height: 40 }} />
                ) : (
                  <UserIcon />
                )}
              </UserPic>
              <UserInfo>
                <UserName>{comment.userName}</UserName>
                <TimeStamp>{comment.timeStamp}</TimeStamp>
              </UserInfo>
            </User>
            <CommentContent>{comment.content}</CommentContent>
          </CommentContainer>
        </Comments>
      ))}

      <TextBox>
        <BoxContainer>
          <CustomTextField
            placeholder="Reply"
            multiline
            minRows={2}
            maxRows={4}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Formatting>
            <FormatButton>
              <BoldIcon />
            </FormatButton>
            <FormatButton>
              <ItalicIcon />
            </FormatButton>
            <FormatButton>
              <UnderlineIcon />
            </FormatButton>
            <FormatButton>
              <EmojiIcon />
            </FormatButton>
            <SendButton onClick={handleSubmit}>
              <SendIcon />
            </SendButton>
          </Formatting>
        </BoxContainer>
      </TextBox>
    </Card>
  );
};

export default CommentBoard; 