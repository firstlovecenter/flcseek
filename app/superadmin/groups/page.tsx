'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Modal, Form, message, Typography, Card, Select, Tag } from 'antd';
import { TeamOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title } = Typography;
const { Option } = Select;

interface Group {
  id: string;
  name: string;
  description: string;
  leader_id: string | null;
  leader_name: string | null;
  member_count: number;
  created_at: string;
}

interface User {
  id: string;
  username: string;
}

export default function GroupsManagementPage() {
  const { token } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (token) {
      fetchGroups();
      fetchUsers();
    }
  }, [token]);

  useEffect(() => {
    filterGroups();
  }, [groups, searchText]);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/superadmin/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setGroups(data.groups || []);
      setFilteredGroups(data.groups || []);
    } catch (error) {
      message.error('Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/superadmin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  const filterGroups = () => {
    if (!searchText) {
      setFilteredGroups(groups);
      return;
    }

    const filtered = groups.filter(
      (group) =>
        group.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (group.description && group.description.toLowerCase().includes(searchText.toLowerCase()))
    );
    setFilteredGroups(filtered);
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    form.setFieldsValue(group);
    setIsModalVisible(true);
  };

  const handleDelete = (groupId: string) => {
    Modal.confirm({
      title: 'Delete Group',
      content: 'Are you sure you want to delete this group? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await fetch(`/api/superadmin/groups/${groupId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          message.success('Group deleted successfully');
          fetchGroups();
        } catch (error) {
          message.error('Failed to delete group');
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editingGroup
        ? `/api/superadmin/groups/${editingGroup.id}`
        : '/api/superadmin/groups';
      
      const method = editingGroup ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success(`Group ${editingGroup ? 'updated' : 'created'} successfully`);
        setIsModalVisible(false);
        form.resetFields();
        setEditingGroup(null);
        fetchGroups();
      } else {
        message.error('Failed to save group');
      }
    } catch (error) {
      message.error('An error occurred');
    }
  };

  const columns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Group, b: Group) => a.name.localeCompare(b.name),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || '-',
    },
    {
      title: 'Leader',
      dataIndex: 'leader_name',
      key: 'leader_name',
      render: (name: string) => name ? <Tag color="blue"><UserOutlined /> {name}</Tag> : <Tag>No Leader</Tag>,
    },
    {
      title: 'Members',
      dataIndex: 'member_count',
      key: 'member_count',
      sorter: (a: Group, b: Group) => a.member_count - b.member_count,
      render: (count: number) => <Tag color="green">{count} members</Tag>,
    },
    {
      title: 'Created At',
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
    <div>
      <Title level={2}>
        <TeamOutlined /> Group Management
      </Title>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search groups..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingGroup(null);
              form.resetFields();
              setIsModalVisible(true);
            }}
          >
            Create Group
          </Button>
        </Space>
      </Card>

      <Table
        dataSource={filteredGroups}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Modal
        title={editingGroup ? 'Edit Group' : 'Create New Group'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
          setEditingGroup(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Group Name"
            rules={[{ required: true, message: 'Please enter group name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional group description" />
          </Form.Item>
          <Form.Item name="leader_id" label="Group Leader">
            <Select placeholder="Select a leader (optional)" allowClear>
              {users.map((user) => (
                <Option key={user.id} value={user.id}>
                  {user.username}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingGroup ? 'Update' : 'Create'}
              </Button>
              <Button
                onClick={() => {
                  setIsModalVisible(false);
                  form.resetFields();
                  setEditingGroup(null);
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
