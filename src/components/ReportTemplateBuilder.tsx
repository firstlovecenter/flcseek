'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  FileText,
  Save,
  X,
} from 'lucide-react';
import { SynagoLoader } from '@/components/shell/SynagoLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/base/EmptyState';
import { Separator } from '@/components/ui/separator';
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
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
        headers: { 'X-User-ID': userId },
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

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsPublic(false);
    setSections([]);
    setError(null);
  };

  const handleSaveTemplate = async () => {
    if (!token || !userId) {
      setError('Authentication required');
      return;
    }

    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/report-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          name,
          description,
          sections,
          groupId,
          isPublic,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create template');
      }

      const template = await response.json();
      setTemplates([...templates, template]);
      resetForm();
      setDrawerOpen(false);
      setIsOpen(false);

      onTemplateCreated?.(template);
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
      type: type as ReportSection['type'],
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

    setSections(sections.map((s) => (s.id === editingSection.id ? editingSection : s)));
    setEditingSection(null);
  };

  const handleDeleteSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
  };

  const openNewTemplate = () => {
    resetForm();
    setEditingSection(null);
    setDrawerOpen(true);
  };

  const toggleMetric = (metric: string, checked: boolean) => {
    if (!editingSection) return;
    const metrics = editingSection.metrics || [];
    setEditingSection({
      ...editingSection,
      metrics: checked ? [...metrics, metric] : metrics.filter((m) => m !== metric),
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <FileText className="size-4" />
        Report Templates
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Report Templates</DialogTitle>
          </DialogHeader>

          {templatesLoading ? (
            <div className="flex justify-center py-10">
              <SynagoLoader size={32} />
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              title="No templates yet"
              action={
                <Button onClick={openNewTemplate}>Create Your First Template</Button>
              }
              className="py-10"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Sections</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Visibility</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>{template.name}</TableCell>
                      <TableCell>{template.sections?.length || 0}</TableCell>
                      <TableCell>
                        {template.scheduleFrequency && template.scheduleFrequency !== 'never'
                          ? template.scheduleFrequency
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.isPublic ? 'default' : 'secondary'}>
                          {template.isPublic ? 'Public' : 'Private'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button className="mt-4" onClick={openNewTemplate}>
                <Plus className="size-4" />
                New Template
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditingSection(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingSection ? 'Edit Section' : 'New Report Template'}</SheetTitle>
          </SheetHeader>

          {!editingSection ? (
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  placeholder="e.g., Monthly Accountability Report"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-desc">Description</Label>
                <Textarea
                  id="template-desc"
                  rows={2}
                  placeholder="Optional description of this template"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
                <Label htmlFor="is-public">Make public for other leaders</Label>
              </div>

              <Separator />

              <div>
                <p className="mb-3 font-medium">Sections</p>
                {sections.length === 0 ? (
                  <EmptyState title="No sections added" className="mb-4 border-0 bg-transparent py-4" />
                ) : (
                  <Table className="mb-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Metrics</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sections.map((section) => (
                        <TableRow key={section.id}>
                          <TableCell>{section.title}</TableCell>
                          <TableCell>
                            <Badge>{section.type.replace('_', ' ').toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>
                            {section.metrics?.length || 0} metric
                            {(section.metrics?.length || 0) !== 1 ? 's' : ''}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleEditSection(section)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                onClick={() => handleDeleteSection(section.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <p className="mb-2 text-sm font-medium">Add Section:</p>
                <div className="flex flex-wrap gap-2">
                  {sectionTypes.map((type) => (
                    <Button key={type.value} variant="outline" size="sm" onClick={() => handleAddSection(type.value)}>
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <div>
                    <p className="font-medium">Error</p>
                    <p>{error}</p>
                  </div>
                  <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
                    <X className="size-4" />
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate} disabled={loading}>
                  {loading ? (
                    <SynagoLoader size={16} inline />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Create Template
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Section Title</Label>
                <Input
                  value={editingSection.title}
                  onChange={(e) =>
                    setEditingSection({ ...editingSection, title: e.target.value })
                  }
                />
              </div>

              {editingSection.type === 'metrics' && (
                <div className="space-y-2">
                  <Label>Select Metrics</Label>
                  <div className="space-y-2 rounded-md border p-3">
                    {availableMetrics.map((metric) => (
                      <label key={metric} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(editingSection.metrics || []).includes(metric)}
                          onCheckedChange={(checked) => toggleMetric(metric, checked === true)}
                        />
                        {metric}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Switch
                  id="include-visuals"
                  checked={editingSection.includeVisuals}
                  onCheckedChange={(checked) =>
                    setEditingSection({ ...editingSection, includeVisuals: checked })
                  }
                />
                <Label htmlFor="include-visuals">Include Visuals</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveSection}>Save Section</Button>
                <Button variant="outline" onClick={() => setEditingSection(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
