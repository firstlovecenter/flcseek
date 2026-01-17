'use client';

import { useEffect, useState, useCallback, memo, useMemo, Suspense } from 'react';
import { Table, Button, Typography, Spin, message, Tooltip, Switch, Modal, Form, Input, Select, Breadcrumb } from 'antd';
import { UserAddOutlined, FileExcelOutlined, SearchOutlined, TeamOutlined, BarChartOutlined, ArrowLeftOutlined, HomeOutlined, CalendarOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const groupIdFromUrl = searchParams.get('group_id');
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
  const [groupYear, setGroupYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Fetch available years for the user's group (month)
  useEffect(() => {
    const fetchAvailableYears = async () => {
      if (!user || !token) return;

      try {
        const response = await api.groups.list({ active: true });
        
        if (response.success && response.data) {
          const groups = response.data.groups || [];

          // Filter by the user's month group name
          const userMonthName = user.group_name;
          const matchingGroups = userMonthName
            ? groups.filter((g: any) => g.name.toLowerCase() === userMonthName.toLowerCase())
            : groups;

          // Extract unique years
          const years = Array.from(new Set(matchingGroups.map((g: any) => g.year))) as number[];
          years.sort((a, b) => b - a); // Descending order (newest first)

          setAvailableYears(years);

          // Set the default year from user's assigned group
          if (user.group_year) {
            setGroupYear(user.group_year);
            setSelectedYear(user.group_year);
          } else if (years.length > 0) {
            // Find the user's assigned group year or use the most recent
            const userGroup = groups.find((g: any) => 
              g.id === user.group_id || (g.name === user.group_name && g.year)
            );
            const defaultYear = userGroup?.year || years[0];
            setGroupYear(defaultYear);
            setSelectedYear(defaultYear);
          }
        }
      } catch (error) {
        console.error('Failed to fetch available years:', error);
        // Fallback to current year
        setAvailableYears([CURRENT_YEAR]);
        setSelectedYear(CURRENT_YEAR);
      }
    };

    fetchAvailableYears();
  }, [user, token]);

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
    // Allow leader, admin, leadpastor, and superadmin to access this page
    if (!authLoading && (!user || !['leader', 'admin', 'leadpastor', 'superadmin'].includes(user.role))) {
      console.log('[SHEEP-SEEKER] Unauthorized access attempt, redirecting to home');
      router.push('/');
      return;
    }

    if (user && token) {
      console.log('[SHEEP-SEEKER] Authorized user:', user.role);
      console.log('[SHEEP-SEEKER] Group ID from URL:', groupIdFromUrl);
      fetchMilestones();
    }
  }, [user, token, authLoading, router, fetchMilestones, groupIdFromUrl]);

  // Fetch people when selectedYear changes
  useEffect(() => {
    if (user && token && selectedYear) {
      console.log('[SHEEP-SEEKER] Fetching people for year:', selectedYear);
      fetchAllPeople(selectedYear);
    }
  }, [user, token, selectedYear, groupIdFromUrl]);

  const fetchAllPeople = async (year?: number) => {
    try {
      setLoading(true);
      // OPTIMIZED: Use single API call that returns people with progress
      const response = await api.people.list({
        group_id: groupIdFromUrl || undefined,
        year: year,
        include: 'progress',
      });
      
      console.log('[SHEEP-SEEKER] Fetching people for year:', year);

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

  // Check if user is a leader (read-only access)
  const isLeader = user?.role === 'leader';

  // Generate columns efficiently - reactively update when milestones change
  const columns = useMemo(() => {
    const baseColumns: any[] = [
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
            onClick={() => router.push(`/person/${record.id}`)}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
          </Button>
        ),
      },
    ];

    // Create milestone columns efficiently from database data
    const milestoneColumns = milestones.map((stage) => ({
      title: (
        <Tooltip title={stage.name}>
          <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
            <div style={{ fontSize: '9px', whiteSpace: 'pre-line', marginBottom: '2px' }}>
              {stage.shortName}
            </div>
            <div style={{ fontSize: '10px', color: '#1890ff' }}>
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
        const isUpdating = updating === `${record.id}-${stage.number}`;
        const isAuto = stage.isAutoCalculated; // Use flag from API instead of hardcoded check
        
        // Use read-only cell for leaders
        if (isLeader) {
          return (
            <ReadOnlyMilestoneCell
              isCompleted={isCompleted}
              stageName={stage.name}
            />
          );
        }
        
        const handleToggle = () => {
          // toggleMilestone already checks for auto-calculated milestones
          toggleMilestone(record.id, stage.number, isCompleted);
        };
        
        return (
          <MilestoneCell
            isCompleted={isCompleted}
            isUpdating={isUpdating}
            onToggle={handleToggle}
            stageName={stage.name}
            isAuto={isAuto}
          />
        );
      },
    }));

    return [...baseColumns, ...milestoneColumns];
  }, [milestones, getMilestoneStatus, updating, isLeader, router, toggleMilestone]);

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
  const totalMilestonesCount = milestones.length;
  const newConvertsWithCompletedMilestones = people.filter(
    person => person.progress.filter(p => p.is_completed).length === totalMilestonesCount
  ).length;
  const newConvertsInArrears = people.filter(
    person => person.progress.filter(p => p.is_completed).length < totalMilestonesCount
  ).length;
  const totalMilestones = totalNewConverts * totalMilestonesCount;
  const completedMilestones = people.reduce(
    (sum, person) => sum + person.progress.filter(p => p.is_completed).length,
    0
  );
  const overallProgress = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;

  // Display group name (which is already a month) and selected year
  const displayTitle = `${user?.group_name} ${selectedYear || groupYear || new Date().getFullYear()}`;

  // Check if user is admin (can access bulk registration)
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Handle year change
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  return (
    <>
      {/* Sticky Controls Bar */}
      <div className="sticky-controls-bar">
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Year Selector - only show if multiple years available */}
          {availableYears.length > 1 && (
            <Select
              value={selectedYear}
              onChange={handleYearChange}
              style={{ width: 100 }}
              options={availableYears.map((year) => ({
                label: year.toString(),
                value: year,
              }))}
              placeholder="Year"
              suffixIcon={<CalendarOutlined />}
            />
          )}
          
          <Input
            placeholder="Search by name, phone, group..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 250 }}
          />
          
          {/* Navigation buttons in order: Milestones - Attendance - Register - Bulk Register */}
          <Button
            icon={<BarChartOutlined />}
            type="primary"
          >
            Milestones
          </Button>
          
          <Button
            icon={<TeamOutlined />}
            onClick={() => router.push('/sheep-seeker/attendance')}
          >
            Attendance
          </Button>
          
          {(isAdmin || user?.role === 'admin') && (
            <Button
              icon={<UserAddOutlined />}
              onClick={() => setRegisterModalVisible(true)}
            >
              Register
            </Button>
          )}
          
          {(isAdmin || user?.role === 'admin') && (
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => router.push('/sheep-seeker/people/bulk-register')}
            >
              Bulk Register
            </Button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Compact Summary Stats - Side by Side */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 16,
          marginBottom: 16,
        }}>
          <div className="stats-card-primary">
            <Text className="stats-card-label">Total</Text>
            <div className="stats-card-value">
              {totalNewConverts}
            </div>
          </div>
          <div className="stats-card-warning">
            <Text className="stats-card-label">Incomplete</Text>
            <div className="stats-card-value">
              {newConvertsInArrears}
            </div>
          </div>
          <div className="stats-card-success">
            <Text className="stats-card-label">Progress</Text>
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

      {/* Register Modal */}
      <Modal
        title="Register New Person"
        open={registerModalVisible}
        onCancel={() => {
          setRegisterModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} onFinish={handleRegister} layout="vertical">
          <Form.Item
            name="first_name"
            label="First Name"
            rules={[{ required: true, message: 'Please enter first name' }]}
          >
            <Input placeholder="John" />
          </Form.Item>

          <Form.Item
            name="last_name"
            label="Last Name"
            rules={[{ required: true, message: 'Please enter last name' }]}
          >
            <Input placeholder="Doe" />
          </Form.Item>

          <Form.Item
            name="phone_number"
            label="Phone Number"
            rules={[
              { required: true, message: 'Please enter phone number' },
              { pattern: /^[0-9+\-\s()]+$/, message: 'Invalid phone number' },
            ]}
          >
            <Input placeholder="+233 123 456 789" />
          </Form.Item>

          <Form.Item
            name="date_of_birth"
            label="Date of Birth (without year)"
            rules={[
              { required: true, message: 'Please enter date of birth' },
              { pattern: /^\d{2}-\d{2}$/, message: 'Format must be DD-MM (e.g., 15-03)' },
            ]}
            extra="Format: DD-MM (e.g., 15-03 for March 15)"
          >
            <Input placeholder="15-03" maxLength={5} />
          </Form.Item>

          <Form.Item
            name="gender"
            label="Gender"
            rules={[{ required: true, message: 'Please select gender' }]}
          >
            <Select placeholder="Select gender">
              <Select.Option value="Male">Male</Select.Option>
              <Select.Option value="Female">Female</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="residential_location"
            label="Residential Location"
            rules={[{ required: true, message: 'Please enter residential location' }]}
          >
            <Input placeholder="e.g., Accra, Ghana" />
          </Form.Item>

          <Form.Item
            name="school_residential_location"
            label="School Residential Location (if applicable)"
          >
            <Input placeholder="e.g., KNUST Campus" />
          </Form.Item>

          <Form.Item
            name="occupation_type"
            label="Worker or Student"
            rules={[{ required: true, message: 'Please select worker or student' }]}
          >
            <Select placeholder="Select worker or student">
              <Select.Option value="Worker">Worker</Select.Option>
              <Select.Option value="Student">Student</Select.Option>
              <Select.Option value="Unemployed">Unemployed</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Register Person
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
