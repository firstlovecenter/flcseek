'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag, Space } from 'antd';
import { LeftOutlined, HomeOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

interface PersonProgress {
  id: string;
  full_name: string;
  group_name: string;
  phone_number: string;
  completedStages: number;
  percentage: number;
}

export default function LeadPastorProgressPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const month = params?.month as string;
  const [people, setPeople] = useState<PersonProgress[]>([]);
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

      const peopleWithProgress = await Promise.all(
        data.people.map(async (person: any) => {
          const detailsRes = await fetch(`/api/people/${person.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const details = await detailsRes.json();
          const completedStages = details.progress?.filter((p: any) => p.is_completed).length || 0;

          return {
            id: person.id,
            full_name: person.full_name,
            group_name: person.group_name,
            phone_number: person.phone_number,
            completedStages,
            percentage: Math.round((completedStages / 18) * 100),
          };
        })
      );

      setPeople(peopleWithProgress);
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
  const averageProgress = people.length > 0
    ? Math.round(people.reduce((sum, p) => sum + p.percentage, 0) / people.length)
    : 0;
  const completed = people.filter(p => p.percentage === 100).length;
  const inProgress = people.filter(p => p.percentage > 0 && p.percentage < 100).length;
  const notStarted = people.filter(p => p.percentage === 0).length;

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200,
      sorter: (a: PersonProgress, b: PersonProgress) =>
        a.full_name.localeCompare(b.full_name),
      render: (text: string, record: PersonProgress) => (
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
      title: 'Completed',
      dataIndex: 'completedStages',
      key: 'completedStages',
      width: 100,
      align: 'center' as const,
      sorter: (a: PersonProgress, b: PersonProgress) =>
        a.completedStages - b.completedStages,
      render: (stages: number) => (
        <Tag color={stages === 18 ? 'green' : stages >= 9 ? 'orange' : 'red'}>
          {stages} / 18
        </Tag>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      align: 'center' as const,
      sorter: (a: PersonProgress, b: PersonProgress) => a.percentage - b.percentage,
      render: (_: any, record: PersonProgress) => (
        <Progress
          percent={record.percentage}
          status={record.percentage === 100 ? 'success' : record.percentage > 0 ? 'active' : 'exception'}
          strokeColor={
            record.percentage === 100
              ? '#52c41a'
              : record.percentage >= 50
              ? '#1890ff'
              : '#ff4d4f'
          }
        />
      ),
    },
  ];

  return (
    <>
      <AppBreadcrumb />
      <div style={{ padding: '0 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={2} style={{ margin: 0 }}>{monthName} Progress Report</Title>
            <Space>
              <Button
                icon={<LeftOutlined />}
                onClick={() => router.push(`/leadpastor/${month}`)}
              >
                Back to {monthName}
              </Button>
              <Button
                icon={<HomeOutlined />}
                onClick={() => router.push('/leadpastor')}
              >
                Home
              </Button>
              <Button
                icon={<CheckOutlined />}
                onClick={() => router.push(`/leadpastor/${month}/attendance`)}
              >
                Attendance
              </Button>
            </Space>
          </div>
          <Text type="secondary">
            Track milestone completion for all new converts - Read-only access
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
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Average Progress</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {averageProgress}%
            </div>
            <Progress percent={averageProgress} showInfo={false} strokeColor="#fff" trailColor="rgba(255,255,255,0.3)" />
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
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Completed</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {completed}
            </div>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>100% milestones</Text>
          </div>
          <div
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, #d48806 0%, #faad14 100%)',
              borderRadius: 8,
              border: '1px solid #faad14',
              boxShadow: '0 2px 8px rgba(250, 173, 20, 0.2)',
            }}
          >
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>In Progress</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {inProgress}
            </div>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Partially complete</Text>
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
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Not Started</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {notStarted}
            </div>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>0% milestones</Text>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={people}
          rowKey="id"
          size="small"
          scroll={{ x: 600 }}
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
