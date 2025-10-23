'use client';

import { Card, Typography, Descriptions, Alert, Button, Space } from 'antd';
import { SettingOutlined, SafetyOutlined, DatabaseOutlined, BellOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function SettingsPage() {
  return (
    <div>
      <Title level={2}>
        <SettingOutlined /> System Settings
      </Title>

      <Alert
        message="System Configuration"
        description="View and manage your system settings and configuration."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title={<><DatabaseOutlined /> Database Configuration</>} style={{ marginBottom: 16 }}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Database Provider">Neon Database</Descriptions.Item>
          <Descriptions.Item label="Database Type">PostgreSQL (Serverless)</Descriptions.Item>
          <Descriptions.Item label="Connection Type">Pooled Connection</Descriptions.Item>
          <Descriptions.Item label="Location">US East (AWS)</Descriptions.Item>
          <Descriptions.Item label="SSL Mode">Required</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<><SafetyOutlined /> Security Settings</>} style={{ marginBottom: 16 }}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="JWT Authentication">Enabled</Descriptions.Item>
          <Descriptions.Item label="Password Hashing">BCrypt (10 rounds)</Descriptions.Item>
          <Descriptions.Item label="Session Timeout">24 hours</Descriptions.Item>
          <Descriptions.Item label="HTTPS">Required in production</Descriptions.Item>
        </Descriptions>
        <Paragraph style={{ marginTop: 16 }}>
          <Alert
            message="Security Recommendation"
            description="Ensure you change the JWT_SECRET environment variable in production and use strong passwords for all accounts."
            type="warning"
            showIcon
          />
        </Paragraph>
      </Card>

      <Card title={<><BellOutlined /> Application Information</>}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Application Name">FLC Sheep Seeking</Descriptions.Item>
          <Descriptions.Item label="Version">1.0.0</Descriptions.Item>
          <Descriptions.Item label="Environment">{process.env.NODE_ENV || 'development'}</Descriptions.Item>
          <Descriptions.Item label="Framework">Next.js 14</Descriptions.Item>
          <Descriptions.Item label="UI Library">Ant Design</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
