import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Button, 
  TextField, 
  Chip,
  Avatar,
  List,
  IconButton,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  InputAdornment,
  Card,
  CardContent,
  CardHeader,
  Snackbar,
  Alert,
} from '@mui/material';
import { 
  Phone as PhoneIcon, 
  Email as EmailIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  AddCircle as AddCircleIcon,
  LocalOffer as TagIcon,
  NoteAdd as NoteAddIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { Formik, Form, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { getCustomerById, updateCustomer, addTag, removeTag, addNote, getNotes } from '../../services/crmService';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { UserProfile, CustomerNote } from '../../types/user.types';
import { usePermission } from '../../hooks/usePermission';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

// 表單驗證Schema
const customerProfileSchema = Yup.object().shape({
  firstName: Yup.string().max(50, '名稱太長'),
  lastName: Yup.string().max(50, '姓氏太長'),
  displayName: Yup.string().max(100, '顯示名稱太長'),
  email: Yup.string().email('請輸入有效的電子郵件地址'),
  phoneNumber: Yup.string().max(20, '電話號碼太長'),
  alternatePhoneNumber: Yup.string().max(20, '電話號碼太長'),
  gender: Yup.string().oneOf(['male', 'female', 'other'], '無效的性別選項'),
  membershipTier: Yup.string().max(20, '會員等級太長'),
  source: Yup.string().max(100, '來源名稱太長'),
  status: Yup.string().oneOf(['active', 'inactive', 'blocked'], '無效的狀態選項'),
  preferredContactMethod: Yup.string().oneOf(['email', 'phone', 'sms', 'line'], '無效的聯繫方式選項'),
});

// 備註表單驗證Schema
const noteSchema = Yup.object().shape({
  text: Yup.string().required('備註不能為空').max(1000, '備註內容太長'),
  isImportant: Yup.boolean(),
});

// 標籤表單驗證Schema
const tagSchema = Yup.object().shape({
  tag: Yup.string().required('標籤不能為空').max(30, '標籤太長'),
});

const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isNewCustomer = location.pathname.includes('/new');
  const isEditMode = location.pathname.includes('/edit') || isNewCustomer;
  const customerId = id || '';

  // 狀態管理
  const [tabValue, setTabValue] = useState(0);
  const [isEditing, setIsEditing] = useState(isEditMode);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [addNoteDialogOpen, setAddNoteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // 權限檢查
  const canReadCRM = usePermission('crm:read');
  const canManageCRM = usePermission('crm:manage');

  // 獲取客戶詳情
  const { 
    data: customer, 
    isLoading: isLoadingCustomer, 
    isError: isCustomerError 
  } = useQuery(
    ['customer', customerId],
    () => getCustomerById(customerId),
    {
      enabled: canReadCRM && !!customerId && !isNewCustomer,
      refetchOnWindowFocus: false,
    }
  );

  // 獲取客戶備註
  const { 
    data: notes, 
    isLoading: isLoadingNotes,
    refetch: refetchNotes
  } = useQuery(
    ['customerNotes', customerId],
    () => getNotes(customerId),
    {
      enabled: canReadCRM && !!customerId && !isNewCustomer,
      refetchOnWindowFocus: false,
    }
  );

  // 更新客戶資料的Mutation
  const updateCustomerMutation = useMutation(
    (data: Partial<UserProfile>) => updateCustomer(customerId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['customer', customerId]);
        setIsEditing(false);
        setSnackbar({
          open: true,
          message: '客戶資料更新成功',
          severity: 'success',
        });
      },
      onError: (error) => {
        console.error('更新客戶資料失敗:', error);
        setSnackbar({
          open: true,
          message: '更新客戶資料失敗',
          severity: 'error',
        });
      },
    }
  );

  // 添加標籤的Mutation
  const addTagMutation = useMutation(
    (tag: string) => addTag(customerId, tag),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['customer', customerId]);
        setAddTagDialogOpen(false);
        setSnackbar({
          open: true,
          message: '標籤添加成功',
          severity: 'success',
        });
      },
      onError: (error) => {
        console.error('添加標籤失敗:', error);
        setSnackbar({
          open: true,
          message: '添加標籤失敗',
          severity: 'error',
        });
      },
    }
  );

  // 移除標籤的Mutation
  const removeTagMutation = useMutation(
    (tag: string) => removeTag(customerId, tag),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['customer', customerId]);
        setSnackbar({
          open: true,
          message: '標籤移除成功',
          severity: 'success',
        });
      },
      onError: (error) => {
        console.error('移除標籤失敗:', error);
        setSnackbar({
          open: true,
          message: '移除標籤失敗',
          severity: 'error',
        });
      },
    }
  );

  // 添加備註的Mutation
  const addNoteMutation = useMutation(
    (noteData: { text: string; isImportant?: boolean }) => addNote(customerId, noteData),
    {
      onSuccess: () => {
        refetchNotes();
        setAddNoteDialogOpen(false);
        setSnackbar({
          open: true,
          message: '備註添加成功',
          severity: 'success',
        });
      },
      onError: (error) => {
        console.error('添加備註失敗:', error);
        setSnackbar({
          open: true,
          message: '添加備註失敗',
          severity: 'error',
        });
      },
    }
  );

  // 處理標籤頁切換
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // 處理客戶資料更新
  const handleUpdateCustomer = (values: Partial<UserProfile>, { setSubmitting }: FormikHelpers<Partial<UserProfile>>) => {
    updateCustomerMutation.mutate(values);
    setSubmitting(false);
  };

  // 處理添加標籤
  const handleAddTag = (values: { tag: string }, { resetForm }: FormikHelpers<{ tag: string }>) => {
    addTagMutation.mutate(values.tag);
    resetForm();
  };

  // 處理移除標籤
  const handleRemoveTag = (tag: string) => {
    if (window.confirm(`確定要移除標籤 "${tag}" 嗎？`)) {
      removeTagMutation.mutate(tag);
    }
  };

  // 處理添加備註
  const handleAddNote = (values: { text: string; isImportant: boolean }, { resetForm }: FormikHelpers<{ text: string; isImportant: boolean }>) => {
    addNoteMutation.mutate(values);
    resetForm();
  };

  // 處理關閉Snackbar
  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // 返回客戶列表
  const goBack = () => {
    navigate('/crm/customers');
  };

  // 取消編輯
  const cancelEdit = () => {
    if (isNewCustomer) {
      navigate('/crm/customers');
    } else {
      setIsEditing(false);
    }
  };

  // 如果沒有權限，顯示錯誤信息
  if (!canReadCRM) {
    return (
      <Box p={3}>
        <Typography variant="h5" color="error">
          您沒有訪問客戶管理的權限
        </Typography>
      </Box>
    );
  }

  // 如果正在加載客戶資料，顯示加載中
  if (isLoadingCustomer && !isNewCustomer) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  // 如果獲取客戶資料出錯，顯示錯誤信息
  if (isCustomerError && !isNewCustomer) {
    return (
      <Box p={3}>
        <Typography variant="h5" color="error">
          獲取客戶資料時發生錯誤
        </Typography>
        <Button variant="outlined" onClick={goBack} sx={{ mt: 2 }}>
          返回客戶列表
        </Button>
      </Box>
    );
  }

  // 初始表單值
  const initialValues: Partial<UserProfile> = isNewCustomer
    ? {
        firstName: '',
        lastName: '',
        displayName: '',
        email: '',
        phoneNumber: '',
        status: 'active',
        tags: [],
      }
    : {
        firstName: customer?.firstName || '',
        lastName: customer?.lastName || '',
        displayName: customer?.displayName || '',
        email: customer?.email || '',
        phoneNumber: customer?.phoneNumber || '',
        alternatePhoneNumber: customer?.alternatePhoneNumber || '',
        gender: customer?.gender || '',
        membershipTier: customer?.membershipTier || '',
        source: customer?.source || '',
        status: customer?.status || 'active',
        preferredContactMethod: customer?.preferredContactMethod || 'email',
      };

  return (
    <Box p={3}>
      {/* 頁面標題和操作按鈕 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          {isNewCustomer ? '新增客戶' : '客戶詳情'}
        </Typography>
        <Box>
          <Button variant="outlined" onClick={goBack} sx={{ mr: 1 }}>
            返回列表
          </Button>
          {!isNewCustomer && canManageCRM && !isEditing && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
              onClick={() => setIsEditing(true)}
            >
              編輯
            </Button>
          )}
        </Box>
      </Box>

      {/* 主要內容區域 */}
      <Formik
        initialValues={initialValues}
        validationSchema={customerProfileSchema}
        onSubmit={handleUpdateCustomer}
        enableReinitialize={true}
      >
        {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, dirty }) => (
          <Form>
            {/* 客戶基本信息卡片 */}
            <Paper elevation={3} sx={{ mb: 3 }}>
              <Box p={3}>
                <Typography variant="h6" gutterBottom>
                  基本信息
                </Typography>
                <Grid container spacing={3}>
                  {/* 姓名信息 */}
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      id="firstName"
                      name="firstName"
                      label="名"
                      variant="outlined"
                      value={values.firstName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.firstName && !!errors.firstName}
                      helperText={touched.firstName && errors.firstName}
                      disabled={!isEditing}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      id="lastName"
                      name="lastName"
                      label="姓"
                      variant="outlined"
                      value={values.lastName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.lastName && !!errors.lastName}
                      helperText={touched.lastName && errors.lastName}
                      disabled={!isEditing}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      id="displayName"
                      name="displayName"
                      label="顯示名稱"
                      variant="outlined"
                      value={values.displayName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.displayName && !!errors.displayName}
                      helperText={touched.displayName && errors.displayName}
                      disabled={!isEditing}
                      margin="normal"
                    />
                  </Grid>

                  {/* 聯繫信息 */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      id="email"
                      name="email"
                      label="電子郵件"
                      variant="outlined"
                      value={values.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.email && !!errors.email}
                      helperText={touched.email && errors.email}
                      disabled={!isEditing}
                      margin="normal"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      id="phoneNumber"
                      name="phoneNumber"
                      label="電話號碼"
                      variant="outlined"
                      value={values.phoneNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.phoneNumber && !!errors.phoneNumber}
                      helperText={touched.phoneNumber && errors.phoneNumber}
                      disabled={!isEditing}
                      margin="normal"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  {/* 更多信息 */}
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth margin="normal" disabled={!isEditing}>
                      <InputLabel id="gender-label">性別</InputLabel>
                      <Select
                        labelId="gender-label"
                        id="gender"
                        name="gender"
                        value={values.gender || ''}
                        label="性別"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.gender && !!errors.gender}
                      >
                        <MenuItem value="">
                          <em>未指定</em>
                        </MenuItem>
                        <MenuItem value="male">男</MenuItem>
                        <MenuItem value="female">女</MenuItem>
                        <MenuItem value="other">其他</MenuItem>
                      </Select>
                      {touched.gender && errors.gender && <FormHelperText error>{errors.gender}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      id="membershipTier"
                      name="membershipTier"
                      label="會員等級"
                      variant="outlined"
                      value={values.membershipTier}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.membershipTier && !!errors.membershipTier}
                      helperText={touched.membershipTier && errors.membershipTier}
                      disabled={!isEditing}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth margin="normal" disabled={!isEditing}>
                      <InputLabel id="status-label">狀態</InputLabel>
                      <Select
                        labelId="status-label"
                        id="status"
                        name="status"
                        value={values.status || 'active'}
                        label="狀態"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.status && !!errors.status}
                      >
                        <MenuItem value="active">活躍</MenuItem>
                        <MenuItem value="inactive">非活躍</MenuItem>
                        <MenuItem value="blocked">已封禁</MenuItem>
                      </Select>
                      {touched.status && errors.status && <FormHelperText error>{errors.status}</FormHelperText>}
                    </FormControl>
                  </Grid>

                  {/* 額外聯繫信息 */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      id="alternatePhoneNumber"
                      name="alternatePhoneNumber"
                      label="備用電話"
                      variant="outlined"
                      value={values.alternatePhoneNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.alternatePhoneNumber && !!errors.alternatePhoneNumber}
                      helperText={touched.alternatePhoneNumber && errors.alternatePhoneNumber}
                      disabled={!isEditing}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth margin="normal" disabled={!isEditing}>
                      <InputLabel id="preferredContactMethod-label">偏好聯繫方式</InputLabel>
                      <Select
                        labelId="preferredContactMethod-label"
                        id="preferredContactMethod"
                        name="preferredContactMethod"
                        value={values.preferredContactMethod || 'email'}
                        label="偏好聯繫方式"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.preferredContactMethod && !!errors.preferredContactMethod}
                      >
                        <MenuItem value="email">電子郵件</MenuItem>
                        <MenuItem value="phone">電話</MenuItem>
                        <MenuItem value="sms">簡訊</MenuItem>
                        <MenuItem value="line">LINE</MenuItem>
                      </Select>
                      {touched.preferredContactMethod && errors.preferredContactMethod && (
                        <FormHelperText error>{errors.preferredContactMethod}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>

                  {/* 來源信息 */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      id="source"
                      name="source"
                      label="客戶來源"
                      variant="outlined"
                      value={values.source}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.source && !!errors.source}
                      helperText={touched.source && errors.source}
                      disabled={!isEditing}
                      margin="normal"
                      placeholder="例如：官網、Facebook、推薦..."
                    />
                  </Grid>

                  {/* 僅顯示不可編輯的信息 */}
                  {!isNewCustomer && (
                    <>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          label="註冊日期"
                          variant="outlined"
                          value={customer?.customerSince ? formatDate(customer.customerSince) : '未知'}
                          disabled
                          margin="normal"
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          label="最後活動"
                          variant="outlined"
                          value={customer?.lastActivityDate ? formatDate(customer.lastActivityDate) : '未知'}
                          disabled
                          margin="normal"
                        />
                      </Grid>
                    </>
                  )}
                </Grid>

                {/* 表單按鈕區 */}
                {isEditing && (
                  <Box mt={3} display="flex" justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={cancelEdit}
                      sx={{ mr: 1 }}
                      startIcon={<CancelIcon />}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={isSubmitting || !dirty}
                      startIcon={<SaveIcon />}
                    >
                      保存
                    </Button>
                  </Box>
                )}
              </Box>
            </Paper>
          </Form>
        )}
      </Formik>

      {/* 僅在查看現有客戶時顯示的頁籤區域 */}
      {!isNewCustomer && (
        <Paper elevation={3}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="customer tabs">
              <Tab label="標籤" id="tab-0" aria-controls="tabpanel-0" />
              <Tab label="備註" id="tab-1" aria-controls="tabpanel-1" />
              <Tab label="訂單歷史" id="tab-2" aria-controls="tabpanel-2" disabled />
              <Tab label="行為分析" id="tab-3" aria-controls="tabpanel-3" disabled />
            </Tabs>
          </Box>

          {/* 標籤頁籤 */}
          <TabPanel value={tabValue} index={0}>
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">客戶標籤</Typography>
                {canManageCRM && (
                  <Button
                    variant="outlined"
                    startIcon={<AddCircleIcon />}
                    onClick={() => setAddTagDialogOpen(true)}
                  >
                    添加標籤
                  </Button>
                )}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {customer?.tags && customer.tags.length > 0 ? (
                  customer.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      icon={<TagIcon />}
                      onDelete={canManageCRM ? () => handleRemoveTag(tag) : undefined}
                      sx={{ m: 0.5 }}
                    />
                  ))
                ) : (
                  <Typography variant="body1" color="text.secondary">
                    暫無標籤
                  </Typography>
                )}
              </Box>
            </Box>
          </TabPanel>

          {/* 備註頁籤 */}
          <TabPanel value={tabValue} index={1}>
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">客戶備註</Typography>
                {canManageCRM && (
                  <Button
                    variant="outlined"
                    startIcon={<NoteAddIcon />}
                    onClick={() => setAddNoteDialogOpen(true)}
                  >
                    添加備註
                  </Button>
                )}
              </Box>
              {isLoadingNotes ? (
                <CircularProgress size={24} />
              ) : notes && notes.length > 0 ? (
                <List>
                  {notes.map((note: CustomerNote) => (
                    <Card key={note.noteId} sx={{ mb: 2 }}>
                      <CardHeader
                        avatar={
                          <Avatar>
                            {note.addedByName ? note.addedByName[0].toUpperCase() : 'U'}
                          </Avatar>
                        }
                        title={note.addedByName || '系統'}
                        subheader={formatDateTime(note.timestamp)}
                        action={
                          note.isImportant ? (
                            <IconButton aria-label="important" disabled>
                              <StarIcon color="warning" />
                            </IconButton>
                          ) : null
                        }
                      />
                      <CardContent>
                        <Typography variant="body1">{note.text}</Typography>
                      </CardContent>
                    </Card>
                  ))}
                </List>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  暫無備註
                </Typography>
              )}
            </Box>
          </TabPanel>

          {/* 訂單歷史頁籤 */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="body1" color="text.secondary">
              訂單歷史功能即將上線
            </Typography>
          </TabPanel>

          {/* 行為分析頁籤 */}
          <TabPanel value={tabValue} index={3}>
            <Typography variant="body1" color="text.secondary">
              行為分析功能即將上線
            </Typography>
          </TabPanel>
        </Paper>
      )}

      {/* 添加標籤對話框 */}
      <Dialog open={addTagDialogOpen} onClose={() => setAddTagDialogOpen(false)}>
        <DialogTitle>添加標籤</DialogTitle>
        <Formik
          initialValues={{ tag: '' }}
          validationSchema={tagSchema}
          onSubmit={handleAddTag}
        >
          {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
            <Form onSubmit={handleSubmit}>
              <DialogContent>
                <TextField
                  autoFocus
                  margin="dense"
                  id="tag"
                  name="tag"
                  label="標籤名稱"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={values.tag}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.tag && !!errors.tag}
                  helperText={touched.tag && errors.tag}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setAddTagDialogOpen(false)} color="primary">
                  取消
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting || !values.tag}
                >
                  添加
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      {/* 添加備註對話框 */}
      <Dialog open={addNoteDialogOpen} onClose={() => setAddNoteDialogOpen(false)}>
        <DialogTitle>添加備註</DialogTitle>
        <Formik
          initialValues={{ text: '', isImportant: false }}
          validationSchema={noteSchema}
          onSubmit={handleAddNote}
        >
          {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, setFieldValue }) => (
            <Form onSubmit={handleSubmit}>
              <DialogContent>
                <TextField
                  autoFocus
                  margin="dense"
                  id="text"
                  name="text"
                  label="備註內容"
                  type="text"
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  value={values.text}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.text && !!errors.text}
                  helperText={touched.text && errors.text}
                />
                <Box display="flex" alignItems="center" mt={2}>
                  <IconButton
                    onClick={() => setFieldValue('isImportant', !values.isImportant)}
                    color={values.isImportant ? 'warning' : 'default'}
                  >
                    {values.isImportant ? <StarIcon /> : <StarBorderIcon />}
                  </IconButton>
                  <Typography variant="body2">
                    {values.isImportant ? '標記為重要' : '標記為重要'}
                  </Typography>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setAddNoteDialogOpen(false)} color="primary">
                  取消
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting || !values.text}
                >
                  添加
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      {/* 提示信息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CustomerDetailPage; 