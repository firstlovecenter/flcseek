'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  Typography,
  Spin,
  message,
  Progress,
  Button,
} from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import dayjs from 'dayjs';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

interface Person {
  id: string;
  full_name: string;
  phone_number: string;
  department_name: string;
  created_at: string;
}

interface PersonWithStats extends Person {
  progressPercentage: number;
  attendanceCount: number;
  attendancePercentage: number;
  lastUpdated: string;
}

export default function DepartmentDetailPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [people, setPeople] = useState<PersonWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'super_admin')) {
      router.push('/');
      return;
    }

    if (user && token && params.month) {
      fetchDepartmentPeople();
    }
  }, [user, token, authLoading, params.month, router]);

  const fetchDepartmentPeople = async () => {
    try {
      const response = await fetch(`/api/people?department=${params.month}`, {
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

          const lastUpdated =
            details.progress
              ?.filter((p: any) => p.is_completed)
              .sort(
                (a: any, b: any) =>
                  new Date(b.last_updated).getTime() -
                  new Date(a.last_updated).getTime()
              )[0]?.last_updated || person.created_at;

          return {
            ...person,
            progressPercentage,
            attendanceCount,
            attendancePercentage,
            lastUpdated,
          };
        })
      );

      setPeople(peopleWithStats);
    } catch (error: any) {
      message.error(error.message || 'Failed to load department data');
    } finally {
      setLoading(false);
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
        <div style={{ width: 200 }}>
          <Progress
            percent={record.progressPercentage}
            strokeColor="#003366"
            size="small"
          />
        </div>
      ),
      sorter: (a: PersonWithStats, b: PersonWithStats) =>
        a.progressPercentage - b.progressPercentage,
    },
    {
      title: 'Attendance',
      key: 'attendance',
      render: (_: any, record: PersonWithStats) => (
        <div style={{ width: 200 }}>
          <Progress
            percent={record.attendancePercentage}
            strokeColor="#00b300"
            size="small"
            format={() => `${record.attendanceCount}/${ATTENDANCE_GOAL}`}
          />
        </div>
      ),
      sorter: (a: PersonWithStats, b: PersonWithStats) =>
        a.attendancePercentage - b.attendancePercentage,
    },
    {
      title: 'Last Updated',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
      sorter: (a: PersonWithStats, b: PersonWithStats) =>
        new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime(),
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
          View Details
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
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>{params.month} Department</Title>
          <Text type="secondary">
            Total members: {people.length}
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={people}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          style={{ background: 'white', borderRadius: 8 }}
        />
      </div>
    </>
  );
}
