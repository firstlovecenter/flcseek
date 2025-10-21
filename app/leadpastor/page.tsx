'use client';

import { useEffect } from 'react';
import { Card, Row, Col, Typography, Spin } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

const MONTHS = [
  { name: 'January', color: '#1890ff' },
  { name: 'February', color: '#52c41a' },
  { name: 'March', color: '#faad14' },
  { name: 'April', color: '#13c2c2' },
  { name: 'May', color: '#eb2f96' },
  { name: 'June', color: '#722ed1' },
  { name: 'July', color: '#fa8c16' },
  { name: 'August', color: '#2f54eb' },
  { name: 'September', color: '#52c41a' },
  { name: 'October', color: '#fa541c' },
  { name: 'November', color: '#1890ff' },
  { name: 'December', color: '#722ed1' },
];

export default function LeadPastorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'leadpastor')) {
      console.log('[LEAD-PASTOR] Unauthorized access attempt, redirecting to home');
      router.push('/');
      return;
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const handleMonthClick = (monthName: string) => {
    router.push(`/leadpastor/${monthName.toLowerCase()}`);
  };

  return (
    <>
      <AppBreadcrumb />
      <div style={{ padding: '0 24px' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <Title level={2}>Lead Pastor Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Select a month to view the milestone tracking and attendance
          </Text>
        </div>

        <Row gutter={[24, 24]}>
          {MONTHS.map((month) => (
            <Col xs={24} sm={12} md={8} lg={6} key={month.name}>
              <Card
                hoverable
                onClick={() => handleMonthClick(month.name)}
                style={{
                  borderRadius: 12,
                  border: `2px solid ${month.color}`,
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                }}
                bodyStyle={{
                  padding: '32px 24px',
                  textAlign: 'center',
                }}
              >
                <CalendarOutlined
                  style={{
                    fontSize: 48,
                    color: month.color,
                    marginBottom: 16,
                  }}
                />
                <Title level={3} style={{ margin: 0, color: month.color }}>
                  {month.name}
                </Title>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  View Dashboard
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </>
  );
}
