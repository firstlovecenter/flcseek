'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag, Input, Select } from 'antd';
import { EyeOutlined, UserAddOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ATTENDANCE_GOAL, DEPARTMENTS } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;
const { Search } = Input;

interface Person {
  id: string;
  full_name: string;
  phone_number: string;
  gender?: string;
  department_name: string;
  created_at: string;
}

interface PersonWithStats extends Person {
  progressPercentage: number;
  attendanceCount: number;
  attendancePercentage: number;
}

export default function AllPeoplePage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [people, setPeople] = useState<PersonWithStats[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<PersonWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'super_admin')) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchPeople();
    }
  }, [user, token, authLoading, router]);

  useEffect(() => {
    filterPeople();
  }, [searchText, selectedDepartment, people]);

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
      setFilteredPeople(peopleWithStats);
    } catch (error: any) {
      message.error(error.message || 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  const filterPeople = () => {
    let filtered = [...people];

    if (searchText) {
      filtered = filtered.filter(
        (person) =>
          person.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
          person.phone_number.includes(searchText)
      );
    }

    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(
        (person) => person.department_name === selectedDepartment
      );
    }

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
      title: 'Department',
      dataIndex: 'department_name',
      key: 'department_name',
      render: (dept: string) => <Tag color="blue">{dept}</Tag>,
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: PersonWithStats) => (
        <div style={{ width: 150 }}>
          <Progress
            percent={record.progressPercentage}
            strokeColor="#52c41a"
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
            strokeColor="#1890ff"
            size="small"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.attendanceCount}/{ATTENDANCE_GOAL}
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
      <div>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>All People</Title>
            <Text type="secondary">
              Manage all registered people across all departments
            </Text>
          </div>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => router.push('/super-admin/people/register')}
            size="large"
          >
            Register New Person
          </Button>
        </div>

        <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
          <Search
            placeholder="Search by name or phone"
            allowClear
            prefix={<SearchOutlined />}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            value={selectedDepartment}
            onChange={setSelectedDepartment}
            style={{ width: 200 }}
          >
            <Select.Option value="all">All Departments</Select.Option>
            {DEPARTMENTS.map((dept) => (
              <Select.Option key={dept} value={dept}>
                {dept}
              </Select.Option>
            ))}
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={filteredPeople}
          rowKey="id"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Total ${total} people` }}
          style={{ background: 'white', borderRadius: 8 }}
        />
      </div>
    </>
  );
}
