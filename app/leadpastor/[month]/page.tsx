'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { Table, Button, Typography, Spin, Tooltip, Input } from 'antd';
import { SearchOutlined, LeftOutlined, TeamOutlined, BarChartOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { PROGRESS_STAGES, TOTAL_PROGRESS_STAGES } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

// Read-only milestone cell component (no toggle switch)
const ReadOnlyMilestoneCell = memo(({ 
  isCompleted, 
  stageName,
}: { 
  isCompleted: boolean; 
  stageName: string;
}) => {
  return (
    <Tooltip title={stageName}>
      <div
        style={{
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: isCompleted ? '#52c41a' : '#ff4d4f',
          border: '1px solid #d9d9d9',
          transition: 'all 0.3s',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '40px',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '12px',
          }}
        >
          {isCompleted ? '✓' : '✗'}
        </div>
      </div>
    </Tooltip>
  );
});

ReadOnlyMilestoneCell.displayName = 'ReadOnlyMilestoneCell';

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

export default function LeadPastorMonthDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const month = params?.month as string;
  const [people, setPeople] = useState<PersonWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'leadpastor')) {
      console.log('[LEAD-PASTOR-MONTH] Unauthorized access attempt, redirecting to home');
      router.push('/');
      return;
    }

    if (user && token && month) {
      fetchMonthPeople();
    }
  }, [user, token, authLoading, router, month]);

  const fetchMonthPeople = async () => {
    try {
      setLoading(true);
      
      // Capitalize first letter of month for API call
      const monthName = month.charAt(0).toUpperCase() + month.slice(1);
      
      const response = await fetch(`/api/people?month=${monthName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch people');

      const data = await response.json();

      // Fetch progress for each person
      const peopleWithProgress = await Promise.all(
        data.people.map(async (person: any) => {
          try {
            const progressResponse = await fetch(`/api/people/${person.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (progressResponse.ok) {
              const progressData = await progressResponse.json();
              return {
                ...person,
                progress: progressData.progress || [],
              };
            }
            return { ...person, progress: [] };
          } catch (error) {
            console.error(`Error fetching progress for ${person.id}:`, error);
            return { ...person, progress: [] };
          }
        })
      );

      setPeople(peopleWithProgress);
    } catch (error) {
      console.error('Error fetching people:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMilestoneStatus = useCallback((person: PersonWithProgress, stageNumber: number) => {
    const stage = person.progress.find(p => p.stage_number === stageNumber);
    return stage?.is_completed || false;
  }, []);

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
              <a href={`tel:${record.phone_number}`} style={{ color: '#888', textDecoration: 'none' }}>
                📞 {record.phone_number}
              </a>
            </div>
          </div>
        ),
      },
    ];

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
        return (
          <ReadOnlyMilestoneCell
            isCompleted={isCompleted}
            stageName={stage.name}
          />
        );
      },
    }));

    return [...baseColumns, ...milestoneColumns];
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  // Filter people based on search text
  const filteredPeople = people.filter(person => 
    person.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
    person.phone_number.includes(searchText) ||
    person.group_name.toLowerCase().includes(searchText.toLowerCase())
  );

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

  const currentYear = new Date().getFullYear();
  const monthName = month.charAt(0).toUpperCase() + month.slice(1);
  const displayTitle = `${monthName} ${currentYear}`;

  const columns = getColumns();

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
            <Button
              icon={<LeftOutlined />}
              onClick={() => router.push('/leadpastor')}
              style={{ marginBottom: 16 }}
            >
              Back to Months
            </Button>
            <Title level={2} style={{ marginBottom: 8 }}>{displayTitle} - View Only</Title>
            <Text type="secondary">
              Viewing {totalNewConverts} new converts across {TOTAL_PROGRESS_STAGES} milestones (Read-only access)
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              icon={<TeamOutlined />}
              onClick={() => router.push(`/leadpastor/${month}/attendance`)}
              size="large"
            >
              View Attendance
            </Button>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => router.push(`/leadpastor/${month}/progress`)}
              size="large"
            >
              View Progress Report
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: 24 }}>
          <Input
            placeholder="Search by name, phone number, or group..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            size="large"
            allowClear
            style={{ maxWidth: 500 }}
          />
          {searchText && (
            <Text type="secondary" style={{ marginLeft: 12 }}>
              Showing {filteredPeople.length} of {totalNewConverts} people
            </Text>
          )}
        </div>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          <div style={{
            padding: 20,
            background: 'linear-gradient(135deg, #0050b3 0%, #1890ff 100%)',
            borderRadius: 8,
            border: '1px solid #1890ff',
            boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)',
          }}>
            <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.85)' }}>Total New Converts</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {totalNewConverts}
            </div>
          </div>
          <div style={{
            padding: 20,
            background: 'linear-gradient(135deg, #d48806 0%, #faad14 100%)',
            borderRadius: 8,
            border: '1px solid #faad14',
            boxShadow: '0 2px 8px rgba(250, 173, 20, 0.2)',
          }}>
            <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.85)' }}>New Converts with Incomplete Milestones</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {newConvertsInArrears}
            </div>
          </div>
          <div style={{
            padding: 20,
            background: 'linear-gradient(135deg, #531dab 0%, #722ed1 100%)',
            borderRadius: 8,
            border: '1px solid #722ed1',
            boxShadow: '0 2px 8px rgba(114, 46, 209, 0.2)',
          }}>
            <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.85)' }}>Overall Progress</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
              {overallProgress}%
            </div>
          </div>
        </div>

        {/* Milestone Grid Table */}
        <Table
          columns={columns}
          dataSource={filteredPeople}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} people`,
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
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#52c41a',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '12px',
            }}>
              ✓ Completed
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#ff4d4f',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '12px',
            }}>
              ✗ Not Completed
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
