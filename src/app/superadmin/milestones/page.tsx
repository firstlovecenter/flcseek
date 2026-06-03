'use client';

import { useEffect, useState } from 'react';
import {
  Trophy,
  CheckCircle,
  Pencil,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { message } from '@/lib/toast';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Milestone {
  id: string;
  stage_number: number;
  stage_name: string;
  short_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MilestoneFormValues {
  stage_number: string;
  stage_name: string;
  short_name: string;
  description: string;
}

const emptyForm: MilestoneFormValues = {
  stage_number: '',
  stage_name: '',
  short_name: '',
  description: '',
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formValues, setFormValues] = useState<MilestoneFormValues>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    fetchMilestones();
  }, []);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      const response = await api.milestones.listAll();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch milestones');
      }
      setMilestones(response.data?.milestones || []);
    } catch (error: unknown) {
      console.error('Error fetching milestones:', error);
      message.error('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingMilestone(null);
    setFormValues(emptyForm);
    setIsModalVisible(true);
  };

  const handleEdit = (milestone: Milestone) => {
    setIsCreating(false);
    setEditingMilestone(milestone);
    setFormValues({
      stage_number: String(milestone.stage_number),
      stage_name: milestone.stage_name,
      short_name: milestone.short_name,
      description: milestone.description,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await api.milestones.delete(deleteId);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete milestone');
      }
      message.success('Milestone deleted successfully');
      fetchMilestones();
    } catch (error: unknown) {
      console.error('Error deleting milestone:', error);
      message.error(error instanceof Error ? error.message : 'Failed to delete milestone');
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await api.milestones.toggleActive(id, !currentStatus);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update milestone status');
      }
      const data = response.data;
      const backfilledData = data as { backfilled?: number };
      if (backfilledData?.backfilled && backfilledData.backfilled > 0) {
        message.success(
          `Milestone activated! ${backfilledData.backfilled} progress record(s) automatically created for existing converts.`
        );
      } else {
        message.success(
          `Milestone ${!currentStatus ? 'activated' : 'deactivated'} successfully`
        );
      }
      fetchMilestones();
    } catch (error: unknown) {
      console.error('Error toggling milestone status:', error);
      message.error(
        error instanceof Error ? error.message : 'Failed to update milestone status'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isCreating) {
        const stageNum = Number(formValues.stage_number);
        if (!stageNum || stageNum < 1 || stageNum > 99) {
          message.error('Stage number must be between 1 and 99');
          setSubmitting(false);
          return;
        }
        const response = await api.milestones.create({
          stage_number: stageNum,
          stage_name: formValues.stage_name,
          short_name: formValues.short_name,
          description: formValues.description,
        });
        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to create milestone');
        }
        message.success('Milestone created successfully');
      } else {
        if (!editingMilestone) return;
        const response = await api.milestones.updateDetails(editingMilestone.id, {
          stage_name: formValues.stage_name,
          short_name: formValues.short_name,
          description: formValues.description,
        });
        if (!response.success) {
          throw new Error('Failed to update milestone');
        }
        message.success('Milestone updated successfully');
      }
      setIsModalVisible(false);
      setFormValues(emptyForm);
      setEditingMilestone(null);
      fetchMilestones();
    } catch (error: unknown) {
      console.error('Error saving milestone:', error);
      message.error(error instanceof Error ? error.message : 'Failed to save milestone');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMilestones = milestones.filter((m) => {
    if (activeFilter === 'active') return m.is_active;
    if (activeFilter === 'inactive') return !m.is_active;
    return true;
  });

  const paginated = filteredMilestones.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredMilestones.length / pageSize);

  if (loading) {
    return <LoadingScreen label="Loading milestones…" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Trophy className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Milestone management</h1>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="size-4" />
          Add new milestone
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Manage the spiritual growth milestones tracked for all registered members.
        You can add, edit, or remove milestones to match your church&apos;s discipleship process.
      </p>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Milestones</CardTitle>
          <Select
            value={activeFilter}
            onValueChange={(v) => {
              setActiveFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Stage #</TableHead>
                  <TableHead className="w-36">Short name</TableHead>
                  <TableHead>Milestone name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Active</TableHead>
                  <TableHead className="w-40">Created</TableHead>
                  <TableHead className="w-40">Last updated</TableHead>
                  <TableHead className="w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Badge variant="secondary" className="tabular-nums text-sm">
                        {record.stage_number}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-pre-wrap">
                        {record.short_name || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <CheckCircle className="size-4 text-green-600" />
                        {record.stage_name}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{record.description}</TableCell>
                    <TableCell>
                      <Switch
                        checked={record.is_active}
                        onCheckedChange={() =>
                          handleToggleActive(record.id, record.is_active)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(record.created_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(record.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(record.id)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredMilestones.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground tabular-nums">
                Total {filteredMilestones.length} milestones
              </p>
              <div className="flex items-center gap-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['10', '20', '50'].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Milestone information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Total stages:</strong>{' '}
            <span className="tabular-nums">{milestones.length}</span> spiritual growth milestones
          </p>
          <p>
            <strong className="text-foreground">Stage numbers:</strong> Each milestone must have a
            unique stage number (1–99). Members progress through these stages sequentially.
          </p>
          <p>
            <strong className="text-foreground">Completion requirement:</strong> Members should
            complete all stages plus 26 attendance records to be considered fully integrated.
          </p>
          <p>
            <strong className="text-foreground">Tracking:</strong> Progress is tracked automatically
            in the progress_records table. Sheep seekers mark milestones as completed for their
            members.
          </p>
          <p className="text-amber-600 dark:text-amber-400">
            <strong>Warning:</strong> Deleting a milestone that has been marked as completed for
            members will fail. You must remove all associated progress records first.
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={isModalVisible}
        onOpenChange={(open) => {
          if (!open) {
            setIsModalVisible(false);
            setFormValues(emptyForm);
            setEditingMilestone(null);
            setIsCreating(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isCreating
                ? 'Add new milestone'
                : `Edit stage ${editingMilestone?.stage_number}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isCreating ? (
              <div className="space-y-2">
                <Label htmlFor="stage_number">Stage number *</Label>
                <Input
                  id="stage_number"
                  type="number"
                  min={1}
                  max={99}
                  placeholder="Enter a unique stage number (1–99)"
                  value={formValues.stage_number}
                  onChange={(e) =>
                    setFormValues((v) => ({ ...v, stage_number: e.target.value }))
                  }
                  required
                />
              </div>
            ) : (
              editingMilestone && (
                <div className="space-y-2">
                  <Label>Stage number</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="tabular-nums text-sm">
                      {editingMilestone.stage_number}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      (Stage numbers cannot be changed)
                    </span>
                  </div>
                </div>
              )
            )}
            <div className="space-y-2">
              <Label htmlFor="stage_name">Milestone name *</Label>
              <Input
                id="stage_name"
                placeholder="e.g., Completed New Believers School"
                value={formValues.stage_name}
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, stage_name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short_name">Short name *</Label>
              <Input
                id="short_name"
                placeholder="e.g., NB School or Water\nBaptism"
                value={formValues.short_name}
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, short_name: e.target.value }))
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                This appears in compact milestone grids. Use \n for line breaks.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Describe what this milestone represents…"
                value={formValues.description}
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, description: e.target.value }))
                }
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalVisible(false);
                  setFormValues(emptyForm);
                  setEditingMilestone(null);
                  setIsCreating(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {isCreating ? 'Create milestone' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this milestone? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
