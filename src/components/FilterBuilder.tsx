'use client';

import React, { useState, useCallback } from 'react';
import {
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  Space,
  Card,
  Tabs,
  Tag,
  Modal,
  Table,
  Empty,
  Spin,
  App,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  FilterOutlined,
  ClearOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { SearchFilter, SavedSearchFilters } from '@/lib/types/advanced-features';
import dayjs from 'dayjs';

interface FilterBuilderProps {
  onApplyFilters: (filters: SearchFilter[]) => void;
  onSaveSearch: (name: string, filters: SavedSearchFilters) => void;
  initialFilters?: SearchFilter[];
  groupId?: string;
}

const FILTER_FIELDS = [
  { label: 'First Name', value: 'firstName' },
  { label: 'Last Name', value: 'lastName' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'Status', value: 'status' },
  { label: 'Risk Score', value: 'riskScore' },
  { label: 'Days Since Last Attendance', value: 'daysSinceLastAttendance' },
  { label: 'Days Since Last Milestone', value: 'daysSinceLastMilestone' },
  { label: 'Created Date', value: 'createdAt' },
];

const FILTER_OPERATORS = [
  { label: 'Equals', value: 'equals' },
  { label: 'Contains', value: 'contains' },
  { label: 'Greater than', value: 'gt' },
  { label: 'Less than', value: 'lt' },
  { label: 'Greater or equal', value: 'gte' },
  { label: 'Less or equal', value: 'lte' },
  { label: 'In list', value: 'in' },
  { label: 'Between', value: 'between' },
];

const FILTER_PRESETS = {
  active_converts: 'Active Converts',
  new_converts: 'New Converts',
  at_risk: 'At Risk (50+)',
  high_risk: 'High Risk (75+)',
  inactive: 'Inactive',
  no_recent_attendance: 'No Attendance (30+ days)',
  milestone_stalled: 'Milestone Stalled (60+ days)',
  recently_added: 'Recently Added (30 days)',
};

export function FilterBuilder({ onApplyFilters, onSaveSearch, initialFilters = [], groupId }: FilterBuilderProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [filters, setFilters] = useState<SearchFilter[]>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [presets, setPresets] = useState<Record<string, SearchFilter[]>>({});
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; filters: SearchFilter[] }>>([]);
  const [sort, setSort] = useState<{ field: string; order: 'asc' | 'desc' } | undefined>();

  // Load presets and templates on mount
  React.useEffect(() => {
    const loadPresetsAndTemplates = async () => {
      try {
        const [presetsRes, templatesRes] = await Promise.all([
          fetch('/api/filters?type=presets', { credentials: 'include' }),
          fetch('/api/filters?type=templates', { credentials: 'include' }),
        ]);

        if (presetsRes.ok) {
          const presetsData = await presetsRes.json();
          setPresets(presetsData.presets || {});
        }

        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          setTemplates(templatesData.templates || []);
        }
      } catch (error) {
        console.error('Failed to load presets:', error);
        // Non-fatal: filters still work without server presets
      }
    };

    loadPresetsAndTemplates();
  }, []);

  // Add a new filter row
  const handleAddFilter = useCallback(() => {
    const newFilter: SearchFilter = {
      field: '',
      operator: 'equals',
      value: '',
    };
    setFilters([...filters, newFilter]);
  }, [filters]);

  // Update filter
  const handleUpdateFilter = (index: number, field: keyof SearchFilter, value: SearchFilter[keyof SearchFilter]) => {
    const updated = [...filters];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setFilters(updated);
  };

  // Remove filter
  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFilters([]);
    form.resetFields();
    setSort(undefined);
  };

  // Apply filters
  const handleApplyFilters = async () => {
    if (filters.length === 0) {
      message.warning('Please add at least one filter');
      return;
    }

    setLoading(true);
    try {
      onApplyFilters(filters);
      message.success('Filters applied successfully');
    } catch (error) {
      message.error('Failed to apply filters');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Apply preset
  const handleApplyPreset = (presetKey: string) => {
    const presetFilters = presets[presetKey] || [];
    setFilters(presetFilters);
    message.info(`Preset '${FILTER_PRESETS[presetKey as keyof typeof FILTER_PRESETS]}' applied`);
  };

  // Apply template
  const handleApplyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFilters(template.filters);
      message.info(`Template '${template.name}' applied`);
    }
  };

  // Save as search
  const handleSaveSearch = async () => {
    if (!searchName.trim()) {
      message.error('Please enter a search name');
      return;
    }

    const searchFilters: SavedSearchFilters = {
      filters,
      sort,
    };

    try {
      onSaveSearch(searchName, searchFilters);
      setSaveModalVisible(false);
      setSearchName('');
      message.success('Search saved successfully');
    } catch (error) {
      message.error('Failed to save search');
      console.error(error);
    }
  };

  // Duplicate filter
  const handleDuplicateFilter = (index: number) => {
    const filter = filters[index];
    setFilters([...filters, { ...filter }]);
  };

  const filterColumns = [
    {
      title: 'Field',
      dataIndex: 'field',
      key: 'field',
      width: 150,
      render: (_: unknown, record: SearchFilter, index: number) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Select field"
          value={record.field}
          onChange={(value) => handleUpdateFilter(index, 'field', value)}
          options={FILTER_FIELDS}
        />
      ),
    },
    {
      title: 'Operator',
      dataIndex: 'operator',
      key: 'operator',
      width: 140,
      render: (_: unknown, record: SearchFilter, index: number) => (
        <Select
          style={{ width: '100%' }}
          value={record.operator}
          onChange={(value) => handleUpdateFilter(index, 'operator', value)}
          options={FILTER_OPERATORS}
        />
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (_: unknown, record: SearchFilter, index: number) => {
        const isDateField = ['createdAt', 'updatedAt'].includes(record.field);
        const isNumericField = ['riskScore', 'daysSinceLastAttendance', 'daysSinceLastMilestone'].includes(
          record.field
        );

        if (record.operator === 'between') {
          return (
            <Input
              placeholder="e.g., 10,50"
              value={
                Array.isArray(record.value)
                  ? `${record.value[0]},${record.value[1]}`
                  : ''
              }
              onChange={(e) => {
                const [start, end] = e.target.value.split(',').map((v) => v.trim());
                handleUpdateFilter(index, 'value', [start, end]);
              }}
            />
          );
        }

        if (isDateField) {
          return (
            <DatePicker
              style={{ width: '100%' }}
              value={record.value ? dayjs(record.value as string | number | Date) : null}
              onChange={(date) => handleUpdateFilter(index, 'value', date?.toDate())}
            />
          );
        }

        if (isNumericField) {
          return (
            <Input
              type="number"
              placeholder="Enter value"
              value={record.value as string | number | undefined}
              onChange={(e) => handleUpdateFilter(index, 'value', parseInt(e.target.value) || 0)}
            />
          );
        }

        return (
          <Input
            placeholder="Enter value"
            value={record.value as string | number | undefined}
            onChange={(e) => handleUpdateFilter(index, 'value', e.target.value)}
          />
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, __: SearchFilter, index: number) => (
        <Space>
          <Tooltip title="Duplicate">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleDuplicateFilter(index)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleRemoveFilter(index)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card title="Advanced Filter Builder" className="mb-6">
      <Tabs
        items={[
          {
            key: 'builder',
            label: 'Custom Filters',
            children: (
              <div className="space-y-4">
                {filters.length > 0 ? (
                  <Table
                    dataSource={filters.map((f, i) => ({ ...f, key: i }))}
                    columns={filterColumns}
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Empty description="No filters added yet" />
                )}

                <Space>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddFilter}>
                    Add Filter
                  </Button>
                  {filters.length > 0 && (
                    <>
                      <Button icon={<ClearOutlined />} onClick={handleClearFilters}>
                        Clear All
                      </Button>
                      <Button
                        type="primary"
                        icon={<FilterOutlined />}
                        loading={loading}
                        onClick={handleApplyFilters}
                      >
                        Apply Filters
                      </Button>
                      <Button icon={<SaveOutlined />} onClick={() => setSaveModalVisible(true)}>
                        Save Search
                      </Button>
                    </>
                  )}
                </Space>
              </div>
            ),
          },
          {
            key: 'presets',
            label: 'Quick Presets',
            children: (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {Object.entries(FILTER_PRESETS).map(([key, label]) => (
                    <Button
                      key={key}
                      onClick={() => handleApplyPreset(key)}
                      className="text-left"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ),
          },
          {
            key: 'templates',
            label: 'Templates',
            children: (
              <div className="space-y-4">
                {templates.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {templates.map((template) => (
                      <Button
                        key={template.id}
                        onClick={() => handleApplyTemplate(template.id)}
                        className="text-left"
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Empty description="No templates available" />
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Save Search Modal */}
      <Modal
        title="Save Search"
        open={saveModalVisible}
        onOk={handleSaveSearch}
        onCancel={() => setSaveModalVisible(false)}
      >
        <Form layout="vertical">
          <Form.Item label="Search Name" required>
            <Input
              placeholder="e.g., High Risk Converts"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              autoFocus
            />
          </Form.Item>
          <div className="text-sm text-gray-500">
            Filters: {filters.length} • Applying to {groupId ? 'current group' : 'all converts'}
          </div>
        </Form>
      </Modal>

      {/* Current Filters Display */}
      {filters.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <p className="mb-2 text-sm font-semibold">Active Filters:</p>
          <Space wrap>
            {filters.map((filter, index) => (
              <Tag
                key={index}
                closable
                onClose={() => handleRemoveFilter(index)}
                color="blue"
              >
                {filter.field} {filter.operator} {String(filter.value).substring(0, 20)}
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </Card>
  );
}
