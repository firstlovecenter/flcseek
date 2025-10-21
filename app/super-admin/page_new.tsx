'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Tag, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PROGRESS_STAGES, TOTAL_PROGRESS_STAGES } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

interface PersonWithProgress {
  id: string;
  full_name: string;
  group_name: string;
  phone_number: string;
  progress: Array<{
    stage_number: number;
    is_completed: boolean;
  }>;
}

export default function SuperAdminDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [people, setPeople] = useState<PersonWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'superadmin')) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchAllPeople();
    }
  }, [user, token, authLoading, router]);

  const fetchAllPeople = async () => {
    try {
      const response = await fetch('/api/people', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch people');

      const data = await response.json();

      // Fetch progress for each person
      const peopleWithProgress = await Promise.all(
        data.people.map(async (person: any) => {
          const detailsRes = await fetch(`/api/people/${person.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const details = await detailsRes.json();

          return {
            id: person.id,
            full_name: person.full_name,
            group_name: person.group_name,
            phone_number: person.phone_number,
            progress: details.progress || [],
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

  const toggleMilestone = async (personId: string, stageNumber: number, currentStatus: boolean) => {
    setUpdating(`${personId}-${stageNumber}`);
    try {
      const response = await fetch(`/api/progress/${personId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage_number: stageNumber,
          is_completed: !currentStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to update milestone');

      // Update local state
      setPeople(prevPeople =>
        prevPeople.map(person => {
          if (person.id === personId) {
            return {
              ...person,
              progress: person.progress.map(p =>
                p.stage_number === stageNumber
                  ? { ...p, is_completed: !currentStatus }
                  : p
              ),
            };
          }
          return person;
        })
      );

      message.success('Milestone updated successfully!');
    } catch (error: any) {
      message.error(error.message || 'Failed to update milestone');
    } finally {
      setUpdating(null);
    }
  };

  const getMilestoneStatus = (person: PersonWithProgress, stageNumber: number) => {
    const stage = person.progress.find(p => p.stage_number === stageNumber);
    return stage?.is_completed || false;
  };

  // Generate columns for name, group, and 18 milestones
  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      fixed: 'left' as const,
      width: 180,
      render: (text: string, record: PersonWithProgress) => (
        <div>
          <Button
            type="link"
            onClick={() => router.push(`/person/${record.id}`)}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
          </Button>
          <div style={{ fontSize: 12, color: '#888' }}>
            {record.group_name}
          </div>
        </div>
      ),
    },
    // Generate 18 milestone columns
    ...Array.from({ length: TOTAL_PROGRESS_STAGES }, (_, index) => {
      const stageNumber = index + 1;
      const stage = PROGRESS_STAGES[index];
      
      return {
        title: (
          <Tooltip title={stage?.name || `Milestone ${stageNumber}`}>
            <div style={{ textAlign: 'center' }}>{stageNumber}</div>
          </Tooltip>
        ),
        key: `milestone_${stageNumber}`,
        width: 60,
        align: 'center' as const,
        render: (_: any, record: PersonWithProgress) => {
          const isCompleted = getMilestoneStatus(record, stageNumber);
          const isUpdating = updating === `${record.id}-${stageNumber}`;
          
          return (
            <Tooltip title={`${stage?.name || `Milestone ${stageNumber}`} - Click to toggle`}>
              <Button
                size="small"
                icon={isCompleted ? <CheckOutlined /> : <CloseOutlined />}
                loading={isUpdating}
                onClick={() => toggleMilestone(record.id, stageNumber, isCompleted)}
                style={{
                  backgroundColor: isCompleted ? '#52c41a' : '#ff4d4f',
                  borderColor: isCompleted ? '#52c41a' : '#ff4d4f',
                  color: 'white',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          );
        },
      };
    }),
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      width: 100,
      render: (_: any, record: PersonWithProgress) => {
        const completedCount = record.progress.filter(p => p.is_completed).length;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <Tag color={completedCount === TOTAL_PROGRESS_STAGES ? 'success' : 'processing'}>
              {completedCount}/{TOTAL_PROGRESS_STAGES}
            </Tag>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/person/${record.id}`)}
            >
              View
            </Button>
          </div>
        );
      },
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const totalMembers = people.length;
  const totalMilestones = totalMembers * TOTAL_PROGRESS_STAGES;
  const completedMilestones = people.reduce(
    (sum, person) => sum + person.progress.filter(p => p.is_completed).length,
    0
  );
  const overallProgress = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;

  return (
    <>
      <AppBreadcrumb />
      <div style={{ padding: '0 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>Member Progress Dashboard</Title>
          <Text type="secondary">
            Track all {totalMembers} members across {TOTAL_PROGRESS_STAGES} milestones - Click buttons to toggle completion status
          </Text>
        </div>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          <div style={{
            background: 'white',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #d9d9d9'
          }}>
            <Text type="secondary">Total Members</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
              {totalMembers}
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #d9d9d9'
          }}>
            <Text type="secondary">Total Milestones</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>
              {totalMilestones}
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #d9d9d9'
          }}>
            <Text type="secondary">Completed</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
              {completedMilestones}
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #d9d9d9'
          }}>
            <Text type="secondary">Overall Progress</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#13c2c2' }}>
              {overallProgress}%
            </div>
          </div>
        </div>

        {/* Milestone Grid Table */}
        <Table
          columns={columns}
          dataSource={people}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} members`,
          }}
          style={{
            background: 'white',
            borderRadius: 8,
          }}
        />

        {/* Legend */}
        <div style={{
          marginTop: 16,
          padding: 16,
          background: 'white',
          borderRadius: 8,
          border: '1px solid #d9d9d9'
        }}>
          <Text strong>Legend: </Text>
          <Tag color="success" icon={<CheckOutlined />}>Completed</Tag>
          <Tag color="error" icon={<CloseOutlined />}>Not Completed</Tag>
          <Text type="secondary" style={{ marginLeft: 16 }}>
            Click any button to toggle milestone status. Hover over milestone numbers to see descriptions.
          </Text>
        </div>
      </div>
    </>
  );
}
