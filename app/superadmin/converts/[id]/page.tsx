'use client';

import { useEffect, useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Divider, Select, Space, Tag } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

interface Convert {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string;
  date_of_birth: string | null;
  gender: string | null;
  residential_location: string | null;
  school_residential_location: string | null;
  occupation_type: string | null;
  group_name: string;
  registered_by: string;
  created_at: string;
  updated_at: string;
}

export default function EditConvertPage({ params }: { params: { id: string } }) {
  const { token } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convert, setConvert] = useState<Convert | null>(null);

  useEffect(() => {
    if (token) {
      fetchConvert();
    }
  }, [token, params.id]);

  const fetchConvert = async () => {
    try {
      const response = await fetch(`/api/superadmin/converts/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (response.ok) {
        setConvert(data.convert);
        form.setFieldsValue({
          first_name: data.convert.first_name,
          last_name: data.convert.last_name,
          phone_number: data.convert.phone_number,
          date_of_birth: data.convert.date_of_birth,
          gender: data.convert.gender,
          residential_location: data.convert.residential_location,
          school_residential_location: data.convert.school_residential_location,
          occupation_type: data.convert.occupation_type,
          group_name: data.convert.group_name,
        });
      } else {
        message.error(data.error || 'Failed to load convert');
        router.back();
      }
    } catch (error) {
      message.error('Failed to fetch convert details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);

    try {
      const response = await fetch(`/api/superadmin/converts/${params.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success('✅ Convert details updated successfully');
        setConvert(data.convert);
        setTimeout(() => router.back(), 1000);
      } else {
        message.error(data.error || 'Failed to update convert');
      }
    } catch (error) {
      message.error('Failed to save changes');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '30px', textAlign: 'center' }}>
        <LoadingOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
        <p>Loading convert details...</p>
      </div>
    );
  }

  if (!convert) {
    return (
      <div style={{ padding: '30px' }}>
        <Card>
          <Title level={2}>Convert Not Found</Title>
          <Button onClick={() => router.back()} type="primary">
            <ArrowLeftOutlined /> Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px' }}>
      <Button
        onClick={() => router.back()}
        style={{ marginBottom: '20px' }}
      >
        <ArrowLeftOutlined /> Back
      </Button>

      <Card>
        <div style={{ marginBottom: '20px' }}>
          <Title level={2}>Edit Convert Details</Title>
          <Paragraph>
            <strong>Name:</strong> {convert.full_name}
          </Paragraph>
          <Paragraph>
            <strong>Group:</strong> <Tag color="blue">{convert.group_name}</Tag>
          </Paragraph>
          <Paragraph>
            <strong>Created:</strong> {new Date(convert.created_at).toLocaleDateString()}
            {' '}
            <strong>Updated:</strong> {new Date(convert.updated_at).toLocaleDateString()}
          </Paragraph>
        </div>

        <Divider />

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <Form.Item
              label="First Name"
              name="first_name"
              rules={[{ required: true, message: 'First name is required' }]}
            >
              <Input placeholder="First name" />
            </Form.Item>

            <Form.Item
              label="Last Name"
              name="last_name"
              rules={[{ required: true, message: 'Last name is required' }]}
            >
              <Input placeholder="Last name" />
            </Form.Item>

            <Form.Item
              label="Phone Number"
              name="phone_number"
              rules={[{ required: true, message: 'Phone number is required' }]}
            >
              <Input placeholder="Phone number" />
            </Form.Item>

            <Form.Item
              label="Date of Birth (DD-MM)"
              name="date_of_birth"
            >
              <Input placeholder="e.g., 15-03" />
            </Form.Item>

            <Form.Item
              label="Gender"
              name="gender"
            >
              <Select placeholder="Select gender">
                <Option value="Male">Male</Option>
                <Option value="Female">Female</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="Occupation Type"
              name="occupation_type"
            >
              <Select placeholder="Select occupation">
                <Option value="Worker">Worker</Option>
                <Option value="Student">Student</Option>
                <Option value="Unemployed">Unemployed</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="Residential Location"
              name="residential_location"
            >
              <Input placeholder="Residential location" />
            </Form.Item>

            <Form.Item
              label="School/Residential Location (if student)"
              name="school_residential_location"
            >
              <Input placeholder="School or residential location" />
            </Form.Item>

            <Form.Item
              label="Group"
              name="group_name"
              rules={[{ required: true, message: 'Group is required' }]}
            >
              <Input placeholder="Group name" disabled />
            </Form.Item>
          </div>

          <Divider />

          <Space style={{ marginTop: '20px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              icon={<SaveOutlined />}
            >
              Save Changes
            </Button>
            <Button onClick={() => router.back()}>
              Cancel
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
