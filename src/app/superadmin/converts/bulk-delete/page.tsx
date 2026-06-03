'use client';

import { useEffect, useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { message } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface Convert {
  id: string;
  full_name: string;
  phone_number: string;
  gender: string | null;
  group_name: string;
  group_year: number | null;
  registered_by_name: string;
  created_at: string;
  completed_stages: number;
  total_attendance: number;
}

export default function BulkDeleteConvertsPage() {
  const { token } = useAuth();
  const [converts, setConverts] = useState<Convert[]>([]);
  const [filteredConverts, setFilteredConverts] = useState<Convert[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('__all__');
  const [filterYear, setFilterYear] = useState<string>('__all__');
  const [filterGender, setFilterGender] = useState<string>('__all__');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    if (token) {
      fetchConverts();
    }
  }, [token]);

  useEffect(() => {
    filterConverts();
  }, [converts, searchText, filterGroup, filterYear, filterGender]);

  const fetchConverts = async () => {
    try {
      const response = await fetch('/api/superadmin/converts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setConverts(data.converts || []);
      setFilteredConverts(data.converts || []);
    } catch {
      message.error('Failed to fetch converts');
    } finally {
      setLoading(false);
    }
  };

  const filterConverts = () => {
    let filtered = [...converts];

    if (searchText) {
      filtered = filtered.filter(
        (convert) =>
          convert.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
          convert.phone_number.includes(searchText)
      );
    }
    if (filterGroup !== '__all__') {
      filtered = filtered.filter((convert) => convert.group_name === filterGroup);
    }
    if (filterYear !== '__all__') {
      filtered = filtered.filter((convert) => convert.group_year === Number(filterYear));
    }
    if (filterGender !== '__all__') {
      filtered = filtered.filter((convert) => convert.gender === filterGender);
    }

    setFilteredConverts(filtered);
    setCurrentPage(1);
  };

  const handleSelectChange = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredConverts.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const getUniqueGroups = () => {
    const groups = new Set(converts.map((c) => c.group_name).filter(Boolean));
    return Array.from(groups).sort();
  };

  const getUniqueYears = () => {
    const years = new Set(converts.map((c) => c.group_year).filter(Boolean) as number[]);
    return Array.from(years).sort((a, b) => b - a);
  };

  const clearFilters = () => {
    setSearchText('');
    setFilterGroup('__all__');
    setFilterYear('__all__');
    setFilterGender('__all__');
    setSelectedIds(new Set());
  };

  const hasFilters =
    searchText || filterGroup !== '__all__' || filterYear !== '__all__' || filterGender !== '__all__';

  const performBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      message.warning('No converts selected');
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch('/api/superadmin/converts/bulk-delete', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ person_ids: ids }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        message.success(
          `Deleted ${result.deleted_count} convert(s) and all their related data`
        );
        setSelectedIds(new Set());
        await fetchConverts();
      } else {
        message.error(`Error: ${result.error || 'Failed to delete'}`);
      }
    } catch (error) {
      message.error('Failed to perform bulk delete');
      console.error(error);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const handleDeleteClick = () => {
    if (selectedIds.size === 0) {
      message.warning('No converts selected');
      return;
    }
    setConfirmOpen(true);
  };

  const paginated = filteredConverts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredConverts.length / pageSize);
  const allSelected =
    filteredConverts.length > 0 && selectedIds.size === filteredConverts.length;

  return (
    <div className="space-y-6 p-2 sm:p-0">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            Bulk delete new converts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border-l-4 border-amber-500 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <AlertTriangle className="size-4" />
              Danger zone — this operation is irreversible!
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              You can select multiple converts below and delete them along with ALL their related
              data including progress records, attendance records, and all other associated
              information.
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone number"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All groups</SelectItem>
                  {getUniqueGroups().map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All years</SelectItem>
                  {getUniqueYears().map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Filter by gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All genders</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  <Filter className="size-4" />
                  Clear filters
                </Button>
              )}
            </div>

            <p className="text-sm text-muted-foreground tabular-nums">
              Showing {filteredConverts.length} of {converts.length} converts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold tabular-nums">Selected: {selectedIds.size}</span>
            {selectedIds.size > 0 && (
              <>
                <Button variant="destructive" onClick={handleDeleteClick} disabled={deleting}>
                  <Trash2 className="size-4" />
                  Delete selected ({selectedIds.size})
                </Button>
                <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                  Clear selection
                </Button>
              </>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Attendance</TableHead>
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
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No converts found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(record.id)}
                          onCheckedChange={(checked) =>
                            handleSelectChange(record.id, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{record.full_name}</TableCell>
                      <TableCell className="tabular-nums">{record.phone_number}</TableCell>
                      <TableCell>{record.gender || '—'}</TableCell>
                      <TableCell>
                        <div className="font-medium">{record.group_name}</div>
                        {record.group_year && (
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {record.group_year}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="tabular-nums">
                          {record.completed_stages}/18 stages
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="tabular-nums">
                          {record.total_attendance} records
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && filteredConverts.length > pageSize && (
            <div className="flex items-center justify-end gap-2">
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
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Confirm bulk delete
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-sm text-muted-foreground">
                <p className="font-semibold text-destructive">
                  You are about to permanently delete {selectedIds.size} convert(s) and ALL their
                  related data:
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Delete from new_converts table</li>
                  <li>Delete from progress_records table</li>
                  <li>Delete from attendance_records table</li>
                </ul>
                <p className="font-semibold text-foreground">This action cannot be undone.</p>
                <div>
                  <p className="font-medium text-foreground">Selected converts:</p>
                  <ul className="mt-1 space-y-0.5">
                    {Array.from(selectedIds)
                      .slice(0, 5)
                      .map((sid) => {
                        const c = converts.find((x) => x.id === sid);
                        return c ? (
                          <li key={sid}>
                            {c.full_name} ({c.phone_number})
                          </li>
                        ) : null;
                      })}
                    {selectedIds.size > 5 && (
                      <li>…and {selectedIds.size - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn('bg-destructive text-destructive-foreground hover:bg-destructive/90')}
              onClick={performBulkDelete}
              disabled={deleting}
            >
              Yes, delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
