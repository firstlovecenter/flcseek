'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag, Space } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { ATTENDANCE_GOAL } from '@/lib/constants';

const { Title, Text } = Typography;

interface PersonAttendance {
  id: string;
  full_name: string;
  group_name: string;
  phone_number: string;
  attendanceCount: number;
  percentage: number;
}

export default function LeadPastorAttendancePage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const month = params?.month as string;
  const [people, setPeople] = useState<PersonAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'leadpastor')) {
      router.push('/');
      return;
    }

    if (user && token && month) {
      fetchPeople();
    }
  }, [user, token, authLoading, router, month]);

  const fetchPeople = async () => {
    try {
      const monthName = month.charAt(0).toUpperCase() + month.slice(1);
      const currentYear = new Date().getFullYear();
      
      const response = await fetch(`/api/people?month=${monthName}&year=${currentYear}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch people');

      const data = await response.json();

      const peopleWithAttendance = await Promise.all(
        data.people.map(async (person: any) => {
          const detailsRes = await fetch(`/api/people/${person.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const details = await detailsRes.json();
          const attendanceCount = details.attendanceCount || 0;

          return {
            id: person.id,
            full_name: person.full_name,
            group_name: person.group_name,
            phone_number: person.phone_number,
            attendanceCount,
            percentage: Math.min(Math.round((attendanceCount / ATTENDANCE_GOAL) * 100), 100),
          };
        })
      );

      setPeople(peopleWithAttendance);
    } catch (error: any) {
      message.error(error.message || 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200,
      fixed: 'left' as const,
      render: (text: string, record: PersonAttendance) => (
        <div>
          <Button
            type="link"
            onClick={() => router.push(`/person/${record.id}`)}
            style={{ padding: 0, fontWeight: 500 }}
          >
            {text}
          </Button>
          <div style={{ fontSize: 12, color: '#888' }}>
            <a href={`tel:${record.phone_number}`} style={{ color: '#888' }}>
              📞 {record.phone_number}
            </a>
          </div>
        </div>
      ),
    },
    {
      title: 'Attendance Progress',
      key: 'attendance',
      render: (_: any, record: PersonAttendance) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Progress
              percent={record.percentage}
              strokeColor={record.attendanceCount >= 10 ? '#52c41a' : '#ff4d4f'}
              size="small"
              format={(percent) => `${record.attendanceCount}/${ATTENDANCE_GOAL}`}
            />
          </div>
          <Tag color={record.attendanceCount >= 10 ? 'success' : 'error'}>
            {record.percentage}%
          </Tag>
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
      <div style={{ padding: '0 24px' }}>
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
          <div></div>
          <Space wrap>
            <Button onClick={() => router.push(`/leadpastor/${month}`)}>
              Milestones
            </Button>
            <Button type="primary" onClick={() => router.push(`/leadpastor/${month}/attendance`)}>
              Attendance
            </Button>
          </Space>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
            Attendance Tracking
          </Title>
          <Text type="secondary">
            View attendance records for all new converts (Goal: {ATTENDANCE_GOAL} Sundays) - Read-only access
          </Text>
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>

        <Table
          columns={columns}
          dataSource={people}
          rowKey="id"
          size="middle"
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} new converts`
          }}
          style={{
            background: 'white',
            borderRadius: 8,
          }}
        />
      </div>
    </>
  );
}
