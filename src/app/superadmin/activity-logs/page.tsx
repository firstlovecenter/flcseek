'use client';

import { useEffect, useState } from 'react';
import { 
  Card, 
  Table, 
  Select, 
  Input, 
  DatePicker, 
  Space, 
  Tag, 
  Typography, 
  Row, 
  Col, 
  Statistic,
  Button,
  Empty
} from 'antd';
import { 
  HistoryOutlined, 
  UserOutlined, 
  FileTextOutlined,
  ReloadOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;
const { RangePicker } = DatePicker;

interface ActivityLog {
  id: string;
  user_id: string;
  username?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: any;
  created_at: string;
  ip_address?: string;
}

interface ActivitySummary {
  totalActions: number;
  uniqueUsers: number;
  byAction: Record<string, number>;
  byEntityType: Record<string, number>;
}

const actionColors: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  LOGIN: 'purple',
  LOGOUT: 'default',
  EXPORT: 'orange',
  VIEW: 'cyan',
};

const entityTypeLabels: Record<string, string> = {
  convert: 'Convert',
  progress: 'Progress',
  attendance: 'Attendance',
  user: 'User',
  group: 'Group',
  milestone: 'Milestone',
  system: 'System',
};

export default function ActivityLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (token) {
      fetchLogs();
      fetchSummary();
    }
  }, [token, entityTypeFilter, actionFilter, limit, offset]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('type', 'logs');
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      if (entityTypeFilter) params.append('entity_type', entityTypeFilter);
      if (actionFilter) params.append('action', actionFilter);

      const response = await fetch(`/api/superadmin/activity-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setHasMore(data.pagination?.hasMore || false);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const response = await fetch('/api/superadmin/activity-logs?type=summary&days=7', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleRefresh = () => {
    setOffset(0);
    fetchLogs();
    fetchSummary();
  };

  const handleLoadMore = () => {
    setOffset(prev => prev + limit);
  };

  const columns = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => (
        <div>
          <Text style={{ fontSize: 12 }}>{dayjs(date).format('MMM D, HH:mm')}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(date).fromNow()}</Text>
        </div>
      ),
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string, record: ActivityLog) => (
        <Space>
          <UserOutlined />
          <Text>{username || record.user_id?.substring(0, 8) || 'System'}</Text>
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => (
        <Tag color={actionColors[action] || 'default'}>
          {action}
        </Tag>
      ),
    },
    {
      title: 'Entity',
      dataIndex: 'entity_type',
      key: 'entity_type',
      width: 120,
      render: (entityType: string, record: ActivityLog) => (
        <div>
          <Tag icon={<FileTextOutlined />}>
            {entityTypeLabels[entityType] || entityType}
          </Tag>
          {record.entity_id && (
            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
              {record.entity_id.substring(0, 8)}...
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (details: any) => {
        if (!details) return <Text type="secondary">-</Text>;
        
        const detailStr = typeof details === 'string' ? details : JSON.stringify(details);
        return (
          <Text 
            ellipsis={{ tooltip: detailStr }}
            style={{ maxWidth: 200, fontSize: 12 }}
          >
            {detailStr.substring(0, 50)}{detailStr.length > 50 ? '...' : ''}
          </Text>
        );
      },
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 100,
      render: (ip: string) => (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {ip || '-'}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>
          <HistoryOutlined style={{ marginRight: 8 }} />
          Activity Logs
        </Title>
        <Text type="secondary">
          View all system activity and user actions
        </Text>
      </div>

      {/* Summary Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card loading={summaryLoading}>
            <Statistic 
              title="Total Actions (7 days)" 
              value={summary?.totalActions || 0}
              prefix={<HistoryOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={summaryLoading}>
            <Statistic 
              title="Active Users" 
              value={summary?.uniqueUsers || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={summaryLoading}>
            <Statistic 
              title="Create Actions" 
              value={summary?.byAction?.CREATE || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card loading={summaryLoading}>
            <Statistic 
              title="Update Actions" 
              value={summary?.byAction?.UPDATE || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <FilterOutlined />
          <Select
            placeholder="Entity Type"
            allowClear
            style={{ width: 150 }}
            value={entityTypeFilter || undefined}
            onChange={(val) => { setEntityTypeFilter(val || ''); setOffset(0); }}
          >
            <Option value="convert">Converts</Option>
            <Option value="progress">Progress</Option>
            <Option value="attendance">Attendance</Option>
            <Option value="user">Users</Option>
            <Option value="group">Groups</Option>
          </Select>

          <Select
            placeholder="Action"
            allowClear
            style={{ width: 120 }}
            value={actionFilter || undefined}
            onChange={(val) => { setActionFilter(val || ''); setOffset(0); }}
          >
            <Option value="CREATE">Create</Option>
            <Option value="UPDATE">Update</Option>
            <Option value="DELETE">Delete</Option>
            <Option value="LOGIN">Login</Option>
            <Option value="EXPORT">Export</Option>
          </Select>

          <Select
            value={limit}
            style={{ width: 100 }}
            onChange={setLimit}
          >
            <Option value={25}>25 rows</Option>
            <Option value={50}>50 rows</Option>
            <Option value={100}>100 rows</Option>
          </Select>

          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Logs Table */}
      <Card>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 800 }}
          locale={{
            emptyText: (
              <Empty 
                description="No activity logs found"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
        
        {/* Load More */}
        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button onClick={handleLoadMore} loading={loading}>
              Load More
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
