'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface PersonAttendance {
  id: string;
  full_name: string;
  group_name: string;
  phone_number: string;
  attendanceCount: number;
  percentage: number;
}

export default function AttendancePage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [people, setPeople] = useState<PersonAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  
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
  }, [user, token, authLoading, router]);

  const fetchPeople = async () => {
    try {
      const response = await fetch('/api/people', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch people');

      const data = await response.json();

      const peopleWithAttendance = await Promise.all(
        data.people.map(async (person: any) => {
          const detailsRes = await fetch(`/api/people/${person.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const details = await detailsRes.json();
          const attendanceCount = details.attendanceCount || 0;

          return {
            id: person.id,
            full_name: person.full_name,
            group_name: person.group_name,
            phone_number: person.phone_number,
            attendanceCount,
            percentage: Math.min(Math.round((attendanceCount / ATTENDANCE_GOAL) * 100), 100),
          };
        })
      );

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
          <Title level={2}>Attendance Tracking</Title>
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
          style={{ background: 'white', borderRadius: 8 }}
        />
      </div>
    </>
  );
}
