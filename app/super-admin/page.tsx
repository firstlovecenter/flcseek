'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Statistic, Button, Layout, Spin, message } from 'antd';
import {
  TeamOutlined,
  TrophyOutlined,
  CalendarOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const { Title, Text } = Typography;
const { Header, Content } = Layout;

interface DepartmentSummary {
  department: string;
  totalPeople: number;
  avgProgress: number;
  avgAttendance: number;
}

export default function SuperAdminDashboard() {
  const { user, token, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'super_admin')) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchSummary();
    }
  }, [user, token, authLoading, router]);

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/departments/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch summary');

      const data = await response.json();
      setSummary(data.summary);
    } catch (error: any) {
      message.error(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout className="min-h-screen">
      <Header
        style={{
          background: '#003366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          FLC Sheep Seeking - Super Admin
        </Title>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={logout}
          style={{ color: 'white' }}
        >
          Logout
        </Button>
      </Header>

      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <Title level={2}>Department Overview</Title>
            <Text type="secondary">
              Track progress and attendance across all 12 departments
            </Text>
          </div>

          <Row gutter={[16, 16]}>
            {summary.map((dept) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={dept.department}>
                <Link
                  href={`/super-admin/department/${dept.department}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Card
                    hoverable
                    style={{
                      height: '100%',
                      borderRadius: 8,
                      transition: 'all 0.3s ease',
                    }}
                    styles={{
                      body: { padding: 24 },
                    }}
                  >
                    <Title level={4} style={{ color: '#003366', marginBottom: 16 }}>
                      {dept.department}
                    </Title>

                    <div style={{ marginBottom: 16 }}>
                      <Statistic
                        title="Total Members"
                        value={dept.totalPeople}
                        prefix={<TeamOutlined />}
                        valueStyle={{ color: '#003366', fontSize: 24 }}
                      />
                    </div>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Statistic
                          title="Avg Progress"
                          value={dept.avgProgress}
                          suffix="%"
                          prefix={<TrophyOutlined />}
                          valueStyle={{
                            color: dept.avgProgress >= 50 ? '#00b300' : '#ff7700',
                            fontSize: 20,
                          }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="Avg Attendance"
                          value={dept.avgAttendance}
                          suffix="%"
                          prefix={<CalendarOutlined />}
                          valueStyle={{
                            color: dept.avgAttendance >= 50 ? '#00b300' : '#ff7700',
                            fontSize: 20,
                          }}
                        />
                      </Col>
                    </Row>

                    <div style={{ marginTop: 16 }}>
                      <Button type="primary" block>
                        View Department
                      </Button>
                    </div>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        </div>
      </Content>
    </Layout>
  );
}
