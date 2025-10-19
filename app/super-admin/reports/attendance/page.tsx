'use client';

import { useEffect, useState } from 'react';
import { Card, Typography, Spin, Table, Progress, Row, Col, Statistic } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { ATTENDANCE_GOAL } from '@/lib/constants';

const { Title, Text } = Typography;

interface PersonAttendance {
  id: string;
  full_name: string;
  department_name: string;
  attendanceCount: number;
  percentage: number;
}

export default function AttendanceReportPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<PersonAttendance[]>([]);
  const [stats, setStats] = useState({ avgAttendance: 0, goalAchievers: 0 });

  useEffect(() => {
    if (token) {
      fetchAttendanceData();
    }
  }, [token]);

  const fetchAttendanceData = async () => {
    try {
      const response = await fetch('/api/people', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const people = data.people || [];

      const attendanceList = await Promise.all(
        people.map(async (person: any) => {
          const detailsRes = await fetch(`/api/people/${person.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const details = await detailsRes.json();
          const attendanceCount = details.attendanceCount || 0;

          return {
            id: person.id,
            full_name: person.full_name,
            department_name: person.department_name,
            attendanceCount,
            percentage: Math.min(Math.round((attendanceCount / ATTENDANCE_GOAL) * 100), 100),
          };
        })
      );

      const avgAttendance = Math.round(
        attendanceList.reduce((sum, p) => sum + p.percentage, 0) / attendanceList.length
      );
      const goalAchievers = attendanceList.filter((p) => p.attendanceCount >= ATTENDANCE_GOAL).length;

      setAttendanceData(attendanceList.sort((a, b) => b.attendanceCount - a.attendanceCount));
      setStats({ avgAttendance, goalAchievers });
    } catch (error) {
      console.error('Failed to fetch attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      key: 'department_name',
    },
    {
      title: 'Attendance Count',
      dataIndex: 'attendanceCount',
      key: 'attendanceCount',
      sorter: (a: PersonAttendance, b: PersonAttendance) => a.attendanceCount - b.attendanceCount,
      render: (count: number) => `${count} / ${ATTENDANCE_GOAL}`,
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: PersonAttendance) => (
        <Progress
          percent={record.percentage}
          strokeColor={record.percentage >= 100 ? '#52c41a' : '#1890ff'}
        />
      ),
    },
  ];

  if (loading) {
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
          <Title level={2}>Attendance Report</Title>
          <Text type="secondary">Track church attendance across all members (Goal: {ATTENDANCE_GOAL} Sundays)</Text>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card>
              <Statistic
                title="Average Attendance Rate"
                value={stats.avgAttendance}
                suffix="%"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Statistic
                title="Goal Achievers"
                value={stats.goalAchievers}
                suffix={`/ ${attendanceData.length}`}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Individual Attendance Records">
          <Table
            columns={columns}
            dataSource={attendanceData}
            rowKey="id"
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </Card>
      </div>
    </>
  );
}
