'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Card, Typography, Tag, Statistic, Row, Col, Dropdown, message } from 'antd';
import { HeartOutlined, SearchOutlined, UserOutlined, CalendarOutlined, TeamOutlined, DownloadOutlined, DeleteOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { api } from '@/lib/api';

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
  const [totalMilestones, setTotalMilestones] = useState<number>(18); // Default to 18

  useEffect(() => {
    if (token) {
      fetchConverts();
      fetchStats();
      fetchMilestoneCount();
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

  const fetchMilestoneCount = async () => {
    try {
      const response = await api.milestones.list();
      if (response.success) {
        const activeMilestones = response.data?.filter((m: any) => m.is_active) || [];
        setTotalMilestones(activeMilestones.length);
      }
    } catch (error) {
      console.error('Failed to fetch milestone count');
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

  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json', type: 'converts' | 'progress' | 'attendance' | 'all') => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.append('type', type);
      params.append('format', format);
      
      const response = await fetch(`/api/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flcseek-${type}-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success(`Exported ${type} as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to export:', error);
      message.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const exportMenuItems = [
    {
      key: 'converts-csv',
      label: 'Converts (CSV)',
      icon: <FileExcelOutlined />,
      onClick: () => handleExport('csv', 'converts'),
    },
    {
      key: 'converts-json',
      label: 'Converts (JSON)',
      icon: <FileTextOutlined />,
      onClick: () => handleExport('json', 'converts'),
    },
    { type: 'divider' as const },
    {
      key: 'progress-csv',
      label: 'Progress Data (CSV)',
      icon: <FileExcelOutlined />,
      onClick: () => handleExport('csv', 'progress'),
    },
    {
      key: 'attendance-csv',
      label: 'Attendance Data (CSV)',
      icon: <FileExcelOutlined />,
      onClick: () => handleExport('csv', 'attendance'),
    },
    { type: 'divider' as const },
    {
      key: 'all-json',
      label: 'All Data (JSON)',
      icon: <FileTextOutlined />,
      onClick: () => handleExport('json', 'all'),
    },
  ];

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
          <div>Stages: {record.completed_stages}/{totalMilestones}</div>
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
          <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
            >
              Export Data
            </Button>
          </Dropdown>
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
