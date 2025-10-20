'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  message, 
  Popconfirm,
  Space,
  Card,
  Statistic,
  Row,
  Col,
  Tag
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  TeamOutlined,
  AppstoreOutlined,
  EyeOutlined
} from '@ant-design/icons';

const { TextArea } = Input;

interface Stream {
  id: string;
  name: string;
  description: string;
  stream_leader_id: string;
  stream_leader_name: string;
  active_groups_count: number;
  members_count: number;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  username: string;
  role: string;
}

export default function StreamsManagement() {
  const router = useRouter();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamLeaders, setStreamLeaders] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchStreams();
    fetchStreamLeaders();
  }, []);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/streams', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStreams(data);
      } else if (response.status === 401) {
        message.error('Session expired. Please login again.');
        router.push('/');
      } else {
        message.error('Failed to fetch streams');
      }
    } catch (error) {
      console.error('Error fetching streams:', error);
      message.error('An error occurred while fetching streams');
    } finally {
      setLoading(false);
    }
  };

  const fetchStreamLeaders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users?role=stream_leader', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStreamLeaders(data);
      }
    } catch (error) {
      console.error('Error fetching stream leaders:', error);
    }
  };

  const handleAdd = () => {
    setEditingStream(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (stream: Stream) => {
    setEditingStream(stream);
    form.setFieldsValue({
      name: stream.name,
      description: stream.description,
      stream_leader_id: stream.stream_leader_id,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/streams/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        message.success('Stream deleted successfully');
        fetchStreams();
      } else {
        const error = await response.json();
        message.error(error.error || 'Failed to delete stream');
      }
    } catch (error) {
      console.error('Error deleting stream:', error);
      message.error('An error occurred while deleting the stream');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');

      const url = editingStream
        ? `/api/streams/${editingStream.id}`
        : '/api/streams';
      const method = editingStream ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success(
          `Stream ${editingStream ? 'updated' : 'created'} successfully`
        );
        setModalVisible(false);
        form.resetFields();
        fetchStreams();
        fetchStreamLeaders();
      } else {
        const error = await response.json();
        message.error(error.error || `Failed to ${editingStream ? 'update' : 'create'} stream`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const columns = [
    {
      title: 'Stream Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Stream, b: Stream) => a.name.localeCompare(b.name),
      render: (name: string, record: Stream) => (
        <Button 
          type="link" 
          onClick={() => router.push(`/super-admin/streams/${record.id}`)}
          style={{ padding: 0, height: 'auto', fontWeight: 500 }}
        >
          {name}
        </Button>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Stream Leader',
      dataIndex: 'stream_leader_name',
      key: 'stream_leader_name',
      render: (name: string) => name || <Tag color="orange">Not Assigned</Tag>,
    },
    {
      title: 'Active Groups',
      dataIndex: 'active_groups_count',
      key: 'active_groups_count',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'green' : 'default'} icon={<AppstoreOutlined />}>
          {count}
        </Tag>
      ),
    },
    {
      title: 'Members',
      dataIndex: 'members_count',
      key: 'members_count',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'} icon={<TeamOutlined />}>
          {count}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: Stream) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/super-admin/streams/${record.id}`)}
          >
            View
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this stream?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalGroups = streams.reduce((sum, s) => sum + (s.active_groups_count || 0), 0);
  const totalMembers = streams.reduce((sum, s) => sum + (s.members_count || 0), 0);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Stream Management</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Create Stream
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Streams"
              value={streams.length}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Active Groups"
              value={totalGroups}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Members"
              value={totalMembers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={streams}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} streams`,
          }}
        />
      </Card>

      <Modal
        title={editingStream ? 'Edit Stream' : 'Create Stream'}
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
            label="Stream Name"
            rules={[{ required: true, message: 'Please enter stream name' }]}
          >
            <Input placeholder="e.g., North Stream, Youth Stream" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea 
              rows={4} 
              placeholder="Brief description of this stream's purpose and focus area"
            />
          </Form.Item>

          <Form.Item
            name="stream_leader_id"
            label="Stream Leader"
            rules={[{ required: true, message: 'Please select a stream leader' }]}
          >
            <Select
              placeholder="Select a stream leader"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={streamLeaders.map((leader) => ({
                value: leader.id,
                label: leader.username,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
