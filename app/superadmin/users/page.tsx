'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Tag, Space, Modal, Form, message, Typography, Card } from 'antd';
import { UserOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title } = Typography;
const { Option } = Select;

interface User {
  id: string;
  username: string;
  role: string;
  phone_number: string;
  group_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  year: number;
}

export default function UsersManagementPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchGroups();
    }
  }, [token]);

  useEffect(() => {
    filterUsers();
  }, [users, searchText, roleFilter]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/superadmin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setUsers(data.users || []);
      setFilteredUsers(data.users || []);
    } catch (error) {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/superadmin/groups?filter=active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setGroups(data.groups || []);
      return data.groups || [];
    } catch (error) {
      console.error('Failed to fetch groups');
      return [];
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchText) {
      filtered = filtered.filter(
        (user) =>
          user.username.toLowerCase().includes(searchText.toLowerCase()) ||
          user.phone_number.includes(searchText)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    
    // Ensure groups are loaded before opening modal
    const openModal = (loadedGroups: Group[]) => {
      // If user has a group_name, try to match it with the full format (name-year)
      if (user.group_name && loadedGroups.length > 0) {
        // Check if group_name already has year format (name-year)
        if (user.group_name.includes('-')) {
          form.setFieldsValue(user);
        } else {
          // Old format: just the name, find the matching group (prefer most recent year)
          const matchingGroup = loadedGroups
            .filter(g => g.name === user.group_name)
            .sort((a, b) => b.year - a.year)[0]; // Get most recent year
          
          if (matchingGroup) {
            form.setFieldsValue({
              ...user,
              group_name: `${matchingGroup.name}-${matchingGroup.year}`
            });
          } else {
            form.setFieldsValue(user);
          }
        }
      } else {
        form.setFieldsValue(user);
      }
      setIsModalVisible(true);
    };
    
    if (groups.length === 0) {
      fetchGroups().then(openModal);
    } else {
      openModal(groups);
    }
  };

  const handleDelete = (userId: string) => {
    Modal.confirm({
      title: 'Delete User',
      content: 'Are you sure you want to delete this user? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await fetch(`/api/superadmin/users/${userId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          message.success('User deleted successfully');
          fetchUsers();
        } catch (error) {
          message.error('Failed to delete user');
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editingUser
        ? `/api/superadmin/users/${editingUser.id}`
        : '/api/superadmin/users';
      
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success(`User ${editingUser ? 'updated' : 'created'} successfully`);
        setIsModalVisible(false);
        form.resetFields();
        setEditingUser(null);
        fetchUsers();
      } else {
        message.error('Failed to save user');
      }
    } catch (error) {
      message.error('An error occurred');
    }
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      sorter: (a: User, b: User) => a.username.localeCompare(b.username),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const roleColors: Record<string, string> = {
          superadmin: 'red',
          leadpastor: 'purple',
          admin: 'blue',
          leader: 'green',
        };
        const roleLabels: Record<string, string> = {
          superadmin: 'Super Admin',
          leadpastor: 'Lead Pastor',
          admin: 'Admin',
          leader: 'Leader',
        };
        return (
          <Tag color={roleColors[role] || 'default'}>
            {roleLabels[role] || role}
          </Tag>
        );
      },
    },
    {
      title: 'Phone Number',
      dataIndex: 'phone_number',
      key: 'phone_number',
    },
    {
      title: 'Name',
      key: 'name',
      render: (_: any, record: User) => {
        const fullName = [record.first_name, record.last_name].filter(Boolean).join(' ');
        return fullName || '-';
      },
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => email || '-',
    },
    {
      title: 'Group',
      dataIndex: 'group_name',
      key: 'group_name',
      render: (group: string) => group || '-',
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a: User, b: User) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', paddingBottom: '80px' }}>
      <Title level={2}>
        <UserOutlined /> User Management
      </Title>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search users..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            style={{ width: 200 }}
          >
            <Option value="all">All Roles</Option>
            <Option value="superadmin">Super Admin</Option>
            <Option value="leadpastor">Lead Pastor</Option>
            <Option value="admin">Admin</Option>
            <Option value="leader">Leader</Option>
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingUser(null);
              form.resetFields();
              // Ensure groups are loaded before opening modal
              if (groups.length === 0) {
                fetchGroups().then(() => setIsModalVisible(true));
              } else {
                setIsModalVisible(true);
              }
            }}
          >
            Add User
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          dataSource={filteredUsers}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ 
            pageSize: 10, 
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={editingUser ? 'Edit User' : 'Create New User'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
          setEditingUser(null);
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Please enter username' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="first_name"
            label="First Name"
          >
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item
            name="last_name"
            label="Last Name"
          >
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', message: 'Please enter a valid email' }]}
          >
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? "New Password (leave blank to keep current)" : "Password"}
            rules={[{ required: !editingUser, message: 'Please enter password' }]}
          >
            <Input.Password placeholder={editingUser ? "Leave blank to keep current password" : ""} />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select role' }]}
          >
            <Select>
              <Option value="superadmin">Super Admin</Option>
              <Option value="leadpastor">Lead Pastor</Option>
              <Option value="admin">Admin</Option>
              <Option value="leader">Leader</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="phone_number"
            label="Phone Number"
            rules={[{ required: true, message: 'Please enter phone number' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="group_name" label="Group Name">
            <Select 
              placeholder="Optional - Select a group" 
              allowClear
              showSearch
              filterOption={(input, option) => {
                const label = `${option?.children}`;
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {groups.map(group => (
                <Option key={group.id} value={`${group.name}-${group.year}`}>
                  {group.name} ({group.year})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingUser ? 'Update' : 'Create'}
              </Button>
              <Button
                onClick={() => {
                  setIsModalVisible(false);
                  form.resetFields();
                  setEditingUser(null);
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
