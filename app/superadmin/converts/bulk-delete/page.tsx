'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Input, Modal, Space, Card, Typography, Tag, Checkbox, message, Divider } from 'antd';
import { DeleteOutlined, WarningOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Paragraph, Text } = Typography;

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

export default function BulkDeleteConvertsPage() {
  const { token } = useAuth();
  const [converts, setConverts] = useState<Convert[]>([]);
  const [filteredConverts, setFilteredConverts] = useState<Convert[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (token) {
      fetchConverts();
    }
  }, [token]);

  useEffect(() => {
    filterConverts();
  }, [converts, searchText]);

  const fetchConverts = async () => {
    try {
      const response = await fetch('/api/superadmin/converts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setConverts(data.converts || []);
      setFilteredConverts(data.converts || []);
    } catch (error) {
      message.error('Failed to fetch converts');
    } finally {
      setLoading(false);
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

    setFilteredConverts(filtered);
  };

  const handleSelectChange = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredConverts.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const performBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    
    if (ids.length === 0) {
      message.warning('No converts selected');
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch('/api/superadmin/converts/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ person_ids: ids }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        message.success(`✅ Deleted ${result.deleted_count} convert(s) and all their related data`);
        setSelectedIds(new Set());
        await fetchConverts();
      } else {
        message.error(`❌ Error: ${result.error || 'Failed to delete'}`);
      }
    } catch (error) {
      message.error('Failed to perform bulk delete');
      console.error(error);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleDeleteClick = () => {
    if (selectedIds.size === 0) {
      message.warning('No converts selected');
      return;
    }

    Modal.confirm({
      title: '⚠️ Confirm Bulk Delete',
      icon: <WarningOutlined />,
      content: (
        <div>
          <Paragraph>
            <strong style={{ color: '#ff4d4f' }}>
              You are about to permanently delete {selectedIds.size} convert(s) and ALL their related data:
            </strong>
          </Paragraph>
          <ul>
            <li>❌ Delete from new_converts table</li>
            <li>❌ Delete from progress_records table</li>
            <li>❌ Delete from attendance_records table</li>
          </ul>
          <Paragraph>
            <strong>This action CANNOT be undone.</strong>
          </Paragraph>
          <Paragraph>
            Selected converts:
            <br />
            {Array.from(selectedIds).slice(0, 5).map((id) => {
              const c = converts.find(x => x.id === id);
              return c ? `• ${c.full_name} (${c.phone_number})\n` : '';
            })}
            {selectedIds.size > 5 && `...and ${selectedIds.size - 5} more`}
          </Paragraph>
        </div>
      ),
      okText: 'Yes, Delete All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        performBulkDelete();
      },
    });
  };

  const columns = [
    {
      title: (
        <Checkbox
          checked={selectedIds.size === filteredConverts.length && filteredConverts.length > 0}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: 'select',
      width: 50,
      render: (_: any, record: Convert) => (
        <Checkbox
          checked={selectedIds.has(record.id)}
          onChange={(e) => handleSelectChange(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone_number',
      key: 'phone_number',
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (text: string) => text || '-',
    },
    {
      title: 'Group',
      dataIndex: 'group_name',
      key: 'group_name',
    },
    {
      title: 'Progress',
      dataIndex: 'completed_stages',
      key: 'completed_stages',
      render: (stages: number) => <Tag color="blue">{stages}/18 stages</Tag>,
    },
    {
      title: 'Attendance',
      dataIndex: 'total_attendance',
      key: 'total_attendance',
      render: (count: number) => <Tag color="cyan">{count} records</Tag>,
    },
  ];

  return (
    <div style={{ padding: '30px' }}>
      <Card>
        <Title level={2}>
          <DeleteOutlined style={{ color: '#ff4d4f' }} /> Bulk Delete New Converts
        </Title>
        
        <div style={{ backgroundColor: '#fffbe6', padding: '15px', borderRadius: '4px', marginBottom: '20px', borderLeft: '4px solid #faad14' }}>
          <Paragraph strong style={{ color: '#ff4d4f' }}>
            ⚠️ DANGER ZONE - This operation is irreversible!
          </Paragraph>
          <Paragraph>
            You can select multiple converts below and delete them along with ALL their related data including:
            progress records, attendance records, and all other associated information.
          </Paragraph>
        </div>

        <Divider />

        <div style={{ marginBottom: '20px' }}>
          <Input
            placeholder="Search by name or phone number"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '300px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <Space>
            <Text strong>Selected: {selectedIds.size}</Text>
            {selectedIds.size > 0 && (
              <Button
                danger
                type="primary"
                icon={<DeleteOutlined />}
                onClick={handleDeleteClick}
                loading={deleting}
              >
                Delete Selected ({selectedIds.size})
              </Button>
            )}
            {selectedIds.size > 0 && (
              <Button onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
            )}
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredConverts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 50 }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}
