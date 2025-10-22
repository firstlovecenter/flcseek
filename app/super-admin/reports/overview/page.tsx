'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Spin, Progress, Statistic } from 'antd';
import { UserOutlined, TeamOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { ATTENDANCE_GOAL, TOTAL_PROGRESS_STAGES } from '@/lib/constants';
import { usePeopleWithStats, useDepartmentSummary } from '@/hooks/use-fetch';

const { Title, Text } = Typography;

interface DepartmentStats {
  name: string;
  totalPeople: number;
  avgProgress: number;
  avgAttendance: number;
}

export default function ReportsOverviewPage() {
  const { token } = useAuth();
  
  // Use optimized hooks for data fetching
  const { data: peopleData, loading: peopleLoading } = usePeopleWithStats(token);
  const { data: summaryData, loading: summaryLoading } = useDepartmentSummary(token);
  
  const people = peopleData?.people || [];
  const departmentStats = summaryData?.summary || [];
  const loading = peopleLoading || summaryLoading;

  // Calculate overall stats
  const totalPeople = people.length;
  const avgProgress = totalPeople > 0
    ? Math.round(people.reduce((sum: number, p: any) => sum + (p.progress_percentage || 0), 0) / totalPeople)
    : 0;
  const avgAttendance = totalPeople > 0
    ? Math.round(people.reduce((sum: number, p: any) => sum + (p.attendance_percentage || 0), 0) / totalPeople)
    : 0;

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
                value={totalPeople}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="Average Progress"
                value={avgProgress}
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
                value={avgAttendance}
                suffix="%"
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Department Breakdown" style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {departmentStats.map((dept: any) => (
              <Col xs={24} md={12} lg={8} key={dept.group}>
                <Card type="inner" title={dept.group}>
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
