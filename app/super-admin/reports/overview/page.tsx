'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Spin, Progress, Statistic } from 'antd';
import { UserOutlined, TeamOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { ATTENDANCE_GOAL, DEPARTMENTS } from '@/lib/constants';

const { Title, Text } = Typography;

interface DepartmentStats {
  name: string;
  totalPeople: number;
  avgProgress: number;
  avgAttendance: number;
}

export default function ReportsOverviewPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPeople: 0,
    avgProgress: 0,
    avgAttendance: 0,
    departmentStats: [] as DepartmentStats[],
  });

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/people', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const people = data.people || [];

      const peopleWithStats = await Promise.all(
        people.map(async (person: any) => {
          const detailsRes = await fetch(`/api/people/${person.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const details = await detailsRes.json();

          const completedStages = details.progress?.filter((p: any) => p.is_completed).length || 0;
          const progressPercentage = Math.round((completedStages / 15) * 100);
          const attendanceCount = details.attendanceCount || 0;
          const attendancePercentage = Math.min(Math.round((attendanceCount / ATTENDANCE_GOAL) * 100), 100);

          return {
            ...person,
            progressPercentage,
            attendancePercentage,
          };
        })
      );

      const totalPeople = peopleWithStats.length;
      const avgProgress = Math.round(
        peopleWithStats.reduce((sum, p) => sum + p.progressPercentage, 0) / totalPeople
      );
      const avgAttendance = Math.round(
        peopleWithStats.reduce((sum, p) => sum + p.attendancePercentage, 0) / totalPeople
      );

      const departmentStats: DepartmentStats[] = DEPARTMENTS.map((dept) => {
        const deptPeople = peopleWithStats.filter((p) => p.department_name === dept);
        return {
          name: dept,
          totalPeople: deptPeople.length,
          avgProgress: deptPeople.length
            ? Math.round(deptPeople.reduce((sum, p) => sum + p.progressPercentage, 0) / deptPeople.length)
            : 0,
          avgAttendance: deptPeople.length
            ? Math.round(deptPeople.reduce((sum, p) => sum + p.attendancePercentage, 0) / deptPeople.length)
            : 0,
        };
      });

      setStats({ totalPeople, avgProgress, avgAttendance, departmentStats });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

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
          <Title level={2}>Reports Overview</Title>
          <Text type="secondary">Church-wide statistics and insights</Text>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="Total People"
                value={stats.totalPeople}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="Average Progress"
                value={stats.avgProgress}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="Average Attendance"
                value={stats.avgAttendance}
                suffix="%"
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Department Breakdown" style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {stats.departmentStats.map((dept) => (
              <Col xs={24} md={12} lg={8} key={dept.name}>
                <Card type="inner" title={dept.name}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text><UserOutlined /> People</Text>
                      <Text strong>{dept.totalPeople}</Text>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary">Progress</Text>
                      <Progress percent={dept.avgProgress} strokeColor="#52c41a" />
                    </div>
                    <div>
                      <Text type="secondary">Attendance</Text>
                      <Progress percent={dept.avgAttendance} strokeColor="#1890ff" />
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </div>
    </>
  );
}
