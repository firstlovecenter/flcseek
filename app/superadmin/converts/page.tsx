'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Card, Typography, Tag, Statistic, Row, Col } from 'antd';
import { HeartOutlined, SearchOutlined, UserOutlined, CalendarOutlined, TeamOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const { Title } = Typography;
const { Option } = Select;

interface Convert {
  id: string;
  full_name: string;
  phone_number: string;
  gender: string | null;
  group_name: string;
  registered_by_name: string;
  created_at: string;
  completed_stages: number;
  total_attendance: number;
}

interface Stats {
  totalConverts: number;
  thisMonth: number;
  thisWeek: number;
  activeGroups: number;
}

export default function NewConvertsManagementPage() {
  const { token } = useAuth();
  const [converts, setConverts] = useState<Convert[]>([]);
  const [filteredConverts, setFilteredConverts] = useState<Convert[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalConverts: 0,
    thisMonth: 0,
    thisWeek: 0,
    activeGroups: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    if (token) {
      fetchConverts();
      fetchStats();
    }
  }, [token]);

  useEffect(() => {
    filterConverts();
  }, [converts, searchText, groupFilter]);

  const fetchConverts = async () => {
    try {
      const response = await fetch('/api/superadmin/converts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setConverts(data.converts || []);
      setFilteredConverts(data.converts || []);
      
      // Extract unique groups
      const uniqueGroups = Array.from(new Set(data.converts.map((c: Convert) => c.group_name))) as string[];
      setGroups(uniqueGroups);
    } catch (error) {
      console.error('Failed to fetch converts');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/superadmin/converts/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Failed to fetch stats');
    }
  };

  const filterConverts = () => {
    let filtered = [...converts];

    if (searchText) {
      filtered = filtered.filter(
        (convert) =>
          convert.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
          convert.phone_number.includes(searchText)
      );
    }

    if (groupFilter !== 'all') {
      filtered = filtered.filter((convert) => convert.group_name === groupFilter);
    }

    setFilteredConverts(filtered);
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/superadmin/converts/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `converts-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export');
    }
  };

  const columns = [
    {
      title: 'Full Name',
      dataIndex: 'full_name',
      key: 'full_name',
      sorter: (a: Convert, b: Convert) => a.full_name.localeCompare(b.full_name),
      render: (fullName: string, record: Convert) => (
        <Link
          href={`/superadmin/converts/${record.id}`}
          style={{
            color: '#1890ff',
            textDecoration: 'none',
            fontWeight: '500',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          {fullName}
        </Link>
      ),
    },
    {
      title: 'Phone Number',
      dataIndex: 'phone_number',
      key: 'phone_number',
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender: string) => gender || '-',
    },
    {
      title: 'Group',
      dataIndex: 'group_name',
      key: 'group_name',
      render: (group: string) => <Tag color="blue"><TeamOutlined /> {group}</Tag>,
    },
    {
      title: 'Registered By',
      dataIndex: 'registered_by_name',
      key: 'registered_by_name',
      render: (name: string) => <Tag color="green"><UserOutlined /> {name}</Tag>,
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: Convert) => (
        <div>
          <div>Stages: {record.completed_stages}/15</div>
          <div>Attendance: {record.total_attendance}</div>
        </div>
      ),
    },
    {
      title: 'Registered Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a: Convert, b: Convert) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
  ];

  return (
    <div>
      <Title level={2}>
        <HeartOutlined /> New Converts Management
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Converts"
              value={stats.totalConverts}
              prefix={<HeartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="This Month"
              value={stats.thisMonth}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="This Week"
              value={stats.thisWeek}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Groups"
              value={stats.activeGroups}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search by name or phone..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            value={groupFilter}
            onChange={setGroupFilter}
            style={{ width: 200 }}
          >
            <Option value="all">All Groups</Option>
            {groups.map((group) => (
              <Option key={group} value={group}>
                {group}
              </Option>
            ))}
          </Select>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Link href="/superadmin/converts/bulk-delete">
            <Button
              danger
              icon={<DeleteOutlined />}
              type="primary"
            >
              Bulk Delete
            </Button>
          </Link>
        </Space>
      </Card>

      <Table
        dataSource={filteredConverts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} converts` }}
      />
    </div>
  );
}
