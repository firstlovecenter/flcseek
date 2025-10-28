'use client';

import { useEffect, useState } from 'react';
import { Card, Typography, Table, Tag, Button, Space, Modal, Form, Input, message, Spin, Popconfirm, InputNumber, Switch } from 'antd';
import { TrophyOutlined, CheckCircleOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface Milestone {
  id: string;
  stage_number: number;
  stage_name: string;
  short_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function MilestonesPage() {
  const { token } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchMilestones();
  }, []);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/superadmin/milestones', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch milestones');
      }

      const data = await response.json();
      setMilestones(data.milestones);
    } catch (error) {
      console.error('Error fetching milestones:', error);
      message.error('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingMilestone(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (milestone: Milestone) => {
    setIsCreating(false);
    setEditingMilestone(milestone);
    form.setFieldsValue({
      stage_number: milestone.stage_number,
      stage_name: milestone.stage_name,
      short_name: milestone.short_name,
      description: milestone.description,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/superadmin/milestones?id=${id}`, {
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
      console.error('Error deleting milestone:', error);
      message.error(error.message || 'Failed to delete milestone');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/superadmin/milestones', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id,
          is_active: !currentStatus,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update milestone status');
      }

      message.success(`Milestone ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchMilestones();
    } catch (error: any) {
      console.error('Error toggling milestone status:', error);
      message.error(error.message || 'Failed to update milestone status');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (isCreating) {
        // Create new milestone
        const response = await fetch('/api/superadmin/milestones', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            stage_number: values.stage_number,
            stage_name: values.stage_name,
            short_name: values.short_name,
            description: values.description,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create milestone');
        }

        message.success('Milestone created successfully');
      } else {
        // Update existing milestone
        if (!editingMilestone) return;

        const response = await fetch('/api/superadmin/milestones', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: editingMilestone.id,
            stage_name: values.stage_name,
            short_name: values.short_name,
            description: values.description,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update milestone');
        }

        message.success('Milestone updated successfully');
      }

      setIsModalVisible(false);
      form.resetFields();
      setEditingMilestone(null);
      fetchMilestones();
    } catch (error: any) {
      console.error('Error saving milestone:', error);
      message.error(error.message || 'Failed to save milestone');
    }
  };

  const columns = [
    {
      title: 'Stage #',
      dataIndex: 'stage_number',
      key: 'stage_number',
      width: 100,
      render: (stage_number: number) => <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>{stage_number}</Tag>,
      sorter: (a: Milestone, b: Milestone) => a.stage_number - b.stage_number,
    },
    {
      title: 'Short Name',
      dataIndex: 'short_name',
      key: 'short_name',
      width: 150,
      render: (short_name: string) => (
        <Tag color="cyan" style={{ whiteSpace: 'pre-wrap' }}>
          {short_name || 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Milestone Name',
      dataIndex: 'stage_name',
      key: 'stage_name',
      render: (stage_name: string) => (
        <span>
          <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
          <strong>{stage_name}</strong>
        </span>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (is_active: boolean, record: Milestone) => (
        <Switch
          checked={is_active}
          onChange={() => handleToggleActive(record.id, is_active)}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
        />
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value: any, record: Milestone) => record.is_active === value,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => (
        <Text type="secondary">
          {dayjs(date).format('MMM D, YYYY h:mm A')}
        </Text>
      ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date: string) => (
        <Text type="secondary">
          {dayjs(date).format('MMM D, YYYY h:mm A')}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Milestone) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Milestone"
            description="Are you sure you want to delete this milestone? This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          <TrophyOutlined /> Milestone Management
        </Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleCreate}
          size="large"
        >
          Add New Milestone
        </Button>
      </div>

      <Paragraph>
        Manage the spiritual growth milestones tracked for all registered members.
        You can add, edit, or remove milestones to match your church's discipleship process.
      </Paragraph>

      <Card>
        <Table
          dataSource={milestones}
          columns={columns}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} milestones`,
          }}
          size="middle"
          rowKey="id"
          scroll={{ x: 1200 }}
        />
      </Card>

      <Card title="Milestone Information" style={{ marginTop: 16 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Paragraph>
            <strong>Total Stages:</strong> {milestones.length} spiritual growth milestones
          </Paragraph>
          <Paragraph>
            <strong>Stage Numbers:</strong> Each milestone must have a unique stage number (1-99). Members progress through these stages sequentially.
          </Paragraph>
          <Paragraph>
            <strong>Completion Requirement:</strong> Members should complete all stages plus 26 attendance records to be considered fully integrated.
          </Paragraph>
          <Paragraph>
            <strong>Tracking:</strong> Progress is tracked automatically in the progress_records table. Sheep seekers mark milestones as completed for their members.
          </Paragraph>
          <Paragraph type="warning">
            <strong>⚠️ Warning:</strong> Deleting a milestone that has been marked as completed for members will fail. 
            You must remove all associated progress records first.
          </Paragraph>
        </Space>
      </Card>

      <Modal
        title={isCreating ? 'Add New Milestone' : `Edit Stage ${editingMilestone?.stage_number}`}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
          setEditingMilestone(null);
          setIsCreating(false);
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {isCreating && (
            <Form.Item
              name="stage_number"
              label="Stage Number"
              rules={[
                { required: true, message: 'Please enter stage number' },
                { type: 'number', min: 1, max: 99, message: 'Stage number must be between 1 and 99' }
              ]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                placeholder="Enter a unique stage number (1-99)"
              />
            </Form.Item>
          )}
          {!isCreating && editingMilestone && (
            <Form.Item label="Stage Number">
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                {editingMilestone.stage_number}
              </Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                (Stage numbers cannot be changed)
              </Text>
            </Form.Item>
          )}
          <Form.Item
            name="stage_name"
            label="Milestone Name"
            rules={[{ required: true, message: 'Please enter milestone name' }]}
          >
            <Input placeholder="e.g., Completed New Believers School" />
          </Form.Item>
          <Form.Item
            name="short_name"
            label="Short Name"
            rules={[{ required: true, message: 'Please enter short name' }]}
            extra="This appears in compact milestone grids. Use \n for line breaks (e.g., 'NB\nSchool')"
          >
            <Input placeholder="e.g., NB School or Water\nBaptism" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea 
              rows={3} 
              placeholder="Describe what this milestone represents..."
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {isCreating ? 'Create Milestone' : 'Save Changes'}
              </Button>
              <Button
                onClick={() => {
                  setIsModalVisible(false);
                  form.resetFields();
                  setEditingMilestone(null);
                  setIsCreating(false);
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
