'use client';

import { useState, useEffect } from 'react';
import { Modal, Select, Button, Space, message, Typography, Tag, Spin } from 'antd';
import { TeamOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const { Text } = Typography;
const { Option } = Select;

interface UserGroupsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  username: string;
}

interface Group {
  id: string;
  name: string;
  year: number;
}

interface UserGroup {
  id: string;
  group_id: string;
  group_name: string;
  group_year: number;
  assigned_at: string;
}

export default function UserGroupsModal({ visible, onClose, userId, username }: UserGroupsModalProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<UserGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible && userId) {
      fetchData();
    }
  }, [visible, userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, assignedRes] = await Promise.all([
        api.groups.list(),
        fetch(`/api/superadmin/users/${userId}/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const assignedData = await assignedRes.json();

      setAllGroups(groupsRes.success ? (groupsRes.data || []) : []);
      setAssignedGroups(assignedData.groups || []);
      setSelectedGroupIds((assignedData.groups || []).map((g: UserGroup) => g.group_id));
    } catch (error) {
      message.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/superadmin/users/${userId}/groups`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupIds: selectedGroupIds }),
      });

      if (response.ok) {
        message.success('Groups updated successfully');
        onClose();
      } else {
        const data = await response.json();
        message.error(data.error || 'Failed to update groups');
      }
    } catch (error) {
      message.error('Failed to update groups');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (groupId: string) => {
    setSelectedGroupIds(prev => prev.filter(id => id !== groupId));
  };

  const handleAdd = (groupId: string) => {
    if (!selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(prev => [...prev, groupId]);
    }
  };

  const unassignedGroups = allGroups.filter(g => !selectedGroupIds.includes(g.id));

  return (
    <Modal
      title={
        <span>
          <TeamOutlined style={{ marginRight: 8 }} />
          Manage Groups for {username}
        </span>
      }
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} loading={saving}>
          Save Changes
        </Button>,
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : (
        <div>
          {/* Assigned Groups */}
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              Assigned Groups ({selectedGroupIds.length})
            </Text>
            {selectedGroupIds.length === 0 ? (
              <Text type="secondary">No groups assigned</Text>
            ) : (
              <Space wrap>
                {selectedGroupIds.map(groupId => {
                  const group = allGroups.find(g => g.id === groupId);
                  if (!group) return null;
                  return (
                    <Tag
                      key={groupId}
                      color="blue"
                      closable
                      onClose={() => handleRemove(groupId)}
                      style={{ padding: '4px 8px', fontSize: 13 }}
                    >
                      <TeamOutlined /> {group.name} ({group.year})
                    </Tag>
                  );
                })}
              </Space>
            )}
          </div>

          {/* Add Groups */}
          {unassignedGroups.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>
                Add Groups
              </Text>
              <Select
                placeholder="Select a group to add"
                style={{ width: '100%' }}
                onChange={handleAdd}
                value={undefined}
                showSearch
                optionFilterProp="children"
              >
                {unassignedGroups.map(group => (
                  <Option key={group.id} value={group.id}>
                    <TeamOutlined /> {group.name} ({group.year})
                  </Option>
                ))}
              </Select>
            </div>
          )}

          {/* Info */}
          <div style={{ marginTop: 16, padding: 12, background: '#f0f5ff', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 Users can be assigned to multiple groups for flexibility. Changes will be saved when you click Save Changes.
            </Text>
          </div>
        </div>
      )}
    </Modal>
  );
}
