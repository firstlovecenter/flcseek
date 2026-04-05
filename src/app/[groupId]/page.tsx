'use client';

import { useEffect, useState, useCallback, memo, useMemo, Suspense } from 'react';
import { Table, Button, Typography, Spin, message, Tooltip, Switch, Modal, Form, Input, Select, Breadcrumb, DatePicker, Card, Progress, Empty } from 'antd';
import { UserAddOutlined, FileExcelOutlined, SearchOutlined, TeamOutlined, BarChartOutlined, HomeOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Key } from 'react';
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
  const isRegisterRestricted = user?.role === 'leader' || user?.role === 'overseer' || user?.role === 'leadpastor';
  const [isMobile, setIsMobile] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Key[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      } catch (error: any) {
        console.error('Failed to fetch available years:', error);
        message.error(`Failed to load group information: ${error.message || 'Unknown error'}. Redirecting to home...`);
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
      if (process.env.NODE_ENV !== 'production') console.log('Fetched milestones from API:', milestoneData);
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
      if (process.env.NODE_ENV !== 'production') console.log('Formatted milestones:', formattedMilestones);
      
      setMilestones(formattedMilestones);
    } catch (error: any) {
      console.error('Failed to fetch milestones:', error);
      message.error(`Failed to load milestones: ${error.message || 'Database error'}. Some features may not work correctly.`);
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
      if (process.env.NODE_ENV !== 'production') console.log('[SHEEP-SEEKER] Authorized user:', user.role, 'accessing group:', groupId);
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
        group_id: groupId,
        group_name: user?.group_name,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to register person');
      }

      message.success('Person registered successfully!');
      form.resetFields();
      setRegisterModalVisible(false);
      fetchAllPeople(selectedYear || undefined);
    } catch (error: any) {
      const errorMsg = error.message || 'Registration failed';
      if (errorMsg.includes('phone number') && errorMsg.includes('already')) {
        message.error('This phone number is already registered. Each person must have a unique phone number.');
      } else {
        message.error(errorMsg);
      }
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

  // Read-only for leaders, overseers, and leadpastors; editable only for admin and superadmin
  const isReadOnly = user?.role === 'leader' || user?.role === 'overseer' || user?.role === 'leadpastor';
  const canDeleteConverts = user?.role === 'leader' || user?.role === 'admin' || user?.role === 'overseer' || user?.role === 'leadpastor' || user?.role === 'superadmin';

  const filteredPeople = useMemo(() => {
    if (!searchText) return people;
    const term = searchText.toLowerCase();
    return people.filter((p) =>
      p.full_name?.toLowerCase().includes(term) ||
      p.phone_number?.toLowerCase().includes(term)
    );
  }, [people, searchText]);

  const handleBulkDelete = useCallback(() => {
    if (!selectedIds.length) {
      message.warning('Select at least one convert to delete');
      return;
    }

    Modal.confirm({
      title: 'Delete selected converts?',
      content: `This will soft delete ${selectedIds.length} selected convert(s). Their records will be preserved but hidden from active views.`,
      okText: 'Delete Selected',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setDeleting(true);
          const response = await api.post('/bulk-actions', {
            action: 'delete',
            convertIds: selectedIds,
            groupId,
          });

          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to delete selected converts');
          }

          const result = response.data as any;
          message.success(`Deleted ${result?.successCount ?? 0} convert(s)`);
          setSelectedIds([]);
          fetchAllPeople(selectedYear || undefined);
        } catch (error: any) {
          message.error(error.message || 'Failed to delete selected converts');
        } finally {
          setDeleting(false);
        }
      },
    });
  }, [selectedIds, groupId, selectedYear, fetchAllPeople]);

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
        isReadOnly ? (
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
  }, [milestones, getMilestoneStatus, toggleMilestone, updating, isReadOnly, router, groupId]);

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

          {(
            user?.role === 'leadpastor' ||
            user?.role === 'overseer' ||
            ((user?.role === 'admin' || user?.role === 'leader') && (!user?.group_id || (user as any)?.groups_assigned?.length > 1))
          ) && (
            <Button
              icon={<HomeOutlined />}
              onClick={() => router.push('/')}
            >
              Home
            </Button>
          )}

          <Button
            icon={<BarChartOutlined />}
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

          {(user?.role === 'superadmin' || user?.role === 'leadpastor' || user?.role === 'overseer') && (
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => router.push(`/${groupId}/reports`)}
            >
              Reports
            </Button>
          )}

          {!isRegisterRestricted && (
            <Button
              icon={<UserAddOutlined />}
              onClick={() => setRegisterModalVisible(true)}
            >
              Register
            </Button>
          )}

          {!isRegisterRestricted && (
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => router.push(`/${groupId}/people/bulk-register`)}
            >
              Bulk Register
            </Button>
          )}

          {canDeleteConverts && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleBulkDelete}
              disabled={selectedIds.length === 0}
              loading={deleting}
            >
              Delete Selected ({selectedIds.length})
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
                const completed = filteredPeople.reduce((sum: number, p: any) => sum + p.progress.filter((pr: any) => pr.is_completed).length, 0);
                return total > 0 ? Math.round((completed / total) * 100) : 0;
              })()}%
            </div>
          </div>
        </div>

        {/* Milestone Grid Table */}
        <Table
          columns={columns}
          dataSource={filteredPeople}
          rowSelection={canDeleteConverts ? {
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys),
          } : undefined}
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
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleRegister}>
          <Form.Item name="first_name" label="First Name" rules={[{ required: true, message: 'First name is required' }]}> 
            <Input placeholder="John" />
          </Form.Item>
          <Form.Item name="last_name" label="Last Name" rules={[{ required: true, message: 'Last name is required' }]}>
            <Input placeholder="Doe" />
          </Form.Item>
          <Form.Item 
            name="phone_number" 
            label="Phone Number" 
            rules={[
              { required: true, message: 'Phone number is required' },
              { pattern: /^[0-9+\-\s()]+$/, message: 'Invalid phone number' },
            ]}
          >
            <Input placeholder="+233 123 456 789" />
          </Form.Item>
          <Form.Item 
            name="date_of_birth" 
            label="Date of Birth (without year)" 
            rules={[
              { required: true, message: 'Date of birth is required' },
              { pattern: /^\d{2}-\d{2}$/, message: 'Format must be DD-MM (e.g., 15-03)' },
            ]}
            extra="Format: DD-MM (e.g., 15-03 for March 15)"
          >
            <Input placeholder="15-03" maxLength={5} />
          </Form.Item>
          <Form.Item name="gender" label="Gender" rules={[{ required: true, message: 'Gender is required' }]}> 
            <Select
              placeholder="Select gender"
              options={[
                { label: 'Male', value: 'Male' },
                { label: 'Female', value: 'Female' },
              ]}
            />
          </Form.Item>
          <Form.Item 
            name="residential_location" 
            label="Residential Location" 
            rules={[{ required: true, message: 'Residential location is required' }]}
          >
            <Input placeholder="e.g., Accra, Ghana" />
          </Form.Item>
          <Form.Item name="school_residential_location" label="School Residential Location (if applicable)">
            <Input placeholder="e.g., KNUST Campus" />
          </Form.Item>
          <Form.Item 
            name="occupation_type" 
            label="Worker or Student" 
            rules={[{ required: true, message: 'Please select worker or student' }]}
          >
            <Select
              placeholder="Select worker or student"
              options={[
                { label: 'Worker', value: 'Worker' },
                { label: 'Student', value: 'Student' },
                { label: 'Unemployed', value: 'Unemployed' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
