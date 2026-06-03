'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Filter,
  Eraser,
  Copy,
  X,
} from 'lucide-react';
import { SynagoLoader } from '@/components/shell/SynagoLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/base/EmptyState';
import { toast } from '@/lib/toast';
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

const FILTER_PRESETS: Record<string, string> = {
  active_converts: 'Active Converts',
  new_converts: 'New Converts',
  at_risk: 'At Risk (50+)',
  high_risk: 'High Risk (75+)',
  inactive: 'Inactive',
  no_recent_attendance: 'No Attendance (30+ days)',
  milestone_stalled: 'Milestone Stalled (60+ days)',
  recently_added: 'Recently Added (30 days)',
};

export function FilterBuilder({
  onApplyFilters,
  onSaveSearch,
  initialFilters = [],
  groupId,
}: FilterBuilderProps) {
  const [filters, setFilters] = useState<SearchFilter[]>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [presets, setPresets] = useState<Record<string, SearchFilter[]>>({});
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; filters: SearchFilter[] }>>([]);
  const [sort, setSort] = useState<{ field: string; order: 'asc' | 'desc' } | undefined>();

  useEffect(() => {
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
      }
    };

    loadPresetsAndTemplates();
  }, []);

  const handleAddFilter = useCallback(() => {
    setFilters((prev) => [...prev, { field: '', operator: 'equals', value: '' }]);
  }, []);

  const handleUpdateFilter = (
    index: number,
    field: keyof SearchFilter,
    value: SearchFilter[keyof SearchFilter]
  ) => {
    setFilters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearFilters = () => {
    setFilters([]);
    setSort(undefined);
  };

  const handleApplyFilters = async () => {
    if (filters.length === 0) {
      toast.warning('Please add at least one filter');
      return;
    }

    setLoading(true);
    try {
      onApplyFilters(filters);
      toast.success('Filters applied successfully');
    } catch (error) {
      toast.error('Failed to apply filters');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (presetKey: string) => {
    const presetFilters = presets[presetKey] || [];
    setFilters(presetFilters);
    toast.info(`Preset '${FILTER_PRESETS[presetKey]}' applied`);
  };

  const handleApplyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFilters(template.filters);
      toast.info(`Template '${template.name}' applied`);
    }
  };

  const handleSaveSearch = async () => {
    if (!searchName.trim()) {
      toast.error('Please enter a search name');
      return;
    }

    const searchFilters: SavedSearchFilters = { filters, sort };

    try {
      onSaveSearch(searchName, searchFilters);
      setSaveModalVisible(false);
      setSearchName('');
      toast.success('Search saved successfully');
    } catch (error) {
      toast.error('Failed to save search');
      console.error(error);
    }
  };

  const handleDuplicateFilter = (index: number) => {
    setFilters((prev) => [...prev, { ...prev[index] }]);
  };

  const renderValueInput = (record: SearchFilter, index: number) => {
    const isDateField = ['createdAt', 'updatedAt'].includes(record.field);
    const isNumericField = ['riskScore', 'daysSinceLastAttendance', 'daysSinceLastMilestone'].includes(
      record.field
    );

    if (record.operator === 'between') {
      return (
        <Input
          placeholder="e.g., 10,50"
          value={
            Array.isArray(record.value) ? `${record.value[0]},${record.value[1]}` : ''
          }
          onChange={(e) => {
            const [start, end] = e.target.value.split(',').map((v) => v.trim());
            handleUpdateFilter(index, 'value', [start, end]);
          }}
        />
      );
    }

    if (isDateField) {
      const dateValue = record.value
        ? dayjs(record.value as string | number | Date).format('YYYY-MM-DD')
        : '';
      return (
        <Input
          type="date"
          value={dateValue}
          onChange={(e) =>
            handleUpdateFilter(index, 'value', e.target.value ? new Date(e.target.value) : '')
          }
        />
      );
    }

    if (isNumericField) {
      return (
        <Input
          type="number"
          placeholder="Enter value"
          value={record.value as string | number | undefined}
          onChange={(e) =>
            handleUpdateFilter(index, 'value', parseInt(e.target.value) || 0)
          }
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
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Advanced Filter Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="builder">
          <TabsList>
            <TabsTrigger value="builder">Custom Filters</TabsTrigger>
            <TabsTrigger value="presets">Quick Presets</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="mt-4 space-y-4">
            {filters.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filters.map((record, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={record.field || undefined}
                          onValueChange={(v) => handleUpdateFilter(index, 'field', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={record.operator}
                          onValueChange={(v) => handleUpdateFilter(index, 'operator', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{renderValueInput(record, index)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleDuplicateFilter(index)}
                              >
                                <Copy className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicate</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                onClick={() => handleRemoveFilter(index)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No filters added yet" />
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAddFilter}>
                <Plus className="size-4" />
                Add Filter
              </Button>
              {filters.length > 0 && (
                <>
                  <Button variant="outline" onClick={handleClearFilters}>
                    <Eraser className="size-4" />
                    Clear All
                  </Button>
                  <Button onClick={handleApplyFilters} disabled={loading}>
                    {loading ? (
                      <SynagoLoader size={16} inline />
                    ) : (
                      <Filter className="size-4" />
                    )}
                    Apply Filters
                  </Button>
                  <Button variant="outline" onClick={() => setSaveModalVisible(true)}>
                    <Save className="size-4" />
                    Save Search
                  </Button>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="presets" className="mt-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {Object.entries(FILTER_PRESETS).map(([key, label]) => (
                <Button key={key} variant="outline" className="justify-start" onClick={() => handleApplyPreset(key)}>
                  {label}
                </Button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            {templates.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    className="justify-start"
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            ) : (
              <EmptyState title="No templates available" />
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={saveModalVisible} onOpenChange={setSaveModalVisible}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Search</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search-name">Search Name</Label>
                <Input
                  id="search-name"
                  placeholder="e.g., High Risk Converts"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Filters: {filters.length} • Applying to {groupId ? 'current group' : 'all converts'}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveModalVisible(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSearch}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {filters.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-sm font-semibold">Active Filters:</p>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter, index) => (
                <Badge key={index} variant="secondary" className="gap-1 pr-1">
                  {filter.field} {filter.operator} {String(filter.value).substring(0, 20)}
                  <button
                    type="button"
                    onClick={() => handleRemoveFilter(index)}
                    className="ml-1 rounded-sm p-0.5 hover:bg-muted"
                    aria-label="Remove filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
