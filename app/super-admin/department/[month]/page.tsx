'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { Table, Button, Typography, Spin, message, Tooltip, Switch } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { PROGRESS_STAGES, TOTAL_PROGRESS_STAGES } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

// Memoized milestone cell component to optimize rendering
const MilestoneCell = memo(({ 
  isCompleted, 
  isUpdating, 
  onToggle, 
  stageName,
  isAuto = false
}: { 
  isCompleted: boolean; 
  isUpdating: boolean; 
  onToggle: () => void;
  stageName: string;
  isAuto?: boolean;
}) => {
  return (
    <Tooltip title={isAuto ? `${stageName} (Auto-calculated)` : stageName}>
      <div
        style={{
          padding: '8px',
          borderRadius: '8px',
          backgroundColor: 'white',
          border: '1px solid #d9d9d9',
          transition: 'all 0.3s',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Switch
          checked={isCompleted}
          onChange={onToggle}
          loading={isUpdating}
          size="small"
          disabled={isAuto}
          style={{
            backgroundColor: isCompleted ? '#52c41a' : '#ff4d4f',
          }}
        />
      </div>
    </Tooltip>
  );
});

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

export default function GroupDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupName = params.month as string;
  const [people, setPeople] = useState<PersonWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'superadmin')) {
      router.push('/');
      return;
    }

    if (user && token && groupName) {
      fetchGroupPeople();
    }
  }, [user, token, authLoading, groupName, router]);

  const fetchGroupPeople = async () => {
    try {
      const response = await fetch(`/api/people?department=${groupName}`, {
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

  // Optimized toggle function with useCallback
  const toggleMilestone = useCallback(async (personId: string, stageNumber: number, currentStatus: boolean) => {
    // Prevent toggling milestone 18 (auto-calculated from attendance)
    if (stageNumber === 18) {
      message.warning('Attendance milestone is auto-calculated from attendance records');
      return;
    }

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

      message.success('Milestone updated!');
    } catch (error: any) {
      message.error(error.message || 'Failed to update milestone');
    } finally {
      setUpdating(null);
    }
  }, [token]);

  const getMilestoneStatus = useCallback((person: PersonWithProgress, stageNumber: number) => {
    const stage = person.progress.find(p => p.stage_number === stageNumber);
    return stage?.is_completed || false;
  }, []);

  // Generate columns efficiently
  const getColumns = () => {
    const baseColumns: any[] = [
      {
        title: 'Name',
        dataIndex: 'full_name',
        key: 'full_name',
        fixed: 'left',
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
              {record.phone_number}
            </div>
          </div>
        ),
      },
    ];

    // Create milestone columns efficiently
    const milestoneColumns = PROGRESS_STAGES.map((stage) => ({
      title: (
        <Tooltip title={stage.name}>
          <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
            <div style={{ fontSize: '11px', whiteSpace: 'pre-line', marginBottom: '4px' }}>
              {stage.shortName}
            </div>
            <div style={{ fontSize: '12px' }}>
              [M{stage.number.toString().padStart(2, '0')}]
            </div>
          </div>
        </Tooltip>
      ),
      key: `milestone_${stage.number}`,
      width: 80,
      align: 'center' as const,
      render: (_: any, record: PersonWithProgress) => {
        const isCompleted = getMilestoneStatus(record, stage.number);
        const isUpdating = updating === `${record.id}-${stage.number}`;
        const isAuto = stage.number === 18; // Milestone 18 is auto-calculated
        
        return (
          <MilestoneCell
            isCompleted={isCompleted}
            isUpdating={isUpdating}
            onToggle={() => toggleMilestone(record.id, stage.number, isCompleted)}
            stageName={stage.name}
            isAuto={isAuto}
          />
        );
      },
    }));

    return [...baseColumns, ...milestoneColumns];
  };

  const columns = getColumns();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const totalNewConverts = people.length;
  const newConvertsWithCompletedMilestones = people.filter(
    person => person.progress.filter(p => p.is_completed).length === TOTAL_PROGRESS_STAGES
  ).length;
  const newConvertsInArrears = people.filter(
    person => person.progress.filter(p => p.is_completed).length < TOTAL_PROGRESS_STAGES
  ).length;
  const totalMilestones = totalNewConverts * TOTAL_PROGRESS_STAGES;
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
        <div style={{ 
          marginBottom: 24, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div style={{ flex: '1 1 auto', minWidth: '200px' }}>
            <Title level={2} style={{ marginBottom: 8 }}>{groupName} Group Dashboard</Title>
            <Text type="secondary">
              Track all {totalNewConverts} new converts across {TOTAL_PROGRESS_STAGES} milestones - Toggle switches to update completion status
            </Text>
          </div>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/super-admin')}
            size="large"
          >
            Back to Overview
          </Button>
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
            <Text type="secondary">Total New Converts</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
              {totalNewConverts}
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #d9d9d9'
          }}>
            <Text type="secondary">New Converts with Incomplete Milestones</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
              {newConvertsInArrears}
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #d9d9d9'
          }}>
            <Text type="secondary">New Converts with Completed Milestones</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>
              {newConvertsWithCompletedMilestones}
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
            pageSizeOptions: ['20', '50', '100'],
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
          border: '1px solid #d9d9d9',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <Text strong>Legend: </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: 'white',
              border: '1px solid #d9d9d9'
            }}>
              <Switch checked disabled size="small" style={{ backgroundColor: '#52c41a' }} />
            </div>
            <Text>Completed (Green Switch)</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: 'white',
              border: '1px solid #d9d9d9'
            }}>
              <Switch checked={false} disabled size="small" style={{ backgroundColor: '#ff4d4f' }} />
            </div>
            <Text>Not Completed (Red Switch)</Text>
          </div>
          <Text type="secondary">
            Click any toggle switch to change milestone status. Hover over milestone numbers to see descriptions.
          </Text>
        </div>
      </div>
    </>
  );
}
