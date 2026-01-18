'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Typography, Spin, message, Row, Col, theme, Empty, Select, Collapse, Tag, Space, Checkbox } from 'antd';
import { CheckCircleOutlined, TeamOutlined, CalendarOutlined, DownOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTheme } from '@/components/AppConfigProvider';
import { CURRENT_YEAR } from '@/lib/constants';

const { Title, Text } = Typography;
const { useToken } = theme;
const { Panel } = Collapse;

interface Group {
  id: string;
  name: string;
  description?: string;
  year: number;
  archived: boolean;
  leader_name?: string;
  member_count?: number;
}

interface GroupsByYear {
  [year: number]: Group[];
}

export default function RootPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [activeKeys, setActiveKeys] = useState<string[]>([CURRENT_YEAR.toString()]);
  const { isDark } = useTheme();
  const { token: antdToken } = useToken();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        // Not logged in - redirect to login
        router.push('/auth');
        return;
      } else if (user.role === 'superadmin') {
        // Superadmin goes to superadmin dashboard
        router.push('/superadmin');
        return;
      } else if (user.group_id) {
        // Admin/leader with single group_id goes directly to their group
        router.push(`/${user.group_id}`);
        return;
      } else {
        // Admin/leader/leadpastor/overseer without group_id or multi-group needs selector
        fetchGroups();
      }
    }
  }, [user, authLoading, router]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await api.groups.list({ active: true });

      if (!response.success) {
        throw new Error('Failed to fetch groups');
      }

      let fetchedGroups = response.data?.groups || [];

      // For admin/leader with assigned group name, filter by that group
      if ((user?.role === 'admin' || user?.role === 'leader') && user?.group_name) {
        fetchedGroups = fetchedGroups.filter((g: any) => 
          g.name.toLowerCase() === user.group_name.toLowerCase()
        );
      }

      // Sort by year descending, then by name
      fetchedGroups.sort((a: any, b: any) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.name.localeCompare(b.name);
      });

      setAllGroups(fetchedGroups);

      // Extract unique years
      const years = Array.from(new Set<number>(fetchedGroups.map((g: any) => Number(g.year)))).sort((a: number, b: number) => b - a);
      setAvailableYears(years);
      setActiveKeys([CURRENT_YEAR.toString()]);

      // Filter by selected year
      filterGroupsByYear(fetchedGroups, selectedYear);
    } catch (error: any) {
      console.error('Failed to fetch groups:', error);
      message.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const filterGroupsByYear = (groupsToFilter: Group[], year: number) => {
    const filtered = groupsToFilter.filter((g: any) => g.year === year);
    setGroups(filtered);
  };

  useEffect(() => {
    if (allGroups.length > 0) {
      filterGroupsByYear(allGroups, selectedYear);
    }
  }, [selectedYear, allGroups]);

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setTimeout(() => {
      router.push(`/${groupId}`);
    }, 300);
  };

  const getGroupColor = (index: number) => {
    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#13c2c2',
      '#eb2f96', '#722ed1', '#fa8c16', '#2f54eb',
      '#fa541c', '#1890ff', '#722ed1', '#52c41a',
    ];
    return colors[index % colors.length];
  };

  const monthOrder: { [key: string]: number } = {
    january: 1, february: 2, march: 3, april: 4,
    may: 5, june: 6, july: 7, august: 8,
    september: 9, october: 10, november: 11, december: 12,
  };

  // Organize groups by year for leadpastor/overseer view
  const groupsByYear: GroupsByYear = allGroups.reduce((acc: GroupsByYear, group: any) => {
    if (!acc[group.year]) {
      acc[group.year] = [];
    }
    acc[group.year].push(group);
    return acc;
  }, {} as GroupsByYear);

  // Sort groups within each year by month order
  Object.keys(groupsByYear).forEach((year) => {
    groupsByYear[parseInt(year, 10)].sort((a, b) => {
      const aOrder = monthOrder[a.name.toLowerCase()] || 999;
      const bOrder = monthOrder[b.name.toLowerCase()] || 999;
      return aOrder - bOrder;
    });
  });

  const sortedYears = Object.keys(groupsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show leadpastor/overseer view with collapsible years
  if (user.role === 'leadpastor' || user.role === 'overseer') {
    return (
      <div style={{ padding: '0 24px', minHeight: '100vh' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <Title level={2}>Select Your Group</Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            Choose a group to view milestone tracking and attendance
          </Text>
        </div>

        {sortedYears.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Empty description="No groups found" />
          </div>
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
            expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
            style={{ background: 'transparent', border: 'none', maxWidth: 1200, margin: '0 auto' }}
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
                        onClick={() => handleSelectGroup(group.id)}
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
    );
  }

  // Show admin/leader view with year filter
  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px', background: isDark ? '#0a0a0a' : '#f5f5f5' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <TeamOutlined /> Select Your Group
          </Title>
          <Text type="secondary">
            Choose which group and year you want to manage
          </Text>
          
          {availableYears.length > 1 && (
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
              <Text>Filter by Year:</Text>
              <Select
                value={selectedYear}
                onChange={setSelectedYear}
                style={{ width: 120 }}
                options={availableYears.map(year => ({ label: year, value: year }))}
              />
            </div>
          )}
        </div>

        <Row gutter={[24, 24]}>
          {groups.length === 0 ? (
            <Col span={24}>
              <Empty
                description={`No groups found for year ${selectedYear}`}
                style={{ marginTop: '50px' }}
              >
                <Text type="secondary">Try selecting a different year</Text>
              </Empty>
            </Col>
          ) : (
            groups.map((group) => (
            <Col key={group.id} xs={24} sm={12} md={8}>
              <Card
                hoverable
                style={{
                  cursor: 'pointer',
                  borderRadius: 12,
                  border: selectedGroupId === group.id ? `2px solid ${antdToken.colorPrimary}` : undefined,
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                  transition: 'all 0.3s',
                }}
                onClick={() => handleSelectGroup(group.id)}
              >
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: antdToken.colorPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      color: 'white',
                      fontSize: 24,
                    }}
                  >
                    <TeamOutlined />
                  </div>
                  <Title level={4} style={{ marginBottom: 8 }}>
                    {group.name}
                  </Title>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Year: {group.year}
                  </Text>
                  {selectedGroupId === group.id && (
                    <div style={{ color: antdToken.colorSuccess, marginBottom: 12 }}>
                      <CheckCircleOutlined /> Selected
                    </div>
                  )}
                  <Button
                    type={selectedGroupId === group.id ? 'primary' : 'default'}
                    block
                    onClick={() => handleSelectGroup(group.id)}
                  >
                    Enter Group
                  </Button>
                </div>
              </Card>
            </Col>
          )))}
        </Row>
      </div>
    </div>
  );
}
