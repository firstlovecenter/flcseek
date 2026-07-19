'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Home,
  MapPin,
  Pencil,
  Phone,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { message } from '@/lib/toast';
import { useConfirm } from '@/hooks/use-confirm';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import { completionPercent } from '@/lib/progress-utils';
import type { PersonApiData, ProgressEntry } from '@/lib/types/api-responses';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { GroupNavActions } from '@/components/group/GroupNavActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface AttendanceEntry {
  id: string;
  person_id: string;
  date_attended: string;
  recorded_by?: string;
  created_at?: string;
}

type PersonDetail = PersonApiData & {
  progress?: ProgressEntry[];
  attendance?: AttendanceEntry[];
  attendance_count?: number;
};

interface FormValues {
  first_name: string;
  last_name: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  residential_location: string;
  school_residential_location: string;
  occupation_type: string;
}

function emptyForm(): FormValues {
  return {
    first_name: '',
    last_name: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
    residential_location: '',
    school_residential_location: '',
    occupation_type: '',
  };
}

function formFromPerson(person: PersonDetail): FormValues {
  return {
    first_name: person.first_name || '',
    last_name: person.last_name || '',
    phone_number: person.phone_number || '',
    date_of_birth: person.date_of_birth || '',
    gender: person.gender || '',
    residential_location: person.residential_location || '',
    school_residential_location: person.school_residential_location || '',
    occupation_type: person.occupation_type || '',
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function InfoTile({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-muted/30 p-4', className)}>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="text-base font-semibold">{value || '—'}</div>
    </div>
  );
}

export interface ConvertProfileProps {
  personId: string;
  /** When set, shows group nav and redirects here after delete. */
  groupId?: string;
  /** Called after a successful soft-delete. Defaults to group home or back. */
  onDeleted?: () => void;
}

export function ConvertProfile({ personId, groupId, onDeleted }: ConvertProfileProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();

  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(emptyForm());

  const canEdit =
    user?.role === 'admin' || user?.role === 'superadmin';
  const canDelete =
    user?.role === 'admin' ||
    user?.role === 'overseer' ||
    user?.role === 'leadpastor' ||
    user?.role === 'superadmin';

  const loadPerson = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.people.get(personId);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to load convert');
      }
      const data = (res.data?.person ?? res.data) as PersonDetail;
      if (!data?.id) {
        throw new Error('Convert not found');
      }
      setPerson(data);
      setFormValues(formFromPerson(data));
    } catch (err: unknown) {
      setPerson(null);
      setError(err instanceof Error ? err.message : 'Failed to load convert');
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void loadPerson();
  }, [loadPerson]);

  const progress = useMemo(
    () =>
      [...(person?.progress ?? [])].sort(
        (a, b) => a.stage_number - b.stage_number
      ),
    [person?.progress]
  );

  const attendance = useMemo(
    () =>
      [...(person?.attendance ?? [])].sort((a, b) =>
        b.date_attended.localeCompare(a.date_attended)
      ),
    [person?.attendance]
  );

  const completedMilestones = progress.filter((p) => p.is_completed).length;
  const attendanceCount =
    person?.attendance_count ?? attendance.length;
  const milestonePct = completionPercent(completedMilestones, progress.length);
  const attendancePct = Math.min(
    100,
    Math.round((attendanceCount / ATTENDANCE_GOAL) * 100)
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !person) return;
    setSaving(true);
    try {
      const res = await api.people.update(person.id, {
        first_name: formValues.first_name,
        last_name: formValues.last_name,
        phone_number: formValues.phone_number,
        date_of_birth: formValues.date_of_birth || '',
        gender: formValues.gender || '',
        residential_location: formValues.residential_location || '',
        school_residential_location: formValues.school_residential_location || '',
        occupation_type: formValues.occupation_type || '',
      });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to update convert');
      }
      message.success('Convert details updated');
      setEditing(false);
      await loadPerson();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || !person) return;
    const ok = await confirm({
      title: 'Delete this convert?',
      description:
        'This will soft delete the convert. Their records are preserved but hidden from active views.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      setDeleting(true);
      const res = await api.people.delete(person.id);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to delete convert');
      }
      message.success('Convert deleted successfully');
      if (onDeleted) {
        onDeleted();
      } else if (groupId) {
        router.push(`/${groupId}`);
      } else {
        router.back();
      }
    } catch (err: unknown) {
      message.error(
        err instanceof Error ? err.message : 'Failed to delete convert'
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingScreen label="Loading convert…" />;
  }

  if (error || !person) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
        {error || 'Convert not found'}
        <Button size="sm" variant="outline" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <>
      {ConfirmDialog}
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {person.first_name} {person.last_name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Convert profile
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {groupId && user && (
              <GroupNavActions groupId={groupId} user={user} active="milestones" />
            )}
            {canEdit && !editing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFormValues(formFromPerson(person));
                  setEditing(true);
                }}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-[#003366] to-[#004080] px-8 py-7">
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex size-[76px] shrink-0 items-center justify-center rounded-full bg-white text-3xl font-bold text-[#003366] shadow-md">
                  {person.first_name?.charAt(0)}
                  {person.last_name?.charAt(0)}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <h2 className="text-2xl font-bold text-white">
                    {person.first_name} {person.last_name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {person.group_name && (
                      <Badge className="bg-white/15 text-white hover:bg-white/20">
                        <Calendar className="mr-1 size-3" />
                        {person.group_name}
                        {person.group_year ? ` ${person.group_year}` : ''}
                      </Badge>
                    )}
                    {person.occupation_type && (
                      <Badge className="bg-white/15 text-white hover:bg-white/20">
                        <Briefcase className="mr-1 size-3" />
                        {person.occupation_type}
                      </Badge>
                    )}
                    {person.gender && (
                      <Badge className="bg-white/15 text-white hover:bg-white/20">
                        <User className="mr-1 size-3" />
                        {person.gender}
                      </Badge>
                    )}
                  </div>
                  <div className="grid max-w-md gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs text-white/70">
                        Milestones {completedMilestones}/{progress.length}
                      </p>
                      <Progress value={milestonePct} className="h-2 bg-white/20 [&>div]:bg-white" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-white/70">
                        Attendance {attendanceCount}/{ATTENDANCE_GOAL}
                      </p>
                      <Progress
                        value={attendancePct}
                        className="h-2 bg-white/20 [&>div]:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="space-y-8 p-6">
              {editing ? (
                <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-primary">
                      <Pencil className="size-5" />
                      Edit personal information
                    </h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(false);
                        setFormValues(formFromPerson(person));
                      }}
                    >
                      <X className="size-4" />
                      Cancel
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First name *</Label>
                      <Input
                        id="first_name"
                        value={formValues.first_name}
                        onChange={(e) =>
                          setFormValues((v) => ({ ...v, first_name: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last name *</Label>
                      <Input
                        id="last_name"
                        value={formValues.last_name}
                        onChange={(e) =>
                          setFormValues((v) => ({ ...v, last_name: e.target.value }))
                        }
                        required
                      />
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
                      <Label htmlFor="date_of_birth">Date of birth (DD-MM)</Label>
                      <Input
                        id="date_of_birth"
                        placeholder="e.g., 15-03"
                        value={formValues.date_of_birth}
                        onChange={(e) =>
                          setFormValues((v) => ({ ...v, date_of_birth: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Select
                        value={formValues.gender || '__none__'}
                        onValueChange={(v) =>
                          setFormValues((f) => ({
                            ...f,
                            gender: v === '__none__' ? '' : v,
                          }))
                        }
                      >
                        <SelectTrigger id="gender">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not specified</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="occupation_type">Worker or student</Label>
                      <Select
                        value={formValues.occupation_type || '__none__'}
                        onValueChange={(v) =>
                          setFormValues((f) => ({
                            ...f,
                            occupation_type: v === '__none__' ? '' : v,
                          }))
                        }
                      >
                        <SelectTrigger id="occupation_type">
                          <SelectValue placeholder="Select worker or student" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not specified</SelectItem>
                          <SelectItem value="Worker">Worker</SelectItem>
                          <SelectItem value="Student">Student</SelectItem>
                          <SelectItem value="Unemployed">Unemployed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="residential_location">Residential location</Label>
                      <Input
                        id="residential_location"
                        value={formValues.residential_location}
                        onChange={(e) =>
                          setFormValues((v) => ({
                            ...v,
                            residential_location: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="school_residential_location">
                        School/residential location (if student)
                      </Label>
                      <Input
                        id="school_residential_location"
                        value={formValues.school_residential_location}
                        onChange={(e) =>
                          setFormValues((v) => ({
                            ...v,
                            school_residential_location: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={saving}>
                    <Save className="size-4" />
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </form>
              ) : (
                <>
                  <section>
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
                      <Phone className="size-5" />
                      Contact information
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoTile
                        label="Phone number"
                        value={
                          person.phone_number ? (
                            <a
                              href={`tel:${person.phone_number}`}
                              className="text-primary hover:underline"
                            >
                              {person.phone_number}
                            </a>
                          ) : (
                            '—'
                          )
                        }
                      />
                      <InfoTile
                        label="Date of birth"
                        value={person.date_of_birth || '—'}
                      />
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
                      <User className="size-5" />
                      Personal details
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoTile label="Gender" value={person.gender || '—'} />
                      <InfoTile
                        label="Occupation type"
                        value={person.occupation_type || '—'}
                      />
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
                      <MapPin className="size-5" />
                      Location
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoTile
                        label="Residential location"
                        value={
                          <span className="inline-flex items-center gap-2">
                            <Home className="size-4 text-muted-foreground" />
                            {person.residential_location || '—'}
                          </span>
                        }
                      />
                      <InfoTile
                        label="School location"
                        value={person.school_residential_location || '—'}
                      />
                    </div>
                  </section>

                  {(person.created_at ||
                    person.updated_at ||
                    person.registered_by_name) && (
                    <section className="border-t pt-6">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InfoTile
                          label="Registered"
                          value={formatDate(person.created_at)}
                        />
                        <InfoTile
                          label="Registered by"
                          value={person.registered_by_name || '—'}
                        />
                        <InfoTile
                          label="Last updated"
                          value={formatDate(person.updated_at)}
                        />
                      </div>
                    </section>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <CheckCircle2 className="size-4" />
                Milestone records
                <span className="font-normal text-muted-foreground">
                  ({completedMilestones}/{progress.length} complete)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {progress.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No milestone records yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Stage</TableHead>
                        <TableHead>Milestone</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead className="w-36">Completed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {progress.map((row) => (
                        <TableRow key={`${row.stage_number}-${row.stage_name}`}>
                          <TableCell className="tabular-nums font-medium">
                            M{String(row.stage_number).padStart(2, '0')}
                          </TableCell>
                          <TableCell>{row.stage_name}</TableCell>
                          <TableCell>
                            {row.is_completed ? (
                              <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20">
                                <CheckCircle2 className="size-3" />
                                Done
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <Circle className="size-3" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {row.is_completed
                              ? formatDate(row.date_completed)
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <CalendarCheck className="size-4" />
                Attendance records
                <span className="font-normal text-muted-foreground">
                  ({attendanceCount}/{ATTENDANCE_GOAL})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No attendance recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Date attended</TableHead>
                        <TableHead>Recorded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((row, index) => (
                        <TableRow key={row.id}>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {attendance.length - index}
                          </TableCell>
                          <TableCell className="font-medium tabular-nums">
                            {formatDate(row.date_attended)}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {formatDate(row.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
