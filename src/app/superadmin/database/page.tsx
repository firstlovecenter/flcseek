'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Alert, Button, message, Tabs, Table, Modal, Form, Input, Select, Popconfirm, Tag } from 'antd';
import { DatabaseOutlined, TableOutlined, UserOutlined, TeamOutlined, HeartOutlined, CheckCircleOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;

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

interface TableSchema {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  position: number;
}

export default function DatabaseManagementPage() {
  const { token, user } = useAuth();
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<Record<string, TableSchema[]>>({});
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });

  // Decode token to get username
  const getUsernameFromToken = (): string | null => {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map((c) => 
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')
      );
      return JSON.parse(jsonPayload).username;
    } catch (e) {
      return null;
    }
  };

  const username = getUsernameFromToken();
  const isSkaduteye = username === 'skaduteye' || username === 'sysadmin';

  useEffect(() => {
    if (token) {
      fetchDatabaseInfo();
      fetchSchema();
    }
  }, [token]);

  useEffect(() => {
    if (selectedTable && token) {
      fetchTableData(selectedTable, pagination.current);
    }
  }, [selectedTable, pagination.current]);

  const fetchSchema = async () => {
    try {
      const response = await fetch('/api/superadmin/database/schema', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSchema(data.schema || {});
    } catch (error) {
      message.error('Failed to fetch database schema');
    }
  };

  const fetchTableData = async (tableName: string, page: number = 1) => {
    setTableLoading(true);
    try {
      const response = await fetch('/api/superadmin/database/table-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tableName,
          limit: pagination.pageSize,
          offset: (page - 1) * pagination.pageSize,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch table data');
      }
      
      setTableData(data.data || []);
      setPagination(prev => ({ ...prev, total: data.total, current: page }));
    } catch (error: any) {
      console.error('Error fetching table data:', error);
      message.error(error.message || 'Failed to fetch table data');
    } finally {
      setTableLoading(false);
    }
  };

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

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleView = (record: any) => {
    setEditingRecord(record);
    setViewModalVisible(true);
  };

  const handleUpdate = async (values: any) => {
    try {
      const idField = selectedTable === 'milestones' ? 'stage_number' : 'id';
      const response = await fetch('/api/superadmin/database/edit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tableName: selectedTable,
          id: editingRecord[idField],
          updates: values,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update record');
      }

      message.success('Record updated successfully');
      setEditModalVisible(false);
      fetchTableData(selectedTable, pagination.current);
    } catch (error: any) {
      message.error(error.message || 'Failed to update record');
    }
  };

  const handleDelete = async (record: any) => {
    try {
      const idField = selectedTable === 'milestones' ? 'stage_number' : 'id';
      const response = await fetch(`/api/superadmin/database/edit?table=${selectedTable}&id=${record[idField]}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete record');
      }

      message.success('Record deleted successfully');
      fetchTableData(selectedTable, pagination.current);
    } catch (error: any) {
      message.error(error.message || 'Failed to delete record');
    }
  };

  const getTableColumns = (tableName: string) => {
    const columns = schema[tableName] || [];
    const idField = tableName === 'milestones' ? 'stage_number' : 'id';
    
    // Show all columns for attendance_records, limit others to prevent overwhelming display
    const columnLimit = tableName === 'attendance_records' ? columns.length : 8;
    
    const tableColumns: any[] = columns.slice(0, columnLimit).map(col => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      ellipsis: true,
      width: col.name === 'id' || col.name === 'person_id' ? 120 : undefined, // Ensure ID columns are visible
      render: (text: any) => {
        if (text === null || text === undefined) return <Text type="secondary">NULL</Text>;
        if (typeof text === 'boolean') return text ? <Tag color="green">true</Tag> : <Tag color="red">false</Tag>;
        if (typeof text === 'object') return JSON.stringify(text).substring(0, 50) + '...';
        return String(text).substring(0, 100);
      },
    }));

    tableColumns.push({
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      width: 150,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            View
          </Button>
          {isSkaduteye && (
            <>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
              <Popconfirm
                title="Are you sure you want to delete this record?"
                onConfirm={() => handleDelete(record)}
                okText="Yes"
                cancelText="No"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </div>
      ),
    });

    return tableColumns;
  };

  if (loading || !dbInfo) {
    return <div>Loading database information...</div>;
  }

  const tables = Object.keys(schema).sort();

  return (
    <div>
      <Title level={2}>
        <DatabaseOutlined /> Database Management
      </Title>

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
              title="Total Tables"
              value={tables.length}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#52c41a' }}
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
      </Row>

      <Card title="Database Tables & Data" style={{ marginBottom: 24 }}>
        <Tabs activeKey={selectedTable} onChange={setSelectedTable}>
          {tables.map(table => (
            <TabPane tab={table} key={table}>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Columns ({schema[table]?.length || 0}):</Text>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {schema[table]?.map(col => (
                    <Tag key={col.name} color="blue">
                      {col.name} <Text type="secondary" style={{ fontSize: 11 }}>({col.type})</Text>
                    </Tag>
                  ))}
                </div>
              </div>
              
              <Table
                dataSource={tableData}
                columns={getTableColumns(table)}
                loading={tableLoading}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} records`,
                }}
                onChange={(newPagination) => {
                  setPagination(prev => ({
                    ...prev,
                    current: newPagination.current || 1,
                    pageSize: newPagination.pageSize || 50,
                  }));
                }}
                rowKey={(record) => {
                  const idField = table === 'milestones' ? 'stage_number' : 'id';
                  return record[idField];
                }}
                scroll={{ x: 'max-content' }}
                size="small"
              />
            </TabPane>
          ))}
        </Tabs>
      </Card>

      {/* Edit Modal */}
      <Modal
        title={`Edit Record in ${selectedTable}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdate}
        >
          {schema[selectedTable]?.filter(col => col.name !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at').map(col => (
            <Form.Item
              key={col.name}
              name={col.name}
              label={`${col.name} (${col.type})`}
            >
              {col.type === 'boolean' ? (
                <Select>
                  <Select.Option value={true}>true</Select.Option>
                  <Select.Option value={false}>false</Select.Option>
                </Select>
              ) : col.type === 'text' ? (
                <Input.TextArea rows={3} />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Update Record
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal
        title={`View Record from ${selectedTable}`}
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {editingRecord && (
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            {Object.entries(editingRecord).map(([key, value]) => (
              <div key={key} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                <Text strong>{key}:</Text>
                <div style={{ marginTop: 4 }}>
                  {value === null || value === undefined ? (
                    <Text type="secondary">NULL</Text>
                  ) : typeof value === 'boolean' ? (
                    value ? <Tag color="green">true</Tag> : <Tag color="red">false</Tag>
                  ) : typeof value === 'object' ? (
                    <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : (
                    <Text>{String(value)}</Text>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Title level={4} style={{ marginTop: 24 }}>Table Statistics</Title>
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
