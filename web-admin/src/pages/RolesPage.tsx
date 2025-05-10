import React, { useState } from 'react';
import { Box, Container, Breadcrumbs, Link, Typography, Modal } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';

import RoleList from '../components/RoleManagement/RoleList';
import RoleForm from '../components/RoleManagement/RoleForm';
import { Role } from '../types/role';

/**
 * 角色管理頁面 - 主路由組件
 * 整合角色列表視圖和角色表單模態框
 */
const RolesPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'add'>('add');

  // 處理開啟新增角色模態框
  const handleAddRole = () => {
    setSelectedRoleId(undefined);
    setModalMode('add');
    setIsModalOpen(true);
  };

  // 處理開啟編輯角色模態框
  const handleEditRole = (roleId: string) => {
    setSelectedRoleId(roleId);
    setModalMode('edit');
    setIsModalOpen(true);
  };
  
  // 處理開啟查看角色模態框
  const handleViewRole = (roleId: string) => {
    setSelectedRoleId(roleId);
    setModalMode('view');
    setIsModalOpen(true);
  };
  
  // 處理關閉模態框
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  // 處理角色保存成功
  const handleRoleSuccess = (role: Role) => {
    setIsModalOpen(false);
    // 這裡可以添加成功通知或更新列表
    alert(`角色${modalMode === 'add' ? '新增' : '更新'}成功: ${role.name}`);
  };
  
  // 模態框標題根據模式設定
  const getModalTitle = () => {
    switch (modalMode) {
      case 'add':
        return '新增角色';
      case 'edit':
        return '編輯角色';
      case 'view':
        return '角色詳情';
      default:
        return '角色';
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Breadcrumbs 
          separator={<NavigateNextIcon fontSize="small" />} 
          aria-label="breadcrumb"
          sx={{ mb: 3 }}
        >
          <Link 
            component={RouterLink} 
            to="/" 
            color="inherit"
            underline="hover"
          >
            首頁
          </Link>
          <Typography color="text.primary">角色管理</Typography>
        </Breadcrumbs>
        
        <RoleList 
          onAdd={handleAddRole} 
          onEdit={handleEditRole} 
          onView={handleViewRole}
        />
        
        {/* 角色表單模態框 */}
        <Modal
          open={isModalOpen}
          onClose={handleCloseModal}
          aria-labelledby="role-form-modal-title"
        >
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxWidth: 900,
            maxHeight: '90vh',
            overflow: 'auto',
            bgcolor: 'background.paper',
            boxShadow: 24,
            borderRadius: 1,
            p: 4
          }}>
            <Typography id="role-form-modal-title" variant="h6" component="h2" sx={{ mb: 2 }}>
              {getModalTitle()}
            </Typography>
            
            <RoleForm 
              roleId={selectedRoleId} 
              onSuccess={handleRoleSuccess} 
              onCancel={handleCloseModal}
            />
          </Box>
        </Modal>
      </Box>
    </Container>
  );
};

export default RolesPage; 