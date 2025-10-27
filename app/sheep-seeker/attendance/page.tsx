'use client';

import { useEffect, useState, Suspense } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag, DatePicker, Space } from 'antd';
import { PlusOutlined, HomeOutlined, TeamOutlined, BarChartOutlined, UserAddOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import dayjs from 'dayjs';
import { useThemeStyles } from '@/lib/theme-utils';

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
  const searchParams = useSearchParams();
  const groupIdFromUrl = searchParams.get('group_id');
  const [people, setPeople] = useState<PersonAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const themeStyles = useThemeStyles();
  
  // Calculate the most recent Sunday as the default date
  const getMostRecentSunday = () => {
    const today = dayjs();
    return today.day() === 0 ? today : today.subtract(today.day(), 'day');
  };
  
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(getMostRecentSunday());
  
  // Check if user is a leader (read-only access)
  const isLeader = user?.role === 'leader';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchPeople();
    }
  }, [user, token, authLoading, router, groupIdFromUrl]);

  const fetchPeople = async () => {
    try {
      // Use the optimized endpoint with group_id filtering
      const url = groupIdFromUrl 
        ? `/api/people/with-progress?group_id=${groupIdFromUrl}`
        : '/api/people/with-progress';
        
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch people');

      const data = await response.json();

      // Map the optimized response to attendance format
      const peopleWithAttendance = data.people.map((person: any) => ({
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
      const response = await fetch(`/api/attendance/${personId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date_attended: selectedDate.format('YYYY-MM-DD'),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark attendance');
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
            onClick={() => router.push(`/person/${record.id}`)}
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
                onClick={() => {
                  const url = groupIdFromUrl 
                    ? `/sheep-seeker?group_id=${groupIdFromUrl}`
                    : '/sheep-seeker';
                  router.push(url);
                }}
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
                  onClick={() => {
                    const url = groupIdFromUrl 
                      ? `/sheep-seeker/people/register?group_id=${groupIdFromUrl}`
                      : '/sheep-seeker/people/register';
                    router.push(url);
                  }}
                >
                  Register
                </Button>
              )}
              {!isLeader && (
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={() => {
                    const url = groupIdFromUrl 
                      ? `/sheep-seeker/people/bulk-register?group_id=${groupIdFromUrl}`
                      : '/sheep-seeker/people/bulk-register';
                    router.push(url);
                  }}
                >
                  Bulk Register
                </Button>
              )}
            </Space>
          </div>
          <Text type="secondary">
            {isLeader 
              ? `View attendance records for all new converts (Goal: ${ATTENDANCE_GOAL} Sundays) - Read-only access`
              : `Mark attendance for church services (Goal: ${ATTENDANCE_GOAL} Sundays)`
            }
          </Text>
        </div>

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
