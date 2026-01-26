'use client';

import React, { useState } from 'react';
import {
  Modal,
  Button,
  Form,
  Select,
  Table,
  Tabs,
  Empty,
  Spin,
  Alert,
  Card,
  Row,
  Col,
  Divider,
} from 'antd';
import { DeleteOutlined, EditOutlined, RobotOutlined } from '@ant-design/icons';
import { SearchFilter } from '@/lib/types/advanced-features';

interface BulkActionsUIProps {
  groupId?: string;
  selectedIds?: string[];
  filters?: SearchFilter[];
  userId?: string;
  token?: string;
}

interface ActionPreview {
  action: string;
  targetCount: number;
  description: string;
  warning?: string;
}

export function BulkActionsUI({
  groupId,
  selectedIds = [],
  filters = [],
  userId,
  token,
}: BulkActionsUIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionType, setActionType] = useState<'reassignGroup' | 'assignMilestone' | 'delete'>('reassignGroup');
  const [newGroupId, setNewGroupId] = useState('');
  const [milestoneId, setMilestoneId] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const milestones = Array.from({ length: 10 }, (_, i) => ({
    label: `Stage ${i + 1}`,
    value: String(i + 1),
  }));

  const getPreview = (): ActionPreview => {
    const targetCount = selectedIds.length || filters.length;
    const baseDesc = `Target: ${targetCount} convert${targetCount !== 1 ? 's' : ''}`;

    switch (actionType) {
      case 'reassignGroup':
        return {
          action: 'Reassign Group',
          targetCount,
          description: `${baseDesc} → will touch updatedAt timestamp`,
          warning: 'This updates the metadata for selected converts.',
        };
      case 'assignMilestone':
        return {
          action: 'Assign Milestone',
          targetCount,
          description: `${baseDesc} → Milestone: Stage ${milestoneId}`,
          warning: 'Progress records will be created for converts without this milestone.',
        };
      case 'delete':
        return {
          action: 'Delete Records',
          targetCount,
          description: `${baseDesc} will be marked as deleted.`,
          warning: '⚠️ This action is permanent and cannot be undone easily.',
        };
      default:
        return {
          action: 'Unknown',
          targetCount,
          description: baseDesc,
        };
    }
  };

  const handleExecuteAction = async () => {
    if (!userId || !token) {
      setError('Authentication required');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/bulk-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          action: actionType,
          filters,
          newStatus: actionType === 'reassignGroup' ? 'active' : undefined,
          milestoneId: actionType === 'assignMilestone' ? milestoneId : undefined,
          convertIds: selectedIds,
          groupId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Action failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const preview = getPreview();

  return (
    <>
      <Button
        type="primary"
        icon={<RobotOutlined />}
        onClick={() => setIsOpen(true)}
        disabled={selectedIds.length === 0 && filters.length === 0}
      >
        Bulk Actions
      </Button>

      <Modal
        title="Bulk Actions"
        open={isOpen}
        onCancel={() => setIsOpen(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="execute"
            type="primary"
            loading={loading}
            onClick={handleExecuteAction}
            danger={actionType === 'delete'}
          >
            Execute Action
          </Button>,
        ]}
      >
        <Tabs
          items={[
            {
              key: 'action',
              label: 'Select Action',
              children: (
                <div style={{ paddingTop: 16 }}>
                  <Form layout="vertical">
                    <Form.Item label="Action Type">
                      <Select
                        value={actionType}
                        onChange={setActionType}
                        options={[
                          { label: 'Reassign Group / Update', value: 'reassignGroup' },
                          { label: 'Assign Milestone', value: 'assignMilestone' },
                          { label: 'Delete Records', value: 'delete' },
                        ]}
                      />
                    </Form.Item>

                    {actionType === 'reassignGroup' && (
                      <Form.Item label="Action">
                        <p>Updates the metadata timestamp for selected converts.</p>
                      </Form.Item>
                    )}

                    {actionType === 'assignMilestone' && (
                      <Form.Item label="Milestone">
                        <Select
                          value={milestoneId}
                          onChange={setMilestoneId}
                          options={milestones}
                        />
                      </Form.Item>
                    )}

                    {actionType === 'delete' && (
                      <Alert
                        message="Destructive Action"
                        description="Selected records will be marked as deleted. This action is permanent."
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                    )}
                  </Form>
                </div>
              ),
            },
            {
              key: 'preview',
              label: 'Preview',
              children: (
                <div style={{ paddingTop: 16 }}>
                  <Card>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <div>
                          <strong>Action:</strong>
                          <p>{preview.action}</p>
                        </div>
                      </Col>
                      <Col xs={24} sm={12}>
                        <div>
                          <strong>Target Records:</strong>
                          <p>{preview.targetCount}</p>
                        </div>
                      </Col>
                    </Row>

                    <Divider />

                    <div>
                      <strong>Details:</strong>
                      <p>{preview.description}</p>
                    </div>

                    {preview.warning && (
                      <Alert
                        message={preview.warning}
                        type={actionType === 'delete' ? 'error' : 'warning'}
                        showIcon
                        style={{ marginTop: 16 }}
                      />
                    )}
                  </Card>
                </div>
              ),
            },
          ]}
        />

        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            style={{ marginTop: 16 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        {result && (
          <Alert
            message="Action Completed"
            description={
              <div>
                <p>
                  <strong>Success:</strong> {result.successCount} / {result.targetCount}
                </p>
                {result.errors.length > 0 && (
                  <>
                    <p>
                      <strong>Errors ({result.errors.length}):</strong>
                    </p>
                    <ul style={{ marginTop: 8 }}>
                      {result.errors.slice(0, 5).map((err: string, idx: number) => (
                        <li key={idx}>{err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>... and {result.errors.length - 5} more</li>
                      )}
                    </ul>
                  </>
                )}
                <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                  Completed in {result.duration}ms
                </p>
              </div>
            }
            type={result.failureCount === 0 ? 'success' : 'warning'}
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>
    </>
  );
}
