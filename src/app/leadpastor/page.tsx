'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Spin, Collapse, Tag, Space, Button } from 'antd';
import { CalendarOutlined, DownOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { CURRENT_YEAR } from '@/lib/constants';
import { api } from '@/lib/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface Group {
  id: string;
  name: string;
  description: string;
  year: number;
  archived: boolean;
  leader_name: string;
  member_count: number;
}

interface GroupsByYear {
  [year: number]: Group[];
}

export default function LeadPastorDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKeys, setActiveKeys] = useState<string[]>([CURRENT_YEAR.toString()]);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'leadpastor' && user.role !== 'overseer'))) {
      console.log('[LEAD-PASTOR] Unauthorized access attempt, redirecting to home');
      router.push('/');
      return;
    }

    if (user && token) {
      fetchGroups();
    }
  }, [user, authLoading, router, token]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await api.groups.list({ active: true });

      if (!response.success) throw new Error('Failed to fetch groups');

      setGroups(response.data?.groups || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups([]);
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

  // Organize groups by year
  const groupsByYear: GroupsByYear = groups.reduce((acc: GroupsByYear, group: any) => {
    if (!acc[group.year]) {
      acc[group.year] = [];
    }
    acc[group.year].push(group);
    return acc;
  }, {} as GroupsByYear);

  // Month order for sorting
  const monthOrder: { [key: string]: number } = {
    january: 1, february: 2, march: 3, april: 4,
    may: 5, june: 6, july: 7, august: 8,
    september: 9, october: 10, november: 11, december: 12,
  };

  // Sort groups within each year by month order
  Object.keys(groupsByYear).forEach((year) => {
    groupsByYear[parseInt(year, 10)].sort((a, b) => {
      const aOrder = monthOrder[a.name.toLowerCase()] || 999;
      const bOrder = monthOrder[b.name.toLowerCase()] || 999;
      return aOrder - bOrder;
    });
  });

  // Sort years in descending order
  const sortedYears = Object.keys(groupsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  // Navigate lead pastor directly to the group-scoped app route
  const handleGroupClick = (groupId: string) => {
    router.push(`/${groupId}`);
  };

  const getGroupColor = (index: number) => {
    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#13c2c2',
      '#eb2f96', '#722ed1', '#fa8c16', '#2f54eb',
      '#fa541c', '#1890ff', '#722ed1', '#52c41a',
    ];
    return colors[index % colors.length];
  };

  return (
    <>
      <div style={{ padding: '0 24px' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <Title level={2}>Lead Pastor Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Select a group to view milestone tracking and attendance
          </Text>
        </div>

        {sortedYears.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Text type="secondary">No groups found</Text>
          </div>
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
            expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
            style={{ background: 'transparent', border: 'none' }}
          >
            {sortedYears.map((year) => (
              <Panel
                header={(
                  <Space>
                    <CalendarOutlined style={{ fontSize: 20 }} />
                    <Text strong style={{ fontSize: 18 }}>
                      {year}
                    </Text>
                    <Tag color={year === CURRENT_YEAR ? 'blue' : 'default'}>
                      {groupsByYear[year].length} {groupsByYear[year].length === 1 ? 'group' : 'groups'}
                    </Tag>
                    {year === CURRENT_YEAR && (
                      <Tag color="green">Current Year</Tag>
                    )}
                  </Space>
                )}
                key={year.toString()}
                style={{
                  marginBottom: 16,
                  borderRadius: 8,
                  border: '1px solid #d9d9d9',
                  background: '#fff',
                }}
              >
                <Row gutter={[24, 24]} style={{ paddingTop: 8 }}>
                  {groupsByYear[year].map((group, index) => (
                    <Col xs={24} sm={12} md={8} lg={6} key={group.id}>
                      <Card
                        hoverable
                        onClick={() => handleGroupClick(group.id)}
                        style={{
                          borderRadius: 12,
                          border: `2px solid ${getGroupColor(index)}`,
                          transition: 'all 0.3s',
                          cursor: 'pointer',
                        }}
                        bodyStyle={{
                          padding: '20px 16px',
                          textAlign: 'center',
                        }}
                      >
                        <CalendarOutlined
                          style={{
                            fontSize: 36,
                            color: getGroupColor(index),
                            marginBottom: 12,
                          }}
                        />
                        <Title level={3} style={{ margin: '0 0 8px 0', color: getGroupColor(index), fontWeight: 700 }}>
                          {group.name}
                        </Title>
                        <Space direction="vertical" size={2} style={{ width: '100%', marginTop: 6 }}>
                          {group.leader_name && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Leader: {group.leader_name}
                            </Text>
                          )}
                          <Space size={4}>
                            <TeamOutlined style={{ fontSize: 11 }} />
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                            </Text>
                          </Space>
                        </Space>
                        <div style={{ marginTop: 10 }}>
                          <Text strong style={{ fontSize: 13, color: getGroupColor(index) }}>
                            View Dashboard →
                          </Text>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Panel>
            ))}
          </Collapse>
        )}
      </div>
    </>
  );
}
