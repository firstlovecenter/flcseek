'use client';

import { useEffect, useState } from 'react';
import {
  Heart,
  Search,
  User,
  Calendar,
  UsersRound,
  Download,
  Trash2,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { api } from '@/lib/api';
import { message } from '@/lib/toast';
import { StatCard } from '@/components/base/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  group_id: string | null;
  group_year: number | null;
  registered_by_name: string;
  created_at: string;
  completed_stages: number;
  total_attendance: number;
}

interface Stats {
  totalConverts: number;
  thisMonth: number;
  thisWeek: number;
  activeGroups: number;
}

export default function NewConvertsManagementPage() {
  const { token } = useAuth();
  const [converts, setConverts] = useState<Convert[]>([]);
  const [filteredConverts, setFilteredConverts] = useState<Convert[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalConverts: 0,
    thisMonth: 0,
    thisWeek: 0,
    activeGroups: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [groups, setGroups] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [totalMilestones, setTotalMilestones] = useState<number>(18);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (token) {
      fetchConverts();
      fetchStats();
      fetchMilestoneCount();
    }
  }, [token]);

  useEffect(() => {
    filterConverts();
  }, [converts, searchText, groupFilter, yearFilter]);

  const formatGroupLabel = (groupName: string, groupYear: number | null) =>
    groupYear ? `${groupName} ${groupYear}` : groupName;

  const fetchConverts = async () => {
    try {
      const response = await api.people.list({ include: 'stats', limit: 2000 });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch converts');
      }
      const rows = (response.data?.people || []) as Array<{
        id: string;
        full_name?: string;
        first_name?: string;
        last_name?: string;
        phone_number: string;
        gender?: string | null;
        group_name?: string;
        group_id?: string | null;
        group_year?: number | null;
        registered_by_name?: string;
        created_at: string;
        completed_stages?: number;
        attendance_count?: number;
      }>;
      const mapped: Convert[] = rows.map((c) => ({
        id: c.id,
        full_name:
          c.full_name ||
          `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        phone_number: c.phone_number,
        gender: c.gender ?? null,
        group_name: c.group_name || 'Unknown',
        group_id: c.group_id ?? null,
        group_year: c.group_year ?? null,
        registered_by_name: c.registered_by_name || '—',
        created_at: c.created_at,
        completed_stages: c.completed_stages ?? 0,
        total_attendance: c.attendance_count ?? 0,
      }));
      setConverts(mapped);
      setFilteredConverts(mapped);

      const uniqueGroups = Array.from(
        new Set(mapped.map((c) => formatGroupLabel(c.group_name, c.group_year)))
      );
      setGroups(uniqueGroups);

      const uniqueYears = Array.from(
        new Set(
          mapped
            .map((c) => c.group_year)
            .filter((year): year is number => typeof year === 'number')
        )
      ).sort((a, b) => b - a);
      setYears(uniqueYears);

      if (typeof response.data?.totalMilestones === 'number') {
        setTotalMilestones(response.data.totalMilestones);
      }
    } catch {
      console.error('Failed to fetch converts');
      message.error('Failed to fetch converts');
    } finally {
      setLoading(false);
    }
  };

  const fetchMilestoneCount = async () => {
    try {
      const response = await api.milestones.list();
      if (response.success) {
        const list = Array.isArray(response.data)
          ? response.data
          : response.data?.milestones || [];
        const activeMilestones =
          list.filter((m: { is_active?: boolean }) => m.is_active !== false) || [];
        if (activeMilestones.length) setTotalMilestones(activeMilestones.length);
      }
    } catch {
      console.error('Failed to fetch milestone count');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.stats.getDashboard();
      if (!response.success) return;
      const convertsStats = response.data?.converts;
      if (convertsStats) {
        setStats({
          totalConverts: convertsStats.totalConverts ?? 0,
          thisMonth: convertsStats.thisMonth ?? 0,
          thisWeek: convertsStats.thisWeek ?? 0,
          activeGroups: convertsStats.activeGroups ?? 0,
        });
      }
    } catch {
      console.error('Failed to fetch stats');
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
    if (groupFilter !== 'all') {
      filtered = filtered.filter(
        (convert) => formatGroupLabel(convert.group_name, convert.group_year) === groupFilter
      );
    }
    if (yearFilter !== 'all') {
      filtered = filtered.filter((convert) => convert.group_year === Number(yearFilter));
    }
    setFilteredConverts(filtered);
    setCurrentPage(1);
  };

  const handleExport = async (
    format: 'csv' | 'json',
    type: 'converts' | 'progress' | 'attendance' | 'all'
  ) => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.append('type', type);
      params.append('format', format);

      const response = await fetch(`/api/export?${params}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flcseek-${type}-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success(`Exported ${type} as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to export:', error);
      message.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const paginated = filteredConverts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredConverts.length / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Heart className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">New converts management</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total converts"
          value={stats.totalConverts}
          icon={Heart}
          accent="arrivals"
        />
        <StatCard
          title="This month"
          value={stats.thisMonth}
          icon={Calendar}
          accent="campaigns"
          deltaPositive
        />
        <StatCard
          title="This week"
          value={stats.thisWeek}
          icon={Calendar}
          accent="defaulters"
        />
        <StatCard
          title="Active groups"
          value={stats.activeGroups}
          icon={UsersRound}
          accent="churches"
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting}>
                <Download className="size-4" />
                Export data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleExport('csv', 'converts')}>
                <FileSpreadsheet className="size-4" />
                Converts (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json', 'converts')}>
                <FileText className="size-4" />
                Converts (JSON)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('csv', 'progress')}>
                <FileSpreadsheet className="size-4" />
                Progress data (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv', 'attendance')}>
                <FileSpreadsheet className="size-4" />
                Attendance data (CSV)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('json', 'all')}>
                <FileText className="size-4" />
                All data (JSON)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="destructive" asChild>
            <Link href="/superadmin/converts/bulk-delete">
              <Trash2 className="size-4" />
              Bulk delete
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full name</TableHead>
                  <TableHead>Phone number</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Registered by</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Registered date</TableHead>
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
                        <Link
                          href={
                            record.group_id
                              ? `/${record.group_id}/person/${record.id}`
                              : `/superadmin/converts/${record.id}`
                          }
                          className="font-medium text-primary hover:underline"
                        >
                          {record.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{record.phone_number}</TableCell>
                      <TableCell>{record.gender || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <UsersRound className="mr-1 size-3" />
                          {formatGroupLabel(record.group_name, record.group_year)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/15 text-green-700 dark:text-green-300">
                          <User className="mr-1 size-3" />
                          {record.registered_by_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        <div>Stages: {record.completed_stages}/{totalMilestones}</div>
                        <div>Attendance: {record.total_attendance}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {new Date(record.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {!loading && filteredConverts.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground tabular-nums">
                Total {filteredConverts.length} converts
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
    </div>
  );
}
