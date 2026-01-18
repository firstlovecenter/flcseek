'use client';

import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { Table, Button, Typography, Spin, Tooltip, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useThemeStyles } from '@/lib/theme-utils';
import { api } from '@/lib/api';

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

export default function LeadPastorGroupDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupId = params?.month as string; // Dynamic segment is [month] but now holds group_id
  const [people, setPeople] = useState<PersonWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [milestones, setMilestones] = useState<Array<{ number: number; name: string; shortName: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<{ name: string; year: number } | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'leadpastor')) {
      console.log('[LEAD-PASTOR-MONTH] Unauthorized access attempt, redirecting to home');
      router.push('/');
      return;
    }

    if (user && token && groupId) {
      fetchMilestones();
      fetchGroupPeople();
    }
  }, [user, token, authLoading, router, groupId]);

  const fetchMilestones = async () => {
    try {
      const response = await api.milestones.list();

      if (response.success) {
        const milestoneData = response.data?.milestones || [];
        console.log('Fetched milestones from API:', milestoneData);
        const formattedMilestones = milestoneData.map((m: any) => {
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

  const fetchGroupPeople = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[LeadPastor] Fetching people for groupId:', groupId);
      
      // Fetch people in the selected group with progress data
      const response = await api.people.list({
        group_id: groupId,
        include: 'progress',
      });

      console.log('[LeadPastor] API Response:', {
        success: response.success,
        peopleCount: response.data?.people?.length,
        responseData: response.data,
      });

      if (!response.success) {
        setError(`Failed to fetch people: ${response.error?.message}`);
        throw new Error('Failed to fetch people');
      }

      // Sort alphabetically by full_name
      const sortedPeople = (response.data?.people || []).sort((a: any, b: any) => 
        (a.full_name || '').localeCompare(b.full_name || '')
      );

      setPeople(sortedPeople);
      
      // Extract group info from first person
      if (sortedPeople.length > 0 && sortedPeople[0].group_name) {
        // Get the group details to find the year
        const groupResponse = await api.groups.list();
        if (groupResponse.success && groupResponse.data) {
          const group = groupResponse.data.find((g: any) => g.id === groupId);
          if (group) {
            setGroupInfo({ name: group.name, year: group.year });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching people:', error);
      setError('Unable to load people data');
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
        {/* Group name and year header */}
        <div style={{ 
          margin: '16px 0 8px 0',
          borderBottom: '2px solid #1890ff',
          paddingBottom: '8px'
        }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
            {groupInfo ? `${groupInfo.name} ${groupInfo.year}` : groupId} | Lead Pastor
          </Text>
        </div>
        
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
              onClick={() => router.push(`/leadpastor/${groupId}`)}
            >
              Milestones
            </Button>
            <Button
              onClick={() => router.push(`/leadpastor/${groupId}/attendance`)}
            >
              Attendance
            </Button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>

        {/* Error display */}
        {error && (
          <div style={{ padding: '12px', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '4px', marginBottom: '16px' }}>
            <Text type="danger">{error}</Text>
          </div>
        )}

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
