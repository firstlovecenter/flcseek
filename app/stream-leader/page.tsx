'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  message,
  Spin,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
} from 'antd';
import {
  TeamOutlined,
  AppstoreOutlined,
  PlusOutlined,
  EditOutlined,
  TrophyOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface Stream {
  id: string;
  name: string;
  description: string;
  active_groups_count: number;
  members_count: number;
}

interface Group {
  id: string;
  name: string;
  description: string;
  stream_name: string;
  leader_username: string;
  member_count: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface User {
  id: string;
  username: string;
  role: string;
}

export default function StreamLeaderDashboard() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [stream, setStream] = useState<Stream | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [availableLeaders, setAvailableLeaders] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (user?.role !== 'stream_leader') {
      router.push('/');
      return;
    }

    fetchStreamData();
    fetchGroups();
  }, [user, token]);

  const fetchStreamData = async () => {
    try {
      const response = await fetch('/api/streams', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setStream(data[0]);
          fetchAvailableLeaders(data[0].id);
        }
      } else if (response.status === 401) {
        message.error('Session expired. Please login again.');
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching stream data:', error);
      message.error('Failed to load stream information');
    }
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups);
      } else if (response.status === 401) {
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      message.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableLeaders = async (streamId: string) => {
    try {
      const response = await fetch(`/api/streams/${streamId}/available-leaders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableLeaders(data);
      }
    } catch (error) {
      console.error('Error fetching available leaders:', error);
    }
  };

  const handleCreateGroup = () => {
    form.resetFields();
    form.setFieldsValue({
      start_date: dayjs(),
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          sheep_seeker_id: values.sheep_seeker_id,
          stream_id: stream?.id,
          start_date: values.start_date ? dayjs(values.start_date).format('YYYY-MM-DD') : undefined,
        }),
      });

      if (response.ok) {
        message.success('Group created successfully');
        setModalVisible(false);
        form.resetFields();
        fetchGroups();
        fetchStreamData();
      } else {
        const error = await response.json();
        message.error(error.error || 'Failed to create group');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const columns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Sheep Seeker',
      dataIndex: 'leader_username',
      key: 'leader_username',
      render: (name: string) => name || <Tag color="orange">Not Assigned</Tag>,
    },
    {
      title: 'Members',
      dataIndex: 'member_count',
      key: 'member_count',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'} icon={<TeamOutlined />}>
          {count}
        </Tag>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (date: string) => date ? dayjs(date).format('MMM DD, YYYY') : '-',
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (date: string) => date ? dayjs(date).format('MMM DD, YYYY') : '-',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      align: 'center' as const,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: Group) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => router.push(`/sheep-seeker/group/${record.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  if (loading && !stream) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const activeGroups = groups.filter(g => g.is_active).length;
  const totalMembers = groups.reduce((sum, g) => sum + g.member_count, 0);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>{stream?.name || 'Stream Dashboard'}</h1>
          <p style={{ color: '#666', marginTop: '8px' }}>{stream?.description}</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateGroup}>
          Create Group
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Groups"
              value={activeGroups}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Groups"
              value={groups.length}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Members"
              value={totalMembers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Available Leaders"
              value={availableLeaders.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Groups in Your Stream">
        <Table
          columns={columns}
          dataSource={groups}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Total ${total} groups`,
          }}
        />
      </Card>

      <Modal
        title="Create New Group"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Group Name"
            rules={[{ required: true, message: 'Please enter group name' }]}
          >
            <Input placeholder="e.g., Group 1, Youth Group" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Brief description of this group" />
          </Form.Item>

          <Form.Item
            name="sheep_seeker_id"
            label="Sheep Seeker (Leader)"
            rules={[{ required: true, message: 'Please select a sheep seeker' }]}
          >
            <Select
              placeholder="Select a sheep seeker"
              showSearch
              optionFilterProp="children"
              options={availableLeaders.map((leader) => ({
                value: leader.id,
                label: `${leader.username} (${leader.role})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="start_date"
            label="Start Date"
            rules={[{ required: true, message: 'Please select start date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <div style={{ padding: '12px', backgroundColor: '#f0f5ff', borderRadius: '4px', marginTop: '16px' }}>
            <CalendarOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            <span style={{ color: '#666' }}>
              Group lifecycle: 6 months from start date
            </span>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
