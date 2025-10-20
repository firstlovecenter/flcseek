'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Typography,
  Spin,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Popconfirm,
  Card,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  OrderedListOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Milestone {
  id: string;
  stage_number: number;
  stage_name: string;
  description?: string;
  created_at: string;
}

export default function MilestonesPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'super_admin')) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchMilestones();
    }
  }, [user, token, authLoading, router]);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      console.log('Fetching milestones with token:', token);
      
      const response = await fetch('/api/milestones', {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch milestones');
      }

      const data = await response.json();
      console.log('Fetched milestones:', data);
      setMilestones(data.milestones || []);
    } catch (error: any) {
      console.error('Fetch error:', error);
      message.error(error.message || 'Failed to load milestones');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMilestone(null);
    form.resetFields();
    // Set default stage number to next available
    const maxStageNumber = Math.max(0, ...milestones.map(m => m.stage_number));
    form.setFieldsValue({ stage_number: maxStageNumber + 1 });
    setIsModalOpen(true);
  };

  const handleEdit = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    form.setFieldsValue({
      stage_number: milestone.stage_number,
      stage_name: milestone.stage_name,
      description: milestone.description,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/milestones/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete milestone');
      }

      message.success('Milestone deleted successfully');
      fetchMilestones();
    } catch (error: any) {
      message.error(error.message || 'Failed to delete milestone');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editingMilestone
        ? `/api/milestones/${editingMilestone.id}`
        : '/api/milestones';
      
      const method = editingMilestone ? 'PUT' : 'POST';

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
        throw new Error(error.error || `Failed to ${editingMilestone ? 'update' : 'create'} milestone`);
      }

      message.success(`Milestone ${editingMilestone ? 'updated' : 'created'} successfully!`);
      setIsModalOpen(false);
      form.resetFields();
      fetchMilestones();
    } catch (error: any) {
      message.error(error.message || `Failed to ${editingMilestone ? 'update' : 'create'} milestone`);
    }
  };

  const columns = [
    {
      title: 'Stage #',
      dataIndex: 'stage_number',
      key: 'stage_number',
      width: 100,
      sorter: (a: Milestone, b: Milestone) => a.stage_number - b.stage_number,
      defaultSortOrder: 'ascend' as const,
      render: (num: number) => (
        <Tag color="blue" style={{ fontSize: 14, fontWeight: 'bold' }}>
          {num}
        </Tag>
      ),
    },
    {
      title: 'Milestone Name',
      dataIndex: 'stage_name',
      key: 'stage_name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => (
        <Text type="secondary">{text || '—'}</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: Milestone) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Milestone"
            description="Are you sure you want to delete this milestone? This may affect existing progress data."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
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
      <div style={{ padding: '0 16px' }}>
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ flex: '1 1 auto', minWidth: '200px' }}>
            <Title level={2} style={{ marginBottom: 8 }}>
              <OrderedListOutlined /> Milestone Management
            </Title>
            <Text type="secondary">
              Manage the progress stages/milestones that members need to complete
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            size="large"
          >
            Add Milestone
          </Button>
        </div>

        {/* Summary Card */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <Text type="secondary">Total Milestones</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff' }}>
                {milestones.length}
              </div>
            </div>
            <div style={{ flex: 1, paddingLeft: 24, borderLeft: '1px solid #d9d9d9' }}>
              <Text type="secondary">
                These milestones are used to track progress for all members across all groups. 
                Each member can complete up to {milestones.length} milestones.
              </Text>
            </div>
          </div>
        </Card>

        {/* Milestones Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={milestones}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => `Total ${total} milestones`,
            }}
            locale={{
              emptyText: (
                <div style={{ padding: '40px 0' }}>
                  <Text type="secondary">
                    No milestones found. Click "Add Milestone" to create your first milestone.
                  </Text>
                </div>
              ),
            }}
          />
        </Card>

        {/* Add/Edit Modal */}
        <Modal
          title={editingMilestone ? 'Edit Milestone' : 'Add New Milestone'}
          open={isModalOpen}
          onCancel={() => {
            setIsModalOpen(false);
            form.resetFields();
          }}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            style={{ marginTop: 24 }}
          >
            <Form.Item
              label="Stage Number"
              name="stage_number"
              rules={[
                { required: true, message: 'Please enter stage number' },
                { type: 'number', min: 1, message: 'Stage number must be at least 1' },
              ]}
              tooltip="The order number for this milestone (e.g., 1, 2, 3...)"
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                placeholder="Enter stage number"
              />
            </Form.Item>

            <Form.Item
              label="Milestone Name"
              name="stage_name"
              rules={[
                { required: true, message: 'Please enter milestone name' },
                { max: 200, message: 'Name must be less than 200 characters' },
              ]}
              tooltip="A short, descriptive name for this milestone"
            >
              <Input placeholder="e.g., Initial Contact, Follow-up Call, First Meeting" />
            </Form.Item>

            <Form.Item
              label="Description (Optional)"
              name="description"
              rules={[
                { max: 500, message: 'Description must be less than 500 characters' },
              ]}
              tooltip="Additional details about this milestone"
            >
              <TextArea
                rows={4}
                placeholder="Describe what needs to be accomplished at this stage..."
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button
                  onClick={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                  }}
                >
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit">
                  {editingMilestone ? 'Update Milestone' : 'Create Milestone'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </>
  );
}
