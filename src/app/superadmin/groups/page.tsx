'use client';

import { useEffect, useState } from 'react';
import {
  UsersRound,
  Pencil,
  Trash2,
  Plus,
  Search,
  User,
  Archive,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { GROUP_FILTERS, GroupFilter } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { message } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Skeleton } from '@/components/ui/skeleton';

const monthOrder: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

interface Group {
  id: string;
  name: string;
  year: number;
  description: string;
  archived: boolean;
  leader_id: string | null;
  leader_name: string | null;
  member_count: number;
  created_at: string;
}

interface User {
  id: string;
  username: string;
}

interface GroupFormValues {
  name: string;
  year: string;
  description: string;
  leader_id: string;
  archived: string;
}

const emptyGroupForm: GroupFormValues = {
  name: '',
  year: String(new Date().getFullYear()),
  description: '',
  leader_id: '',
  archived: 'false',
};

export default function GroupsManagementPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<GroupFilter>(GROUP_FILTERS.ACTIVE);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formValues, setFormValues] = useState<GroupFormValues>(emptyGroupForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const availableYears = Array.from(
    { length: new Date().getFullYear() - 2025 + 1 },
    (_, idx) => 2025 + idx
  );

  useEffect(() => {
    if (token) {
      fetchGroups();
      fetchUsers();
    }
  }, [token, filter]);

  useEffect(() => {
    filterGroups();
  }, [groups, searchText]);

  const filterGroups = () => {
    if (!searchText) {
      setFilteredGroups(groups);
    } else {
      const filtered = groups.filter(
        (group) =>
          group.name.toLowerCase().includes(searchText.toLowerCase()) ||
          (group.description &&
            group.description.toLowerCase().includes(searchText.toLowerCase())) ||
          (group.leader_name &&
            group.leader_name.toLowerCase().includes(searchText.toLowerCase()))
      );
      setFilteredGroups(filtered);
    }
    setCurrentPage(1);
  };

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await api.groups.list({
        active:
          filter === GROUP_FILTERS.ACTIVE
            ? true
            : filter === GROUP_FILTERS.ARCHIVED
              ? false
              : undefined,
      });

      if (response.success && response.data) {
        const sorted = (response.data.groups || []).slice().sort((a: Group, b: Group) => {
          if (b.year !== a.year) return b.year - a.year;
          const aOrder = monthOrder[a.name.toLowerCase()] || 999;
          const bOrder = monthOrder[b.name.toLowerCase()] || 999;
          return aOrder - bOrder;
        });
        setGroups(sorted);
        setFilteredGroups(sorted);
      } else {
        message.error(response.error?.message || 'Failed to fetch groups');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.users.list();
      if (response.success && response.data) {
        setUsers(response.data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormValues({
      name: group.name,
      year: String(group.year),
      description: group.description || '',
      leader_id: group.leader_id || '',
      archived: String(group.archived),
    });
    setIsModalVisible(true);
  };

  const handleArchive = async (groupId: string, archived: boolean) => {
    try {
      const response = await api.groups.update(groupId, { archived: !archived });
      if (response.success) {
        message.success(`Group ${!archived ? 'archived' : 'unarchived'} successfully`);
        fetchGroups();
      } else {
        message.error(response.error?.message || 'Failed to update group');
      }
    } catch {
      message.error('An error occurred');
    }
  };

  const handleDelete = async () => {
    if (!deleteGroupId) return;
    try {
      const response = await api.groups.delete(deleteGroupId);
      if (response.success) {
        message.success('Group deleted successfully');
        fetchGroups();
      } else {
        message.error(response.error?.message || 'Failed to delete group');
      }
    } catch {
      message.error('Failed to delete group');
    } finally {
      setDeleteGroupId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.name || !formValues.year) {
      message.error('Please fill in required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formValues.name,
        year: Number(formValues.year),
        description: formValues.description,
        leader_id: formValues.leader_id || null,
        ...(editingGroup ? { archived: formValues.archived === 'true' } : {}),
      };

      const response = editingGroup
        ? await api.groups.update(editingGroup.id, payload)
        : await api.groups.create({
            name: payload.name,
            year: payload.year,
            description: payload.description,
            leader_id: payload.leader_id || undefined,
          });

      if (response.success) {
        message.success(`Group ${editingGroup ? 'updated' : 'created'} successfully`);
        setIsModalVisible(false);
        setFormValues(emptyGroupForm);
        setEditingGroup(null);
        fetchGroups();
      } else {
        message.error(response.error?.message || 'Failed to save group');
      }
    } catch {
      message.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const paginatedGroups = filteredGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredGroups.length / pageSize);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <UsersRound className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Group management</h1>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search groups…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as GroupFilter)}
            >
              <TabsList>
                <TabsTrigger value={GROUP_FILTERS.ACTIVE}>Active</TabsTrigger>
                <TabsTrigger value={GROUP_FILTERS.ARCHIVED}>Archived</TabsTrigger>
                <TabsTrigger value={GROUP_FILTERS.ALL}>All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Button
            onClick={() => {
              setEditingGroup(null);
              setFormValues(emptyGroupForm);
              setIsModalVisible(true);
            }}
          >
            <Plus className="size-4" />
            Create group
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created at</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No groups found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedGroups.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline"
                          onClick={() => router.push(`/${record.id}`)}
                        >
                          {record.name} {record.year}
                        </button>
                      </TableCell>
                      <TableCell>
                        {record.archived ? (
                          <Badge variant="secondary">
                            <Archive className="mr-1 size-3" />
                            Archived
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500/15 text-green-700 dark:text-green-300">
                            <CheckCircle className="mr-1 size-3" />
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{record.description || '—'}</TableCell>
                      <TableCell>
                        {record.leader_name ? (
                          <Badge variant="secondary">
                            <User className="mr-1 size-3" />
                            {record.leader_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline">No leader</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/15 text-green-700 dark:text-green-300 tabular-nums">
                          {record.member_count} members
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {new Date(record.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(record.id, record.archived)}
                          >
                            {record.archived ? 'Unarchive' : 'Archive'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteGroupId(record.id)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && filteredGroups.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground tabular-nums">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredGroups.length)} of{' '}
                {filteredGroups.length} groups
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
                    {['10', '20', '50', '100'].map((s) => (
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

      <Dialog
        open={isModalVisible}
        onOpenChange={(open) => {
          if (!open) {
            setIsModalVisible(false);
            setFormValues(emptyGroupForm);
            setEditingGroup(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit group' : 'Create new group'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group name *</Label>
              <Input
                id="name"
                placeholder="e.g., January, February, March"
                value={formValues.name}
                onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              <Select
                value={formValues.year}
                onValueChange={(v) => setFormValues((f) => ({ ...f, year: v }))}
              >
                <SelectTrigger id="year">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Optional description for this group"
                value={formValues.description}
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leader_id">Group leader</Label>
              <Select
                value={formValues.leader_id || '__none__'}
                onValueChange={(v) =>
                  setFormValues((f) => ({
                    ...f,
                    leader_id: v === '__none__' ? '' : v,
                  }))
                }
              >
                <SelectTrigger id="leader_id">
                  <SelectValue placeholder="Select a leader (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingGroup && (
              <div className="space-y-2">
                <Label htmlFor="archived">Status</Label>
                <Select
                  value={formValues.archived}
                  onValueChange={(v) => setFormValues((f) => ({ ...f, archived: v }))}
                >
                  <SelectTrigger id="archived">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Active</SelectItem>
                    <SelectItem value="true">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalVisible(false);
                  setFormValues(emptyGroupForm);
                  setEditingGroup(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {editingGroup ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this group? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
