'use client';

import { useEffect, useState, useCallback, memo, useMemo, Suspense } from 'react';
import { Table, Button, Typography, Spin, message, Tooltip, Switch, Modal, Form, Input, Select, Breadcrumb } from 'antd';
import { UserAddOutlined, FileExcelOutlined, SearchOutlined, TeamOutlined, BarChartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ATTENDANCE_GOAL, CURRENT_YEAR } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { useThemeStyles } from '@/lib/theme-utils';
import { api } from '@/lib/api';

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
  const themeStyles = useThemeStyles();
  
  return (
    <Tooltip title={isAuto ? `${stageName} (Auto-calculated)` : stageName}>
      <div
        style={{
          padding: '4px',
          borderRadius: '4px',
          backgroundColor: themeStyles.cellBg,
          border: `1px solid ${themeStyles.border}`,
          transition: 'all 0.3s',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '24px',
        }}
      >
        <Switch
          checked={isCompleted}
          onChange={onToggle}
          loading={isUpdating}
          size="small"
          disabled={isAuto}
          style={{
            backgroundColor: isCompleted ? themeStyles.success : themeStyles.error,
          }}
        />
      </div>
    </Tooltip>
  );
});

// Read-only milestone cell component for leaders
const ReadOnlyMilestoneCell = memo(({ 
  isCompleted, 
  stageName
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

interface PersonWithProgress {
  id: string;
  full_name: string;
  group_name: string;
  group_year?: number;
  phone_number: string;
  progress: Array<{
    stage_number: number;
    is_completed: boolean;
  }>;
}

export default function SheepSeekerDashboard() {
  return (
    <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center' }}><Spin size="large" tip="Loading..." /></div>}>
      <SheepSeekerDashboardContent />
    </Suspense>
  );
}

function SheepSeekerDashboardContent() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  
  const [people, setPeople] = useState<PersonWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [milestones, setMilestones] = useState<Array<{
    number: number;
    name: string;
    shortName: string;
    description: string;
    isAutoCalculated: boolean;
  }>>([]);
  const [form] = Form.useForm();
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Fetch available years for the user's group (month)
  useEffect(() => {
    const fetchAvailableYears = async () => {
      if (!user || !token || !groupId) return;

      try {
        const response = await api.groups.list({ active: true });
        
        if (response.success && response.data) {
          const groups = response.data.groups || [];

          // Filter by the groupId from URL
          const selectedGroup = groups.find((g: any) => g.id === groupId);
          
          if (!selectedGroup) {
            throw new Error('Group not found');
          }

          // Filter by the group's month name to find all instances across years
          const userMonthName = selectedGroup.name;
          const matchingGroups = groups.filter((g: any) => g.name.toLowerCase() === userMonthName.toLowerCase());

          // Extract unique years
          const years = Array.from(new Set(matchingGroups.map((g: any) => g.year))) as number[];
          years.sort((a, b) => b - a); // Descending order (newest first)

          setAvailableYears(years);

          // Set the default year from the current group's year
          if (selectedGroup.year) {
            setSelectedYear(selectedGroup.year);
          } else if (years.length > 0) {
            setSelectedYear(years[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch available years:', error);
        message.error('Failed to load group data');
        router.push('/'); // Redirect on group not found
      }
    };

    fetchAvailableYears();
  }, [user, token, groupId, router]);

  // Fetch milestones from database
  const fetchMilestones = useCallback(async () => {
    try {
      const response = await api.milestones.list();
      if (!response.success) throw new Error('Failed to fetch milestones');
      
      const milestoneData = response.data?.milestones || [];
      console.log('Fetched milestones from API:', milestoneData);
      const formattedMilestones = milestoneData.map((milestone: any) => {
        // Format short_name: split multi-word names across two lines, keep single words intact
        let formattedShortName = milestone.short_name || milestone.stage_name.substring(0, 10);
        if (milestone.short_name && !formattedShortName.includes('\n')) {
          const words = milestone.short_name.split(/[\s,\/]+/).filter((w: string) => w.length > 0);
          if (words.length > 1) {
            // Multi-word: split at midpoint
            const midpoint = Math.ceil(words.length / 2);
            const firstLine = words.slice(0, midpoint).join(' ');
            const secondLine = words.slice(midpoint).join(' ');
            formattedShortName = `${firstLine}\n${secondLine}`;
          }
          // Single word: leave as-is
        }
        
        return {
          number: milestone.stage_number,
          name: milestone.stage_name,
          shortName: formattedShortName,
          description: milestone.description,
          isAutoCalculated: milestone.is_auto_calculated || false,
        };
      });
      console.log('Formatted milestones:', formattedMilestones);
      
      setMilestones(formattedMilestones);
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
      message.error('Failed to load milestones from database');
      setMilestones([]);
    }
  }, []);

  useEffect(() => {
    // Validate access to this group
    if (!authLoading && !user) {
      router.push('/auth');
      return;
    }

    // Superadmin can access any group
    // Others (admin, leader, leadpastor, overseer) can only access their assigned group
    if (!authLoading && user && user.role !== 'superadmin' && user.role !== 'leadpastor' && user.role !== 'overseer' && user.group_id !== groupId) {
      message.error('Unauthorized access to this group');
      router.push('/');
      return;
    }

    if (user && token) {
      console.log('[SHEEP-SEEKER] Authorized user:', user.role, 'accessing group:', groupId);
      fetchMilestones();
    }
  }, [user, token, authLoading, router, fetchMilestones, groupId]);

  // Fetch people when selectedYear changes
  useEffect(() => {
    if (user && token && selectedYear && groupId) {
      console.log('[SHEEP-SEEKER] Fetching people for group:', groupId, 'year:', selectedYear);
      fetchAllPeople(selectedYear);
    }
  }, [user, token, selectedYear, groupId]);

  const fetchAllPeople = async (year?: number) => {
    try {
      setLoading(true);
      // Use groupId from URL params
      const response = await api.people.list({
        group_id: groupId,
        year: year,
        include: 'progress',
      });
      
      console.log('[SHEEP-SEEKER] Fetching people for group:', groupId, 'year:', year);

      if (!response.success) {
        console.error('[SHEEP-SEEKER] Fetch error:', response.error);
        throw new Error(response.error?.message || 'Failed to fetch people');
      }

      console.log('[SHEEP-SEEKER] Fetched people:', response.data?.people?.length || 0);

      // Data is already formatted with progress included
      setPeople(response.data?.people || []);
    } catch (error: any) {
      console.error('[SHEEP-SEEKER] Error:', error);
      message.error(error.message || 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    try {
      const response = await api.people.create({
        ...values,
        group_name: user?.group_name,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to register person');
      }

      message.success('Person registered successfully!');
      form.resetFields();
      setRegisterModalVisible(false);
      fetchAllPeople();
    } catch (error: any) {
      message.error(error.message || 'Registration failed');
    }
  };

  // Optimized toggle function with useCallback
  const toggleMilestone = useCallback(async (personId: string, stageNumber: number, currentStatus: boolean) => {
    // Check if this milestone is auto-calculated
    const milestone = milestones.find(m => m.number === stageNumber);
    if (milestone?.isAutoCalculated) {
      message.warning(`${milestone.name} is auto-calculated and cannot be toggled manually`);
      return;
    }

    setUpdating(`${personId}-${stageNumber}`);
    try {
      const response = await api.progress.update(personId, {
        stage_number: stageNumber,
        is_completed: !currentStatus,
      });

      if (!response.success) throw new Error('Failed to update milestone');

      // Update local state
      setPeople(prevPeople =>
        prevPeople.map(person => {
          if (person.id === personId) {
            // Check if the stage exists in progress array
            const stageExists = person.progress.some(p => p.stage_number === stageNumber);
            
            if (stageExists) {
              // Update existing stage
              return {
                ...person,
                progress: person.progress.map(p =>
                  p.stage_number === stageNumber
                    ? { ...p, is_completed: !currentStatus }
                    : p
                ),
              };
            } else {
              // Add new stage if it doesn't exist
              return {
                ...person,
                progress: [
                  ...person.progress,
                  { stage_number: stageNumber, is_completed: !currentStatus }
                ],
              };
            }
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
  }, [token, milestones]);

  const getMilestoneStatus = useCallback((person: PersonWithProgress, stageNumber: number) => {
    const stage = person.progress.find(p => p.stage_number === stageNumber);
    return stage?.is_completed || false;
  }, []);

  const isLeader = user?.role === 'leader';

  const filteredPeople = useMemo(() => {
    if (!searchText) return people;
    const term = searchText.toLowerCase();
    return people.filter((p) =>
      p.full_name?.toLowerCase().includes(term) ||
      p.phone_number?.toLowerCase().includes(term)
    );
  }, [people, searchText]);

  const columns: ColumnsType<PersonWithProgress> = useMemo(() => {
    const baseColumns: ColumnsType<PersonWithProgress> = [
      {
        title: 'Name',
        dataIndex: 'full_name',
        key: 'full_name',
        fixed: 'left',
        width: 180,
        sorter: (a: PersonWithProgress, b: PersonWithProgress) =>
          a.full_name.localeCompare(b.full_name),
        defaultSortOrder: 'ascend' as const,
        render: (text: string, record: PersonWithProgress) => (
          <Button
            type="link"
            onClick={() => router.push(`/${groupId}/person/${record.id}`)}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
          </Button>
        ),
      },
    ];

    const milestoneColumns: ColumnsType<PersonWithProgress> = milestones.map((milestone) => ({
      title: (
        <Tooltip title={milestone.name}>
          <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
            <div style={{ fontSize: '9px', whiteSpace: 'pre-line', marginBottom: '2px' }}>
              {milestone.shortName}
            </div>
            <div style={{ fontSize: '10px', color: '#1890ff' }}>
              [M{milestone.number.toString().padStart(2, '0')}]
            </div>
          </div>
        </Tooltip>
      ),
      key: `milestone_${milestone.number}`,
      width: 60,
      align: 'center' as const,
      render: (_: any, record: PersonWithProgress) =>
        isLeader ? (
          <ReadOnlyMilestoneCell
            isCompleted={getMilestoneStatus(record, milestone.number)}
            stageName={milestone.name}
          />
        ) : (
          <MilestoneCell
            isCompleted={getMilestoneStatus(record, milestone.number)}
            isUpdating={updating === `${record.id}-${milestone.number}`}
            onToggle={() => toggleMilestone(record.id, milestone.number, getMilestoneStatus(record, milestone.number))}
            stageName={milestone.name}
            isAuto={milestone.isAutoCalculated}
          />
        ),
    }));

    return baseColumns.concat(milestoneColumns);
  }, [milestones, getMilestoneStatus, toggleMilestone, updating, isLeader, router, groupId]);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  if (!user) {
    return null; // redirect handled in useEffect
  }

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Sticky Controls Bar */}
      <div className="sticky-controls-bar">
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            placeholder="Search by name, phone, group..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 250 }}
          />

          <Button
            icon={<SearchOutlined />}
            type="primary"
          >
            Milestones
          </Button>

          <Button
            icon={<TeamOutlined />}
            onClick={() => router.push(`/${groupId}/attendance`)}
          >
            Attendance
          </Button>

          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <Button
              icon={<UserAddOutlined />}
              onClick={() => setRegisterModalVisible(true)}
            >
              Register
            </Button>
          )}

          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => router.push(`/${groupId}/people/bulk-register`)}
            >
              Bulk Register
            </Button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Compact Summary Stats */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 16,
          marginBottom: 16,
        }}>
          <div className="stats-card-primary">
            <Text className="stats-card-label">Total</Text>
            <div className="stats-card-value">
              {filteredPeople.length}
            </div>
          </div>
          <div className="stats-card-warning">
            <Text className="stats-card-label">Incomplete</Text>
            <div className="stats-card-value">
              {filteredPeople.filter(p => p.progress.filter(pr => pr.is_completed).length < milestones.length).length}
            </div>
          </div>
          <div className="stats-card-success">
            <Text className="stats-card-label">Progress</Text>
            <div className="stats-card-value">
              {(() => {
                const total = filteredPeople.length * milestones.length;
                const completed = filteredPeople.reduce((sum, p) => sum + p.progress.filter(pr => pr.is_completed).length, 0);
                return total > 0 ? Math.round((completed / total) * 100) : 0;
              })()}%
            </div>
          </div>
        </div>

        {/* Milestone Grid Table */}
        <Table
          columns={columns}
          dataSource={filteredPeople}
          rowKey="id"
          size="small"
          className="compact-milestone-table"
          sticky={{ offsetHeader: 128 }}
          scroll={{ x: 'max-content', y: 'calc(100vh - 128px)' }}
          pagination={{
            defaultPageSize: 50,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} people`,
          }}
          style={{
            background: 'white',
            borderRadius: 8,
          }}
        />
      </div>

      <Modal
        title="Register Person"
        open={registerModalVisible}
        onCancel={() => setRegisterModalVisible(false)}
        okText="Register"
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleRegister}>
          <Form.Item name="first_name" label="First Name" rules={[{ required: true, message: 'First name is required' }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Last Name" rules={[{ required: true, message: 'Last name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone_number" label="Phone Number" rules={[{ required: true, message: 'Phone is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="gender" label="Gender" rules={[{ required: true }]}> 
            <Select
              options={[
                { label: 'Male', value: 'Male' },
                { label: 'Female', value: 'Female' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
