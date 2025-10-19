'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Typography,
  Spin,
  message,
  Progress,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
} from 'antd';
import {
  UserAddOutlined,
  EyeOutlined,
  PlusOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import dayjs from 'dayjs';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

interface Person {
  id: string;
  full_name: string;
  phone_number: string;
  gender?: string;
  group_name: string;
  created_at: string;
}

interface PersonWithStats extends Person {
  progressPercentage: number;
  attendanceCount: number;
  attendancePercentage: number;
}

export default function SheepSeekerDashboard() {
  const { user, token, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [people, setPeople] = useState<PersonWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [attendanceForm] = Form.useForm();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'sheep_seeker')) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchPeople();
    }
  }, [user, token, authLoading, router]);

  const fetchPeople = async () => {
    try {
      const response = await fetch('/api/people', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch people');

      const data = await response.json();

      const peopleWithStats = await Promise.all(
        data.people.map(async (person: Person) => {
          const detailsRes = await fetch(`/api/people/${person.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const details = await detailsRes.json();

          const completedStages =
            details.progress?.filter((p: any) => p.is_completed).length || 0;
          const progressPercentage = Math.round((completedStages / 15) * 100);

          const attendanceCount = details.attendanceCount || 0;
          const attendancePercentage = Math.min(
            Math.round((attendanceCount / ATTENDANCE_GOAL) * 100),
            100
          );

          return {
            ...person,
            progressPercentage,
            attendanceCount,
            attendancePercentage,
          };
        })
      );

      setPeople(peopleWithStats);
    } catch (error: any) {
      message.error(error.message || 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    try {
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          group_name: user?.group_name,
        }),
      });

      if (!response.ok) throw new Error('Failed to register person');

      message.success('Person registered successfully!');
      form.resetFields();
      setRegisterModalVisible(false);
      fetchPeople();
    } catch (error: any) {
      message.error(error.message || 'Registration failed');
    }
  };

  const handleAddAttendance = async (values: any) => {
    try {
      const response = await fetch(`/api/attendance/${selectedPersonId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date_attended: values.date_attended.format('YYYY-MM-DD'),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add attendance');
      }

      message.success('Attendance recorded successfully!');
      attendanceForm.resetFields();
      setAttendanceModalVisible(false);
      fetchPeople();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text: string, record: PersonWithStats) => (
        <Button
          type="link"
          onClick={() => router.push(`/person/${record.id}`)}
          style={{ padding: 0 }}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone_number',
      key: 'phone_number',
      render: (phone: string) => (
        <a href={`tel:${phone}`} style={{ color: '#1890ff' }}>
          {phone}
        </a>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: PersonWithStats) => (
        <div style={{ width: 150 }}>
          <Progress
            percent={record.progressPercentage}
            strokeColor="#003366"
            size="small"
          />
        </div>
      ),
    },
    {
      title: 'Attendance',
      key: 'attendance',
      render: (_: any, record: PersonWithStats) => (
        <div style={{ width: 150 }}>
          <Progress
            percent={record.attendancePercentage}
            strokeColor="#00b300"
            size="small"
            format={() => `${record.attendanceCount}/${ATTENDANCE_GOAL}`}
          />
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: PersonWithStats) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedPersonId(record.id);
              setAttendanceModalVisible(true);
            }}
          >
            Add Attendance
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/person/${record.id}`)}
          >
            View
          </Button>
        </div>
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
        <div style={{ 
          marginBottom: 24, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div style={{ flex: '1 1 auto', minWidth: '200px' }}>
            <Title level={2} style={{ marginBottom: 8 }}>My Group: {user?.group_name}</Title>
            <Text type="secondary">
              Manage and track people in your group
            </Text>
          </div>
          <div style={{ 
            display: 'flex', 
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <Button
              type="default"
              icon={<UsergroupAddOutlined />}
              onClick={() => router.push('/sheep-seeker/people/bulk-register')}
              size="large"
            >
              Bulk Register
            </Button>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setRegisterModalVisible(true)}
              size="large"
            >
              Register New Person
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={people}
          rowKey="id"
          size="small"
          scroll={{ x: 800 }}
          pagination={{ pageSize: 10 }}
          style={{ background: 'white', borderRadius: 8 }}
        />
      </div>

      <Modal
        title="Register New Person"
        open={registerModalVisible}
        onCancel={() => {
          setRegisterModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={form} onFinish={handleRegister} layout="vertical">
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder="Enter full name" />
          </Form.Item>

          <Form.Item
            name="phone_number"
            label="Phone Number"
            rules={[{ required: true, message: 'Please enter phone number' }]}
          >
            <Input placeholder="Enter phone number" />
          </Form.Item>

          <Form.Item name="gender" label="Gender">
            <Select placeholder="Select gender">
              <Select.Option value="Male">Male</Select.Option>
              <Select.Option value="Female">Female</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Register Person
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add Attendance"
        open={attendanceModalVisible}
        onCancel={() => {
          setAttendanceModalVisible(false);
          attendanceForm.resetFields();
        }}
        footer={null}
      >
        <Form form={attendanceForm} onFinish={handleAddAttendance} layout="vertical">
          <Form.Item
            name="date_attended"
            label="Attendance Date"
            rules={[{ required: true, message: 'Please select date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Record Attendance
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <style jsx>{`
        @media (max-width: 767px) {
          :global(.ant-btn-lg) {
            padding: 8px 12px !important;
            font-size: 14px !important;
            height: auto !important;
          }
          :global(.ant-table-small) {
            font-size: 12px !important;
          }
        }
      `}</style>
    </>
  );
}
