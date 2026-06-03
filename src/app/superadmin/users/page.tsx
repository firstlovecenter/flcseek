'use client';

import { useEffect, useState } from 'react';
import {
  User,
  Pencil,
  Trash2,
  Plus,
  Search,
  UsersRound,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserGroupsModal from '@/components/UserGroupsModal';
import { api } from '@/lib/api';
import { message } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface User {
  id: string;
  username: string;
  role: string;
  phone_number: string;
  group_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  year: number;
}

interface UserFormValues {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: string;
  phone_number: string;
  group_name: string;
}

const emptyForm: UserFormValues = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  role: '',
  phone_number: '',
  group_name: '',
};

const roleBadgeClass: Record<string, string> = {
  superadmin: 'bg-red-500/15 text-red-700 dark:text-red-300',
  leadpastor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  overseer: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  admin: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  leader: 'bg-green-500/15 text-green-700 dark:text-green-300',
};

const roleLabels: Record<string, string> = {
  superadmin: 'Super Admin',
  leadpastor: 'Lead Pastor',
  overseer: 'Overseer',
  admin: 'Admin',
  leader: 'Leader',
};

export default function UsersManagementPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formValues, setFormValues] = useState<UserFormValues>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [groupsModalVisible, setGroupsModalVisible] = useState(false);
  const [selectedUserForGroups, setSelectedUserForGroups] = useState<User | null>(null);

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchGroups();
    }
  }, [token]);

  useEffect(() => {
    filterUsers();
  }, [users, searchText, roleFilter]);

  const fetchUsers = async () => {
    try {
      const response = await api.users.list();
      if (response.success && response.data) {
        setUsers(response.data.users || []);
        setFilteredUsers(response.data.users || []);
      } else {
        message.error(response.error?.message || 'Failed to fetch users');
      }
    } catch {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await api.groups.list({ active: true });
      if (response.success && response.data) {
        setGroups(response.data.groups || []);
        return response.data.groups || [];
      }
      return [];
    } catch {
      console.error('Failed to fetch groups');
      return [];
    }
  };

  const filterUsers = () => {
    let filtered = [...users];
    if (searchText) {
      filtered = filtered.filter(
        (user) =>
          user.username.toLowerCase().includes(searchText.toLowerCase()) ||
          user.phone_number.includes(searchText)
      );
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }
    setFilteredUsers(filtered);
    setCurrentPage(1);
  };

  const openEditModal = (user: User, loadedGroups: Group[]) => {
    setEditingUser(user);
    let groupName = user.group_name || '';
    if (user.group_name && loadedGroups.length > 0 && !user.group_name.includes('-')) {
      const matchingGroup = loadedGroups
        .filter((g) => g.name === user.group_name)
        .sort((a, b) => b.year - a.year)[0];
      if (matchingGroup) {
        groupName = `${matchingGroup.name}-${matchingGroup.year}`;
      }
    }
    setFormValues({
      username: user.username,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      password: '',
      role: user.role,
      phone_number: user.phone_number,
      group_name: groupName,
    });
    setIsModalVisible(true);
  };

  const handleEdit = (user: User) => {
    if (groups.length === 0) {
      fetchGroups().then((loaded) => openEditModal(user, loaded));
    } else {
      openEditModal(user, groups);
    }
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    try {
      await fetch(`/api/superadmin/users/${deleteUserId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success('User deleted successfully');
      fetchUsers();
    } catch {
      message.error('Failed to delete user');
    } finally {
      setDeleteUserId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.username || !formValues.role || !formValues.phone_number) {
      message.error('Please fill in required fields');
      return;
    }
    if (!editingUser && !formValues.password) {
      message.error('Please enter password');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingUser
        ? `/api/superadmin/users/${editingUser.id}`
        : '/api/superadmin/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload: Record<string, string> = { ...formValues };
      if (editingUser && !payload.password) {
        delete payload.password;
      }
      if (!payload.group_name) {
        delete payload.group_name;
      }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        message.success(`User ${editingUser ? 'updated' : 'created'} successfully`);
        setIsModalVisible(false);
        setFormValues(emptyForm);
        setEditingUser(null);
        fetchUsers();
      } else {
        message.error(data.error || 'Failed to save user');
      }
    } catch (error: unknown) {
      console.error('Error saving user:', error);
      message.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <User className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">User management</h1>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="superadmin">Super Admin</SelectItem>
              <SelectItem value="leadpastor">Lead Pastor</SelectItem>
              <SelectItem value="overseer">Overseer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="leader">Leader</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setEditingUser(null);
              setFormValues(emptyForm);
              if (groups.length === 0) {
                fetchGroups().then(() => setIsModalVisible(true));
              } else {
                setIsModalVisible(true);
              }
            }}
          >
            <Plus className="size-4" />
            Add user
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Created at</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((record) => {
                    const fullName = [record.first_name, record.last_name]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.username}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(roleBadgeClass[record.role] || '')}
                          >
                            {roleLabels[record.role] || record.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{record.phone_number}</TableCell>
                        <TableCell>{fullName || '—'}</TableCell>
                        <TableCell>{record.email || '—'}</TableCell>
                        <TableCell>{record.group_name || '—'}</TableCell>
                        <TableCell className="tabular-nums">
                          {new Date(record.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUserForGroups(record);
                                setGroupsModalVisible(true);
                              }}
                            >
                              <UsersRound className="size-4" />
                              Groups
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                              <Pencil className="size-4" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteUserId(record.id)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && filteredUsers.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground tabular-nums">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredUsers.length)} of{' '}
                {filteredUsers.length} users
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
            setFormValues(emptyForm);
            setEditingUser(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit user' : 'Create new user'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formValues.username}
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, username: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First name</Label>
                <Input
                  id="first_name"
                  placeholder="Optional"
                  value={formValues.first_name}
                  onChange={(e) =>
                    setFormValues((v) => ({ ...v, first_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last name</Label>
                <Input
                  id="last_name"
                  placeholder="Optional"
                  value={formValues.last_name}
                  onChange={(e) =>
                    setFormValues((v) => ({ ...v, last_name: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Optional"
                value={formValues.email}
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {editingUser ? 'New password (leave blank to keep current)' : 'Password *'}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={editingUser ? 'Leave blank to keep current password' : ''}
                value={formValues.password}
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, password: e.target.value }))
                }
                required={!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formValues.role}
                onValueChange={(v) => setFormValues((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                  <SelectItem value="leadpastor">Lead Pastor</SelectItem>
                  <SelectItem value="overseer">Overseer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone number *</Label>
              <Input
                id="phone_number"
                value={formValues.phone_number}
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, phone_number: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group_name">Group name</Label>
              <Select
                value={formValues.group_name || '__none__'}
                onValueChange={(v) =>
                  setFormValues((f) => ({
                    ...f,
                    group_name: v === '__none__' ? '' : v,
                  }))
                }
              >
                <SelectTrigger id="group_name">
                  <SelectValue placeholder="Optional — select a group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={`${group.name}-${group.year}`}>
                      {group.name} ({group.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalVisible(false);
                  setFormValues(emptyForm);
                  setEditingUser(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {editingUser ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
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

      {selectedUserForGroups && (
        <UserGroupsModal
          visible={groupsModalVisible}
          onClose={() => {
            setGroupsModalVisible(false);
            setSelectedUserForGroups(null);
          }}
          userId={selectedUserForGroups.id}
          username={selectedUserForGroups.username}
        />
      )}
    </div>
  );
}
