'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';

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
      
      const response = await fetch(`/api/people?month=${monthName}`, {
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

  const monthName = month.charAt(0).toUpperCase() + month.slice(1);
  const averageAttendance = people.length > 0
    ? Math.round(people.reduce((sum, p) => sum + p.attendanceCount, 0) / people.length)
    : 0;
  const averagePercentage = people.length > 0
    ? Math.round(people.reduce((sum, p) => sum + p.percentage, 0) / people.length)
    : 0;
  const onTrack = people.filter(p => p.percentage >= 50).length;
  const needsAttention = people.filter(p => p.percentage < 50).length;

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200,
      sorter: (a: PersonAttendance, b: PersonAttendance) =>
        a.full_name.localeCompare(b.full_name),
      render: (text: string, record: PersonAttendance) => (
        <div>
          <Button
            type="link"
            onClick={() => router.push(`/person/${record.id}`)}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text strong style={{ color: '#1890ff' }}>{text}</Text>
          </Button>
          <div style={{ fontSize: 12, color: '#888' }}>
            <a href={`tel:${record.phone_number}`} style={{ color: '#888', textDecoration: 'none' }}>
              📞 {record.phone_number}
            </a>
          </div>
        </div>
      ),
    },
    {
      title: 'Attendance Count',
      dataIndex: 'attendanceCount',
      key: 'attendanceCount',
      align: 'center' as const,
      sorter: (a: PersonAttendance, b: PersonAttendance) =>
        a.attendanceCount - b.attendanceCount,
      render: (count: number) => (
        <Tag color={count >= ATTENDANCE_GOAL ? 'green' : count >= ATTENDANCE_GOAL / 2 ? 'orange' : 'red'}>
          {count} / {ATTENDANCE_GOAL}
        </Tag>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      align: 'center' as const,
      width: 200,
      render: (_: any, record: PersonAttendance) => (
        <Progress
          percent={record.percentage}
          status={record.percentage >= 100 ? 'success' : record.percentage >= 50 ? 'active' : 'exception'}
          strokeColor={
            record.percentage >= 100
              ? '#52c41a'
              : record.percentage >= 50
              ? '#1890ff'
              : '#ff4d4f'
          }
        />
      ),
    },
    {
      title: 'Status',
      key: 'status',
      align: 'center' as const,
      filters: [
        { text: 'On Track', value: 'on-track' },
        { text: 'Needs Attention', value: 'needs-attention' },
        { text: 'Completed', value: 'completed' },
      ],
      onFilter: (value: any, record: PersonAttendance) => {
        if (value === 'completed') return record.percentage >= 100;
        if (value === 'on-track') return record.percentage >= 50 && record.percentage < 100;
        if (value === 'needs-attention') return record.percentage < 50;
        return true;
      },
      render: (_: any, record: PersonAttendance) => {
        if (record.percentage >= 100) {
          return <Tag color="success">Completed</Tag>;
        } else if (record.percentage >= 50) {
          return <Tag color="processing">On Track</Tag>;
        } else {
          return <Tag color="error">Needs Attention</Tag>;
        }
      },
    },
  ];

  return (
    <>
      <AppBreadcrumb />
      <div style={{ padding: '0 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <Button
            icon={<LeftOutlined />}
            onClick={() => router.push(`/leadpastor/${month}`)}
            style={{ marginBottom: 16 }}
          >
            Back to {monthName} Dashboard
          </Button>
          <Title level={2}>{monthName} Attendance Tracking (View Only)</Title>
          <Text type="secondary">
            Target: {ATTENDANCE_GOAL} church services per person
          </Text>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #0050b3 0%, #1890ff 100%)',
              borderRadius: 8,
              border: '1px solid #1890ff',
              boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)',
            }}
          >
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Average Attendance</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {averageAttendance}
            </div>
            <Progress percent={averagePercentage} showInfo={false} strokeColor="#fff" trailColor="rgba(255,255,255,0.3)" />
          </div>
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #389e0d 0%, #52c41a 100%)',
              borderRadius: 8,
              border: '1px solid #52c41a',
              boxShadow: '0 2px 8px rgba(82, 196, 26, 0.2)',
            }}
          >
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>On Track</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {onTrack}
            </div>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>≥50% attendance</Text>
          </div>
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #cf1322 0%, #ff4d4f 100%)',
              borderRadius: 8,
              border: '1px solid #ff4d4f',
              boxShadow: '0 2px 8px rgba(255, 77, 79, 0.2)',
            }}
          >
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Needs Attention</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {needsAttention}
            </div>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>&lt;50% attendance</Text>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={people}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `Total ${total} people`,
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
