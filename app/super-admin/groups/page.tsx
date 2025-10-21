'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Modal, Form, Input, Select, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UsergroupAddOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { confirm } = Modal;

interface Group {
  id: string;
  name: string;
  year: number;
  description: string | null;
  leader_id: string | null;
  leader_username: string | null;
  leader_first_name: string | null;
  leader_last_name: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  current_group: string | null;
  current_group_id: string | null;
}

export default function GroupManagementPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'superadmin')) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchGroups();
      fetchAvailableLeaders();
    }
  }, [user, token, authLoading, router]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch groups');

      const data = await response.json();
      setGroups(data.groups || []);
    } catch (error: any) {
      message.error(error.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableLeaders = async () => {
    try {
      const response = await fetch('/api/groups/available-leaders', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    setEditingGroup(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (group: Group) => {
    setModalMode('edit');
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      year: group.year,
      description: group.description,
      leader_id: group.leader_id,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (group: Group) => {
    confirm({
      title: 'Delete Group',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Are you sure you want to delete the group "{group.name}"?</p>
          {group.member_count > 0 && (
            <p style={{ color: 'red', fontWeight: 'bold' }}>
              Warning: This group has {group.member_count} members. You must reassign or remove them first.
            </p>
          )}
        </div>
      ),
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await fetch(`/api/groups/${group.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete group');
          }

          message.success('Group deleted successfully');
          fetchGroups();
          fetchAvailableLeaders();
        } catch (error: any) {
          message.error(error.message || 'Failed to delete group');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      const url = modalMode === 'create' 
        ? '/api/groups'
        : `/api/groups/${editingGroup?.id}`;
      
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${modalMode} group`);
      }

      message.success(`Group ${modalMode === 'create' ? 'created' : 'updated'} successfully`);
      setIsModalOpen(false);
      form.resetFields();
      fetchGroups();
      fetchAvailableLeaders();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('Please fill in all required fields');
      } else {
        message.error(error.message || `Failed to ${modalMode} group`);
      }
    }
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const columns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Group) => `${name} ${record.year}`,
      sorter: (a: Group, b: Group) => {
        const aName = `${a.name} ${a.year}`;
        const bName = `${b.name} ${b.year}`;
        return aName.localeCompare(bName);
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string | null) => desc || <Text type="secondary">-</Text>,
    },
    {
      title: 'Group Leader',
      key: 'leader',
      render: (_: any, record: Group) => {
        if (!record.leader_id) {
          return <Tag color="default">No Leader Assigned</Tag>;
        }
        const leaderName = `${record.leader_first_name || ''} ${record.leader_last_name || ''}`.trim() || record.leader_username;
        return <Tag color="blue">{leaderName}</Tag>;
      },
    },
    {
      title: 'Members',
      dataIndex: 'member_count',
      key: 'member_count',
      render: (count: number) => (
        <Tag color={count > 0 ? 'green' : 'default'}>{count} {count === 1 ? 'member' : 'members'}</Tag>
      ),
      sorter: (a: Group, b: Group) => a.member_count - b.member_count,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a: Group, b: Group) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Group) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <AppBreadcrumb />
      <div>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>
              <UsergroupAddOutlined /> Group Management
            </Title>
            <Text type="secondary">
              Create and manage groups, assign leaders, and organize members
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size="large"
          >
            Create New Group
          </Button>
        </div>

        <Table
          dataSource={groups}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Total ${total} groups`,
          }}
        />

        <Modal
          title={modalMode === 'create' ? 'Create New Group' : 'Edit Group'}
          open={isModalOpen}
          onOk={handleModalOk}
          onCancel={handleModalCancel}
          width={600}
          okText={modalMode === 'create' ? 'Create' : 'Update'}
        >
          <Form
            form={form}
            layout="vertical"
            style={{ marginTop: 24 }}
          >
            <Form.Item
              name="name"
              label="Group Name"
              rules={[
                { required: true, message: 'Please enter group name' },
                { min: 2, message: 'Group name must be at least 2 characters' },
              ]}
            >
              <Input placeholder="January, February, March, etc." size="large" />
            </Form.Item>

            <Form.Item
              name="year"
              label="Year"
              rules={[
                { required: true, message: 'Please select a year' },
              ]}
              initialValue={new Date().getFullYear()}
            >
              <Select
                placeholder="Select year"
                size="large"
                options={[
                  { value: 2024, label: '2024' },
                  { value: 2025, label: '2025' },
                  { value: 2026, label: '2026' },
                  { value: 2027, label: '2027' },
                  { value: 2028, label: '2028' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="description"
              label="Description (Optional)"
            >
              <TextArea 
                placeholder="Brief description of this group" 
                rows={3}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="leader_id"
              label="Group Leader (Optional)"
              help="Assign a user as the group leader. They will automatically become a Sheep Seeker."
            >
              <Select
                placeholder="Select a user to be group leader"
                size="large"
                allowClear
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={users.map(u => {
                  const displayName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                  const hasGroup = u.current_group ? ` (Currently leads: ${u.current_group})` : '';
                  return {
                    value: u.id,
                    label: `${displayName} (${u.email || u.username})${hasGroup}`,
                  };
                })}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </>
  );
}
