'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  Select,
  Table,
  Drawer,
  Space,
  Card,
  Divider,
  Switch,
  Empty,
  Spin,
  Alert,
  Tag,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { ReportTemplate, ReportSection } from '@/lib/report-templates';

interface ReportTemplateBuilderProps {
  groupId?: string;
  userId?: string;
  token?: string;
  onTemplateCreated?: (template: ReportTemplate) => void;
}

const sectionTypes: { label: string; value: string }[] = [
  { label: 'Summary Statistics', value: 'summary' },
  { label: 'Data Table', value: 'table' },
  { label: 'Chart / Visualization', value: 'chart' },
  { label: 'Metrics List', value: 'metrics' },
];

const availableMetrics = [
  'convertCount',
  'activeCount',
  'completedCount',
  'activityRate',
  'averageProgress',
  'attendanceRate',
];

export function ReportTemplateBuilder({
  groupId,
  userId,
  token,
  onTemplateCreated,
}: ReportTemplateBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form] = Form.useForm();
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<ReportSection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    if (!token || !userId) return;

    setTemplatesLoading(true);
    try {
      const response = await fetch(`/api/report-templates?groupId=${groupId}`, {
        headers: {
          'X-User-ID': userId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!token || !userId) {
      setError('Authentication required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const values = await form.validateFields();

      const response = await fetch('/api/report-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          sections,
          groupId,
          isPublic: values.isPublic || false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create template');
      }

      const template = await response.json();
      setTemplates([...templates, template]);
      form.resetFields();
      setSections([]);
      setIsOpen(false);

      if (onTemplateCreated) {
        onTemplateCreated(template);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSection = (type: string) => {
    const newSection: ReportSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      type: type as any,
      metrics: [],
      includeVisuals: false,
    };
    setSections([...sections, newSection]);
  };

  const handleEditSection = (section: ReportSection) => {
    setEditingSection(section);
    setDrawerOpen(true);
  };

  const handleSaveSection = () => {
    if (!editingSection) return;

    setSections(
      sections.map((s) =>
        s.id === editingSection.id ? editingSection : s
      )
    );
    setDrawerOpen(false);
    setEditingSection(null);
  };

  const handleDeleteSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
  };

  const sectionsTableColumns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag>{type.replace('_', ' ').toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Metrics',
      dataIndex: 'metrics',
      key: 'metrics',
      render: (metrics: string[]) => (
        <span>{metrics?.length || 0} metric{(metrics?.length || 0) !== 1 ? 's' : ''}</span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: ReportSection) => (
        <Space size="small">
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditSection(record)}
          />
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handleDeleteSection(record.id)}
          />
        </Space>
      ),
    },
  ];

  const templatesTableColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Sections',
      dataIndex: 'sections',
      key: 'sections',
      render: (sections: ReportSection[]) => sections?.length || 0,
    },
    {
      title: 'Schedule',
      dataIndex: 'scheduleFrequency',
      key: 'schedule',
      render: (freq: string) => freq && freq !== 'never' ? freq : '—',
    },
    {
      title: 'Visibility',
      dataIndex: 'isPublic',
      key: 'visibility',
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'blue' : 'default'}>
          {isPublic ? 'Public' : 'Private'}
        </Tag>
      ),
    },
  ];

  return (
    <>
      <Button
        type="primary"
        icon={<FileTextOutlined />}
        onClick={() => setIsOpen(true)}
      >
        Report Templates
      </Button>

      <Modal
        title="Report Templates"
        open={isOpen}
        onCancel={() => setIsOpen(false)}
        width={900}
        footer={null}
      >
        <Spin spinning={templatesLoading}>
          {templates.length === 0 ? (
            <Empty
              description="No templates yet"
              style={{ marginTop: 32, marginBottom: 32 }}
            >
              <Button type="primary" onClick={() => setDrawerOpen(true)}>
                Create Your First Template
              </Button>
            </Empty>
          ) : (
            <>
              <Table
                columns={templatesTableColumns}
                dataSource={templates}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields();
                  setSections([]);
                  setDrawerOpen(true);
                }}
                style={{ marginTop: 16 }}
              >
                New Template
              </Button>
            </>
          )}
        </Spin>
      </Modal>

      <Drawer
        title={editingSection ? 'Edit Section' : 'New Report Template'}
        onClose={() => {
          setDrawerOpen(false);
          setEditingSection(null);
        }}
        open={drawerOpen}
        width={600}
        footer={
          !editingSection && (
            <Space style={{ float: 'right' }}>
              <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={loading}
                onClick={editingSection ? handleSaveSection : handleSaveTemplate}
              >
                {editingSection ? 'Save Section' : 'Create Template'}
              </Button>
            </Space>
          )
        }
      >
        {!editingSection ? (
          <>
            <Form form={form} layout="vertical">
              <Form.Item
                label="Template Name"
                name="name"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="e.g., Monthly Accountability Report" />
              </Form.Item>

              <Form.Item label="Description" name="description">
                <Input.TextArea
                  rows={2}
                  placeholder="Optional description of this template"
                />
              </Form.Item>

              <Form.Item label="Visibility" name="isPublic" valuePropName="checked">
                <Switch /> <span style={{ marginLeft: 8 }}>Make public for other leaders</span>
              </Form.Item>
            </Form>

            <Divider>Sections</Divider>

            {sections.length === 0 ? (
              <Empty description="No sections added" style={{ marginBottom: 16 }} />
            ) : (
              <Table
                columns={sectionsTableColumns}
                dataSource={sections}
                rowKey="id"
                size="small"
                pagination={false}
                style={{ marginBottom: 16 }}
              />
            )}

            <div style={{ marginBottom: 16 }}>
              <strong>Add Section:</strong>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sectionTypes.map((type) => (
                  <Button
                    key={type.value}
                    size="small"
                    onClick={() => handleAddSection(type.value)}
                  >
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            {error && (
              <Alert
                message="Error"
                description={error}
                type="error"
                showIcon
                closable
                onClose={() => setError(null)}
                style={{ marginTop: 16 }}
              />
            )}
          </>
        ) : (
          <div>
            <Form layout="vertical">
              <Form.Item label="Section Title">
                <Input
                  value={editingSection.title}
                  onChange={(e) =>
                    setEditingSection({
                      ...editingSection,
                      title: e.target.value,
                    })
                  }
                />
              </Form.Item>

              {editingSection.type === 'metrics' && (
                <Form.Item label="Select Metrics">
                  <Select
                    mode="multiple"
                    value={editingSection.metrics || []}
                    onChange={(metrics) =>
                      setEditingSection({
                        ...editingSection,
                        metrics,
                      })
                    }
                    options={availableMetrics.map((m) => ({
                      label: m,
                      value: m,
                    }))}
                  />
                </Form.Item>
              )}

              <Form.Item label="Include Visuals" valuePropName="checked">
                <Switch
                  checked={editingSection.includeVisuals}
                  onChange={(checked) =>
                    setEditingSection({
                      ...editingSection,
                      includeVisuals: checked,
                    })
                  }
                />
              </Form.Item>
            </Form>

            <Space style={{ marginTop: 16 }}>
              <Button onClick={handleSaveSection} type="primary">
                Save Section
              </Button>
              <Button onClick={() => setEditingSection(null)}>Cancel</Button>
            </Space>
          </div>
        )}
      </Drawer>
    </>
  );
}
