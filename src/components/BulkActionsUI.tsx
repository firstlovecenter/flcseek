'use client';

import React, { useState } from 'react';
import { Bot, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
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

interface BulkActionResult {
  successCount: number;
  targetCount: number;
  failureCount: number;
  errors: string[];
  duration: number;
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
  const [milestoneId, setMilestoneId] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkActionResult | null>(null);
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
          warning: 'This action is permanent and cannot be undone easily.',
        };
      default:
        return { action: 'Unknown', targetCount, description: baseDesc };
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
        onClick={() => setIsOpen(true)}
        disabled={selectedIds.length === 0 && filters.length === 0}
      >
        <Bot className="size-4" />
        Bulk Actions
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Actions</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="action">
            <TabsList>
              <TabsTrigger value="action">Select Action</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="action" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select
                  value={actionType}
                  onValueChange={(v) => setActionType(v as typeof actionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reassignGroup">Reassign Group / Update</SelectItem>
                    <SelectItem value="assignMilestone">Assign Milestone</SelectItem>
                    <SelectItem value="delete">Delete Records</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {actionType === 'reassignGroup' && (
                <p className="text-sm text-muted-foreground">
                  Updates the metadata timestamp for selected converts.
                </p>
              )}

              {actionType === 'assignMilestone' && (
                <div className="space-y-2">
                  <Label>Milestone</Label>
                  <Select value={milestoneId} onValueChange={setMilestoneId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {milestones.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {actionType === 'delete' && (
                <div className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Destructive Action</p>
                    <p>Selected records will be marked as deleted. This action is permanent.</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <strong className="text-sm">Action:</strong>
                      <p>{preview.action}</p>
                    </div>
                    <div>
                      <strong className="text-sm">Target Records:</strong>
                      <p>{preview.targetCount}</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <strong className="text-sm">Details:</strong>
                    <p>{preview.description}</p>
                  </div>

                  {preview.warning && (
                    <div
                      className={`mt-4 flex gap-3 rounded-lg border p-4 text-sm ${
                        actionType === 'delete'
                          ? 'border-destructive/20 bg-destructive/5 text-destructive'
                          : 'border-warning/20 bg-warning/5 text-warning'
                      }`}
                    >
                      <AlertCircle className="size-4 shrink-0" />
                      {preview.warning}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <div>
                <p className="font-medium">Error</p>
                <p>{error}</p>
              </div>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          )}

          {result && (
            <div
              className={`mt-4 rounded-lg border p-4 text-sm ${
                result.failureCount === 0
                  ? 'border-success/20 bg-success/5'
                  : 'border-warning/20 bg-warning/5'
              }`}
            >
              <p className="font-medium">Action Completed</p>
              <p className="mt-1">
                <strong>Success:</strong> {result.successCount} / {result.targetCount}
              </p>
              {result.errors.length > 0 && (
                <>
                  <p className="mt-2">
                    <strong>Errors ({result.errors.length}):</strong>
                  </p>
                  <ul className="mt-1 list-inside list-disc">
                    {result.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>... and {result.errors.length - 5} more</li>
                    )}
                  </ul>
                </>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Completed in {result.duration}ms
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'delete' ? 'destructive' : 'default'}
              onClick={handleExecuteAction}
              disabled={loading}
            >
              {loading ? 'Executing…' : 'Execute Action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
