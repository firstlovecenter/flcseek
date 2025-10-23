'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag, Input, Space } from 'antd';
import { EyeOutlined, UserAddOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { usePeopleWithStats } from '@/hooks/use-fetch';

const { Title, Text } = Typography;
const { Search } = Input;

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

export default function SheepSeekerPeoplePage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [filteredPeople, setFilteredPeople] = useState<PersonWithStats[]>([]);
  const [searchText, setSearchText] = useState('');

  // Use optimized hook for fetching people with stats
  const { data, loading, error, refetch } = usePeopleWithStats(token);
  const people = data?.people || [];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (error) {
      message.error('Failed to load people');
    }
  }, [error]);

  useEffect(() => {
    filterPeople();
  }, [searchText, people]);

  const filterPeople = () => {
    if (!searchText) {
      setFilteredPeople(people);
      return;
    }

    const filtered = people.filter(
      (person: any) =>
        person.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
        person.phone_number.includes(searchText)
    );
    setFilteredPeople(filtered);
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
      render: (_: any, record: any) => (
        <div style={{ width: 150 }}>
          <Progress
            percent={record.progress_percentage || record.progressPercentage || 0}
            strokeColor="#52c41a"
            size="small"
          />
        </div>
      ),
    },
    {
      title: 'Attendance',
      key: 'attendance',
      render: (_: any, record: any) => (
        <div style={{ width: 130 }}>
          <Progress
            percent={record.attendance_percentage || record.attendancePercentage || 0}
            strokeColor="#1890ff"
            size="small"
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.attendance_count || record.attendanceCount || 0}/{ATTENDANCE_GOAL}
          </Text>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: PersonWithStats) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => router.push(`/person/${record.id}`)}
        >
          View
        </Button>
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
      {/* Top navigation header */}
      <div
        style={{
          margin: '8px 0 16px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Space wrap>
          <Button onClick={() => router.push('/sheep-seeker')}>Home</Button>
          <Button type="primary" onClick={() => router.push('/sheep-seeker/people')}>
            New Converts
          </Button>
          <Button onClick={() => router.push('/sheep-seeker/attendance')}>Attendance</Button>
          <Button onClick={() => router.push('/sheep-seeker/progress')}>Progress</Button>
        </Space>
        {user?.role === 'admin' && (
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => router.push('/sheep-seeker/people/register')}
          >
            Register New Person
          </Button>
        )}
      </div>
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
            <Title level={2} style={{ marginBottom: 8 }}>New Converts</Title>
            <Text type="secondary">
              View and track new converts you're following up with
            </Text>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder="Search by name or phone"
            allowClear
            prefix={<SearchOutlined />}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '100%', maxWidth: 300 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredPeople}
          rowKey="id"
          size="small"
          scroll={{ x: 700 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Total ${total} people` }}
          style={{ background: 'white', borderRadius: 8 }}
        />
      </div>
    </>
  );
}
