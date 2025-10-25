'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Alert, Button, message } from 'antd';
import { DatabaseOutlined, TableOutlined, UserOutlined, TeamOutlined, HeartOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Paragraph } = Typography;

interface DatabaseInfo {
  tables: {
    users: number;
    groups: number;
    new_converts: number;
    progress_records: number;
    attendance_records: number;
  };
  totalRecords: number;
}

export default function DatabaseManagementPage() {
  const { token } = useAuth();
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchDatabaseInfo();
    }
  }, [token]);

  const fetchDatabaseInfo = async () => {
    try {
      const response = await fetch('/api/superadmin/database/info', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setDbInfo(data);
    } catch (error) {
      message.error('Failed to fetch database info');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !dbInfo) {
    return <div>Loading database information...</div>;
  }

  return (
    <div>
      <Title level={2}>
        <DatabaseOutlined /> Database Management
      </Title>

      <Alert
        message="Database Information"
        description="View and monitor your database statistics. Your data is securely stored in Neon Database."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total Records"
              value={dbInfo.totalRecords}
              prefix={<TableOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Database Status"
              value="Connected"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Database Type"
              value="PostgreSQL"
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Title level={4}>Table Statistics</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Users"
              value={dbInfo.tables.users}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Groups"
              value={dbInfo.tables.groups}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="New Converts"
              value={dbInfo.tables.new_converts}
              prefix={<HeartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Progress Records"
              value={dbInfo.tables.progress_records}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Attendance Records"
              value={dbInfo.tables.attendance_records}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Database Information" style={{ marginTop: 24 }}>
        <Paragraph>
          <strong>Database Provider:</strong> Neon Database (Serverless PostgreSQL)
        </Paragraph>
        <Paragraph>
          <strong>Connection:</strong> Pooled connection for optimal performance
        </Paragraph>
        <Paragraph>
          <strong>Location:</strong> US East (AWS)
        </Paragraph>
        <Paragraph>
          <strong>Backup:</strong> Automatic backups managed by Neon Database
        </Paragraph>
        <Alert
          message="Backup Recommendation"
          description="Neon Database automatically backs up your data. For additional safety, consider exporting your data regularly using the export features in each management section."
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>
    </div>
  );
}
