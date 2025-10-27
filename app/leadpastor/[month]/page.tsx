'use client';

import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { Table, Button, Typography, Spin, Tooltip, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useThemeStyles } from '@/lib/theme-utils';

const { Text } = Typography;

// Read-only milestone cell component (no toggle switch)
const ReadOnlyMilestoneCell = memo(({ 
  isCompleted, 
  stageName,
}: { 
  isCompleted: boolean; 
  stageName: string;
}) => {
  const themeStyles = useThemeStyles();
  
  return (
    <Tooltip title={stageName}>
      <div
        style={{
          padding: '4px',
          borderRadius: '4px',
          backgroundColor: isCompleted ? themeStyles.success : themeStyles.error,
          border: `1px solid ${themeStyles.border}`,
          transition: 'all 0.3s',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '10px',
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
  const searchParams = useSearchParams();
  const month = params?.month as string;
  const year = searchParams.get('year') || new Date().getFullYear().toString();
  const [people, setPeople] = useState<PersonWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [milestones, setMilestones] = useState<Array<{ number: number; name: string; shortName: string }>>([]);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'leadpastor' && user.role !== 'superadmin'))) {
      console.log('[LEAD-PASTOR-MONTH] Unauthorized access attempt, redirecting to home');
      router.push('/');
      return;
    }

    if (user && token && month) {
      fetchMilestones();
      fetchMonthPeople();
    }
  }, [user, token, authLoading, router, month, year]);

  const fetchMilestones = async () => {
    try {
      const response = await fetch('/api/milestones', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched milestones from API:', data.milestones);
        const formattedMilestones = data.milestones.map((m: any) => {
          let shortName = m.short_name || m.stage_name.substring(0, 10);
          // Ensure shortName has a line break if it doesn't already and has multiple words
          if (!shortName.includes('\n')) {
            // Split at space, comma, or slash to identify words
            const words = shortName.split(/[\s,\/]+/).filter((w: string) => w.length > 0);
            if (words.length > 1) {
              // Multiple words - insert line break at roughly middle point
              const midPoint = Math.ceil(words.length / 2);
              shortName = words.slice(0, midPoint).join(' ') + '\n' + words.slice(midPoint).join(' ');
            }
            // Single word - leave as is (no line break)
          }
          return {
            number: m.stage_number,
            name: m.stage_name,
            shortName: shortName,
          };
        });
        console.log('Formatted milestones:', formattedMilestones);
        setMilestones(formattedMilestones);
      } else {
        console.warn('Failed to fetch milestones, using empty array');
        setMilestones([]);
      }
    } catch (error) {
      console.error('Error fetching milestones:', error);
      setMilestones([]);
    }
  };

  const fetchMonthPeople = async () => {
    try {
      setLoading(true);
      
      // Capitalize first letter of month for API call
      const monthName = month.charAt(0).toUpperCase() + month.slice(1);
      
      // OPTIMIZED: Use single API call that returns people with progress
      const response = await fetch(`/api/people/with-progress?month=${monthName}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch people');

      const data = await response.json();

      // Sort alphabetically by full_name
      const sortedPeople = (data.people || []).sort((a: any, b: any) => 
        (a.full_name || '').localeCompare(b.full_name || '')
      );

      setPeople(sortedPeople);
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

  const columns = useMemo(() => {
    const baseColumns: any[] = [
      {
        title: 'Name',
        dataIndex: 'full_name',
        key: 'full_name',
        fixed: 'left',
        width: 170,
        sorter: (a: PersonWithProgress, b: PersonWithProgress) => 
          (a.full_name || '').localeCompare(b.full_name || ''),
        defaultSortOrder: 'ascend' as const,
        render: (text: string, record: PersonWithProgress) => (
          <Button
            type="link"
            onClick={() => router.push(`/person/${record.id}`)}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
          </Button>
        ),
      },
    ];

    console.log('Rendering columns with milestones:', milestones);
    
    const milestoneColumns = milestones.map((stage) => ({
      title: (
        <Tooltip title={stage.name}>
          <div style={{ textAlign: 'center', fontWeight: '700' }}>
            <div style={{ fontSize: '9px', whiteSpace: 'pre-line', marginBottom: '1px', fontWeight: '700', color: '#000' }}>
              {stage.shortName}
            </div>
            <div style={{ fontSize: '10px', fontWeight: '600', color: '#1890ff' }}>
              [M{stage.number.toString().padStart(2, '0')}]
            </div>
          </div>
        </Tooltip>
      ),
      key: `milestone_${stage.number}`,
      width: 60,
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
  }, [milestones, getMilestoneStatus, router]);

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

  const totalStages = milestones.length;
  const totalNewConverts = people.length;
  const newConvertsWithCompletedMilestones = people.filter(
    person => person.progress.filter(p => p.is_completed).length === totalStages
  ).length;
  const newConvertsInArrears = people.filter(
    person => person.progress.filter(p => p.is_completed).length < totalStages
  ).length;
  const totalMilestones = totalNewConverts * totalStages;
  const completedMilestones = people.reduce(
    (sum, person) => sum + person.progress.filter(p => p.is_completed).length,
    0
  );
  const overallProgress = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;

  return (
    <>
      {/* Top navigation header */}
      <div style={{ padding: '0 24px' }}>
        <div
          style={{
            margin: '8px 0 16px 0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input
              placeholder="Search names..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="small"
              style={{ width: 220 }}
            />
            {searchText && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {filteredPeople.length} of {people.length}
              </Text>
            )}
            <Button
              onClick={() => router.push('/leadpastor')}
            >
              Dashboard
            </Button>
            <Button
              type="primary"
              onClick={() => router.push(`/leadpastor/${month}`)}
            >
              Milestones
            </Button>
            <Button
              onClick={() => router.push(`/leadpastor/${month}/attendance`)}
            >
              Attendance
            </Button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>

        {/* Compact Summary Stats */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap'
        }}>
          <div className="stats-card-primary">
            <Text className="stats-card-label">Total New Converts</Text>
            <div className="stats-card-value">
              {totalNewConverts}
            </div>
          </div>
          <div className="stats-card-warning">
            <Text className="stats-card-label">Incomplete Milestones</Text>
            <div className="stats-card-value">
              {newConvertsInArrears}
            </div>
          </div>
          <div className="stats-card-success">
            <Text className="stats-card-label">Overall Progress</Text>
            <div className="stats-card-value">
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
          sticky={{ offsetHeader: 128 }}
          scroll={{ x: 'max-content', y: 'calc(100vh - 128px)' }}
          pagination={{
            defaultPageSize: 50,
            showSizeChanger: true,
            pageSizeOptions: ['50', '100', '200'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} people`,
            size: 'small',
          }}
          className="compact-milestone-table"
          style={{
            background: 'white',
            borderRadius: 8,
          }}
        />
      </div>
    </>
  );
}
