'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Typography, Spin, message, Row, Col, theme, Empty, Select } from 'antd';
import { CheckCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTheme } from '@/components/AppConfigProvider';
import { CURRENT_YEAR } from '@/lib/constants';

const { Title, Text } = Typography;
const { useToken } = theme;

export default function GroupSelector() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const { isDark } = useTheme();
  const { token: antdToken } = useToken();

  useEffect(() => {
    if (!authLoading && user?.role === 'superadmin') {
      // Superadmin should go to superadmin dashboard
      router.push('/superadmin');
      return;
    }

    if (!authLoading && user?.role === 'leadpastor') {
      // Leadpastors use different selector
      router.push('/leadpastor');
      return;
    }

    if (!authLoading && (!user || (user.role !== 'admin' && user.role !== 'leader'))) {
      // Only admin/leader can access this
      router.push('/auth');
      return;
    }

    if (user && token) {
      fetchGroups();
    }
  }, [user, token, authLoading, router]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await api.groups.list({ active: true });

      if (!response.success) {
        throw new Error('Failed to fetch groups');
      }

      // For admin/leader, filter by their assigned group name (month)
      const userGroupName = user?.group_name;
      const availableGroups = userGroupName
        ? (response.data?.groups || []).filter((g: any) => 
            g.name.toLowerCase() === userGroupName.toLowerCase()
          )
        : [];

      // Sort by year descending (newest first), then by name
      availableGroups.sort((a: any, b: any) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.name.localeCompare(b.name);
      });

      setAllGroups(availableGroups);

      // Extract unique years
      const years = Array.from(new Set<number>(availableGroups.map((g: any) => Number(g.year)))).sort((a: number, b: number) => b - a);
      setAvailableYears(years);

      // Filter by selected year
      filterGroupsByYear(availableGroups, selectedYear);
    } catch (error: any) {
      console.error('Failed to fetch groups:', error);
      message.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const filterGroupsByYear = (groupsToFilter: any[], year: number) => {
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
    // Navigate to the group's dashboard
    setTimeout(() => {
      router.push(`/${groupId}`);
    }, 300);
  };

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Loading groups..." />
      </div>
    );
  }

  // Check if there are any groups at all (not just for selected year)
  if (allGroups.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <Card style={{ maxWidth: 600, width: '100%' }}>
          <Empty
            description="No groups available"
            style={{ marginTop: '50px', marginBottom: '50px' }}
          />
          <div style={{ textAlign: 'center' }}>
            <Text>No groups are currently available.</Text>
            <br />
            <Button type="primary" onClick={() => router.push('/auth')} style={{ marginTop: '20px' }}>
              Back to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

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
