'use client';

import { useState, useEffect } from 'react';
import { Users, X } from 'lucide-react';
import { SynagoLoader } from '@/components/shell/SynagoLoader';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

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
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const assignedData = await assignedRes.json();

      let groupsList: Group[] = [];
      if (groupsRes.success && groupsRes.data) {
        groupsList = Array.isArray(groupsRes.data)
          ? groupsRes.data
          : groupsRes.data.groups || [];
      }
      setAllGroups(groupsList);
      setSelectedGroupIds((assignedData.groups || []).map((g: UserGroup) => g.group_id));
    } catch {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/superadmin/users/${userId}/groups`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupIds: selectedGroupIds }),
      });

      if (response.ok) {
        toast.success('Groups updated successfully');
        onClose();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update groups');
      }
    } catch {
      toast.error('Failed to update groups');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (groupId: string) => {
    setSelectedGroupIds((prev) => prev.filter((id) => id !== groupId));
  };

  const handleAdd = (groupId: string) => {
    if (!selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds((prev) => [...prev, groupId]);
    }
  };

  const unassignedGroups = allGroups.filter((g) => !selectedGroupIds.includes(g.id));

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" />
            Manage Groups for {username}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <SynagoLoader size={32} />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-3 font-medium">
                Assigned Groups ({selectedGroupIds.length})
              </p>
              {selectedGroupIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No groups assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedGroupIds.map((groupId) => {
                    const group = allGroups.find((g) => g.id === groupId);
                    if (!group) return null;
                    return (
                      <Badge key={groupId} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                        <Users className="size-3" />
                        {group.name} ({group.year})
                        <button
                          type="button"
                          onClick={() => handleRemove(groupId)}
                          className="ml-1 rounded-sm p-0.5 hover:bg-muted"
                          aria-label={`Remove ${group.name}`}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {unassignedGroups.length > 0 && (
              <div>
                <p className="mb-3 font-medium">Add Groups</p>
                <Select onValueChange={handleAdd}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-md bg-primary/5 p-3 text-xs text-muted-foreground">
              Users can be assigned to multiple groups for flexibility. Changes will be saved when
              you click Save Changes.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <SynagoLoader size={16} inline />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
