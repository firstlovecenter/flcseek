'use client';

import { useEffect, useState, Suspense } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag, DatePicker, Space, Select } from 'antd';
import { PlusOutlined, HomeOutlined, TeamOutlined, BarChartOutlined, UserAddOutlined, FileExcelOutlined, CalendarOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { ATTENDANCE_GOAL, CURRENT_YEAR } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import dayjs from 'dayjs';
import { useThemeStyles } from '@/lib/theme-utils';
import { api } from '@/lib/api';

const { Title, Text } = Typography;

interface PersonAttendance {
  id: string;
  full_name: string;
  group_name: string;
  phone_number: string;
  attendanceCount: number;
  percentage: number;
}

function AttendancePageContent() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  
  const [people, setPeople] = useState<PersonAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const themeStyles = useThemeStyles();
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  
  // Calculate the most recent Sunday as the default date
  const getMostRecentSunday = () => {
    const today = dayjs();
    return today.day() === 0 ? today : today.subtract(today.day(), 'day');
  };
  
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(getMostRecentSunday());
  
  // Check if user is a leader (read-only access) or superadmin (full access)
  const isLeader = user?.role === 'leader';
  const isSuperAdmin = user?.role === 'superadmin';

  // Fetch available years for the group
  useEffect(() => {
    const fetchAvailableYears = async () => {
      if (!user || !token || !groupId) return;

      try {
        const response = await api.groups.list({ active: true });
        
        if (response.success && response.data) {
          const groups = response.data.groups || [];

          // Find the selected group
          const selectedGroup = groups.find((g: any) => g.id === groupId);
          if (!selectedGroup) {
            throw new Error('Group not found');
          }

          // Filter by the group's month name to find all instances across years
          const monthName = selectedGroup.name;
          const matchingGroups = groups.filter((g: any) => g.name.toLowerCase() === monthName.toLowerCase());

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
        router.push(`/${groupId}`);
      }
    };

    fetchAvailableYears();
  }, [user, token, groupId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
      return;
    }

    // Validate access
    if (!authLoading && user && user.role !== 'superadmin' && user.role !== 'leadpastor' && user.group_id !== groupId) {
      message.error('Unauthorized access to this group');
      router.push('/');
      return;
    }

    // Only fetch when we have a selected year
    if (user && token && selectedYear) {
      fetchPeople();
    }
  }, [user, token, authLoading, router, groupId, selectedYear]);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      // Use the groupId from URL params
      const response = await api.people.list({
        group_id: groupId,
        year: selectedYear || undefined,
        include: 'progress',
      });

      if (!response.success) throw new Error('Failed to fetch people');

      // Map the optimized response to attendance format
      const peopleWithAttendance = (response.data?.people || []).map((person: any) => ({
        id: person.id,
        full_name: person.full_name,
        group_name: person.group_name,
        phone_number: person.phone_number,
        attendanceCount: person.attendance_count || 0,
        percentage: Math.min(Math.round(((person.attendance_count || 0) / ATTENDANCE_GOAL) * 100), 100),
      }));

      setPeople(peopleWithAttendance);
    } catch (error: any) {
      message.error(error.message || 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (personId: string) => {
    try {
      const response = await api.attendance.mark(personId, {
        date_attended: selectedDate.format('YYYY-MM-DD'),
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to mark attendance');
      }

      message.success('Attendance marked successfully!');
      fetchPeople();
    } catch (error: any) {
      message.error(error.message || 'Failed to mark attendance');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200,
      fixed: 'left' as const,
      render: (text: string, record: PersonAttendance) => (
        <div>
          <Button
            type="link"
            onClick={() => router.push(`/${groupId}/person/${record.id}`)}
            style={{ padding: 0, fontWeight: 500 }}
          >
            {text}
          </Button>
          {isLeader && (
            <div style={{ fontSize: 12, color: '#888' }}>
              <a href={`tel:${record.phone_number}`} style={{ color: '#888' }}>
                📞 {record.phone_number}
              </a>
            </div>
          )}
        </div>
      ),
    },
    // Only show Actions column for admins (not for leaders)
    ...(!isLeader ? [{
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'left' as const,
      render: (_: any, record: PersonAttendance) => (
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => markAttendance(record.id)}
        >
          Mark Present
        </Button>
      ),
    }] : []),
    {
      title: 'Attendance Progress',
      key: 'attendance',
      render: (_: any, record: PersonAttendance) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Progress
              percent={record.percentage}
              strokeColor={record.attendanceCount >= 10 ? '#52c41a' : '#ff4d4f'}
              size="small"
              format={(percent) => `${record.attendanceCount}/${ATTENDANCE_GOAL}`}
            />
          </div>
          <Tag color={record.attendanceCount >= 10 ? 'success' : 'error'}>
            {record.percentage}%
          </Tag>
        </div>
      ),
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <AppBreadcrumb />
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={2} style={{ margin: 0 }}>
              {isLeader ? 'Attendance Tracking' : 'Update Attendance Tracking'}
            </Title>
            <Space>
              <Button
                icon={<BarChartOutlined />}
                onClick={() => router.push(`/${groupId}`)}
              >
                Milestones
              </Button>
              <Button
                icon={<TeamOutlined />}
                type="primary"
              >
                Attendance
              </Button>
              {!isLeader && (
                <Button
                  icon={<UserAddOutlined />}
                  onClick={() => router.push(`/${groupId}/people/register`)}
                >
                  Register
                </Button>
              )}
              {!isLeader && (
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={() => router.push(`/${groupId}/people/bulk-register`)}
                >
                  Bulk Register
                </Button>
              )}
            </Space>
          </div>
          <Text type="secondary">
            {isLeader 
              ? `View attendance records for all new converts (Goal: ${ATTENDANCE_GOAL} Sundays)`
              : `Mark attendance for church services (Goal: ${ATTENDANCE_GOAL} Sundays)`
            }
          </Text>
        </div>

        {/* Year Selector - only show if multiple years available */}
        {availableYears.length > 1 && (
          <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Text><CalendarOutlined /> Year:</Text>
            <Select
              value={selectedYear}
              onChange={(year) => setSelectedYear(year)}
              style={{ width: 100 }}
              options={availableYears.map((year) => ({
                label: year.toString(),
                value: year,
              }))}
              placeholder="Year"
            />
          </div>
        )}

        {/* Only show date picker for admins (not for leaders) */}
        {!isLeader && (
          <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Text>Select Date:</Text>
            <DatePicker
              value={selectedDate}
              onChange={(date) => setSelectedDate(date || dayjs())}
              size="large"
              format="MMMM DD, YYYY"
              style={{ minWidth: '200px' }}
              disabledDate={(current) => {
                if (!current) return false;
                
                // Superadmin can select any Sunday in the past or present
                if (isSuperAdmin) {
                  const today = dayjs();
                  // Disable if not a Sunday (day 0)
                  if (current.day() !== 0) return true;
                  // Disable if future date
                  if (current.isAfter(today, 'day')) return true;
                  return false;
                }
                
                // Non-superadmin: only allow the most recent Sunday
                const today = dayjs();
                
                // Disable if not a Sunday (day 0)
                if (current.day() !== 0) return true;
                
                // Calculate the most recent Sunday (or today if today is Sunday)
                const mostRecentSunday = today.day() === 0 
                  ? today 
                  : today.subtract(today.day(), 'day');
                
                // Only allow the most recent Sunday - disable all other dates
                if (!current.isSame(mostRecentSunday, 'day')) return true;
                
                return false;
              }}
            />
            {isSuperAdmin && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                (Superadmin: Can select any past Sunday)
              </Text>
            )}
          </div>
        )}

        <Table
          columns={columns}
          dataSource={people}
          rowKey="id"
          size="middle"
          scroll={{ x: 800 }}
          pagination={{ 
            pageSize: 20, 
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} new converts`
          }}
          style={{ background: themeStyles.containerBg, borderRadius: 8 }}
        />
      </div>
    </>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>}>
      <AttendancePageContent />
    </Suspense>
  );
}
