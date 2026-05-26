'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Modal, Form, message, Typography, Card, Select, Tag, Segmented } from 'antd';
import { TeamOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, UserOutlined, InboxOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { GROUP_FILTERS, GroupFilter } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const { Title } = Typography;
const { Option } = Select;

const monthOrder: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

interface Group {
  id: string;
  name: string;
  year: number;
  description: string;
  archived: boolean;
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
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<GroupFilter>(GROUP_FILTERS.ACTIVE);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form] = Form.useForm();

  const availableYears = Array.from(
    { length: new Date().getFullYear() - 2025 + 1 },
    (_, idx) => 2025 + idx
  );

  useEffect(() => {
    if (token) {
      fetchGroups();
      fetchUsers();
    }
  }, [token, filter]);

  useEffect(() => {
    filterGroups();
  }, [groups, searchText]);

  const filterGroups = () => {
    if (!searchText) {
      setFilteredGroups(groups);
    } else {
      const filtered = groups.filter(
        (group) =>
          group.name.toLowerCase().includes(searchText.toLowerCase()) ||
          (group.description && group.description.toLowerCase().includes(searchText.toLowerCase())) ||
          (group.leader_name && group.leader_name.toLowerCase().includes(searchText.toLowerCase()))
      );
      setFilteredGroups(filtered);
    }
  };

  const fetchGroups = async () => {
    try {
      setLoading(true);
      
      // Use new v1 API
      const response = await api.groups.list({
        active: filter === GROUP_FILTERS.ACTIVE ? true : filter === GROUP_FILTERS.ARCHIVED ? false : undefined,
      });
      
      if (response.success && response.data) {
        const sorted = (response.data.groups || []).slice().sort((a: Group, b: Group) => {
          if (b.year !== a.year) return b.year - a.year;
          const aOrder = monthOrder[a.name.toLowerCase()] || 999;
          const bOrder = monthOrder[b.name.toLowerCase()] || 999;
          return aOrder - bOrder;
        });

        setGroups(sorted);
        setFilteredGroups(sorted);
      } else {
        message.error(response.error?.message || 'Failed to fetch groups');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.users.list();
      if (response.success && response.data) {
        setUsers(response.data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      year: group.year,
      description: group.description,
      archived: group.archived,
      leader_id: group.leader_id,
    });
    setIsModalVisible(true);
  };

  const handleArchive = async (groupId: string, archived: boolean) => {
    try {
      const response = await fetch(`/api/superadmin/groups/${groupId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ archived: !archived }),
      });

      if (response.ok) {
        message.success(`Group ${!archived ? 'archived' : 'unarchived'} successfully`);
        fetchGroups();
      } else {
        message.error('Failed to update group');
      }
    } catch (error) {
      message.error('An error occurred');
    }
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
            credentials: 'include',
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

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      const url = editingGroup
        ? `/api/superadmin/groups/${editingGroup.id}`
        : '/api/superadmin/groups';
      
      const method = editingGroup ? 'PUT' : 'POST';

      const payload = {
        ...values,
        year: values.year ? Number(values.year) : undefined,
      };

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
      render: (name: string, record: Group) => (
        <a 
          onClick={() => router.push(`/?group_id=${record.id}`)}
          style={{ cursor: 'pointer', color: '#1890ff' }}
        >
          {`${name} ${record.year}`}
        </a>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'archived',
      key: 'archived',
      width: 100,
      render: (archived: boolean) => 
        archived ? 
          <Tag color="default" icon={<InboxOutlined />}>Archived</Tag> : 
          <Tag color="success" icon={<CheckCircleOutlined />}>Active</Tag>,
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
      render: (_: unknown, record: Group) => (
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
            onClick={() => handleArchive(record.id, record.archived)}
          >
            {record.archived ? 'Unarchive' : 'Archive'}
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
        <TeamOutlined /> Group Management
      </Title>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Input
              placeholder="Search groups..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 250 }}
            />

            <Segmented
              value={filter}
              onChange={(value) => setFilter(value as GroupFilter)}
              options={[
                { label: 'Active', value: GROUP_FILTERS.ACTIVE },
                { label: 'Archived', value: GROUP_FILTERS.ARCHIVED },
                { label: 'All', value: GROUP_FILTERS.ALL },
              ]}
            />
          </Space>
          
          <Space>
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
        </Space>
      </Card>

      <Card>
        <Table
          dataSource={filteredGroups}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ 
            current: currentPage,
            pageSize: pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} groups`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

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
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ year: new Date().getFullYear() }}
        >
          <Form.Item
            name="name"
            label="Group Name"
            rules={[{ required: true, message: 'Please enter group name' }]}
          >
            <Input placeholder="e.g., January, February, March" />
          </Form.Item>
          
          <Form.Item
            name="year"
            label="Year"
            rules={[{ required: true, message: 'Please select year' }]}
          >
            <Select
              placeholder="Select year"
              options={availableYears.map((y) => ({ label: y, value: y }))}
            />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional description for this group" />
          </Form.Item>
          
          <Form.Item
            name="leader_id"
            label="Group Leader"
          >
            <Select 
              placeholder="Select a leader (optional)" 
              allowClear
              showSearch
              filterOption={(input, option) => {
                const label = `${option?.children}`;
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.username}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          {editingGroup && (
            <Form.Item name="archived" label="Status" valuePropName="checked">
              <Select>
                <Option value={false}>Active</Option>
                <Option value={true}>Archived</Option>
              </Select>
            </Form.Item>
          )}
          
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
