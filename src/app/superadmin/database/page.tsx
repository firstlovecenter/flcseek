'use client';

import { useEffect, useState } from 'react';
import {
  Database,
  Table2,
  User,
  UsersRound,
  Heart,
  CheckCircle,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { message } from '@/lib/toast';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { StatCard } from '@/components/base/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const ALLOWED_TABLES = [
  'users',
  'groups',
  'new_converts',
  'progress_records',
  'attendance_records',
  'milestones',
  'departments',
  'user_groups',
  'activity_logs',
  'notifications',
  'password_reset_tokens',
  'rate_limit_records',
];

interface DatabaseInfo {
  tables: {
    users: number;
    groups: number;
    new_converts: number;
    progress_records: number;
    attendance_records: number;
  };
  totalRecords: number;
}

interface TableSchema {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  position: number;
}

export default function DatabaseManagementPage() {
  const { token } = useAuth();
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<Record<string, TableSchema[]>>({});
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [editFormValues, setEditFormValues] = useState<Record<string, string>>({});
  const [deleteRecord, setDeleteRecord] = useState<Record<string, unknown> | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });

  const getUsernameFromToken = (): string | null => {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload).username;
    } catch {
      return null;
    }
  };

  const username = getUsernameFromToken();
  const isSkaduteye = username === 'skaduteye' || username === 'sysadmin';

  useEffect(() => {
    if (token) {
      fetchDatabaseInfo();
      fetchSchema();
    }
  }, [token]);

  useEffect(() => {
    if (selectedTable && token) {
      fetchTableData(selectedTable, pagination.current);
    }
  }, [selectedTable, pagination.current, pagination.pageSize]);

  useEffect(() => {
    const tableNames = ALLOWED_TABLES.filter((t) => schema[t]);
    if (tableNames.length > 0) {
      const first = tableNames[0];
      if (!selectedTable || !schema[selectedTable]) {
        setSelectedTable(first);
        setPagination((prev) => ({ ...prev, current: 1 }));
      }
    }
  }, [schema, selectedTable]);

  const fetchSchema = async () => {
    try {
      const response = await fetch('/api/superadmin/database/schema', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSchema(data.schema || {});
    } catch {
      message.error('Failed to fetch database schema');
    }
  };

  const fetchTableData = async (tableName: string, page: number = 1) => {
    setTableLoading(true);
    try {
      const response = await fetch('/api/superadmin/database/table-data', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tableName,
          limit: pagination.pageSize,
          offset: (page - 1) * pagination.pageSize,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch table data');
      }

      setTableData(data.data || []);
      setPagination((prev) => ({ ...prev, total: data.total, current: page }));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Failed to fetch table data');
    } finally {
      setTableLoading(false);
    }
  };

  const fetchDatabaseInfo = async () => {
    try {
      const response = await fetch('/api/superadmin/database/info', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setDbInfo(data);
    } catch {
      message.error('Failed to fetch database info');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: Record<string, unknown>) => {
    setEditingRecord(record);
    const values: Record<string, string> = {};
    Object.entries(record).forEach(([key, val]) => {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        values[key] = val === null || val === undefined ? '' : String(val);
      }
    });
    setEditFormValues(values);
    setEditModalVisible(true);
  };

  const handleView = (record: Record<string, unknown>) => {
    setEditingRecord(record);
    setViewModalVisible(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const idField = selectedTable === 'milestones' ? 'stage_number' : 'id';
      const updates: Record<string, unknown> = {};
      const cols = schema[selectedTable] || [];
      cols.forEach((col) => {
        if (col.name === 'id' || col.name === 'created_at' || col.name === 'updated_at') return;
        const raw = editFormValues[col.name];
        if (col.type === 'boolean') {
          updates[col.name] = raw === 'true';
        } else {
          updates[col.name] = raw;
        }
      });

      const response = await fetch('/api/superadmin/database/edit', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tableName: selectedTable,
          id: editingRecord?.[idField],
          updates,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update record');
      }

      message.success('Record updated successfully');
      setEditModalVisible(false);
      fetchTableData(selectedTable, pagination.current);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Failed to update record');
    }
  };

  const handleDelete = async () => {
    if (!deleteRecord) return;
    try {
      const idField = selectedTable === 'milestones' ? 'stage_number' : 'id';
      const response = await fetch(
        `/api/superadmin/database/edit?table=${selectedTable}&id=${deleteRecord[idField]}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete record');
      }

      message.success('Record deleted successfully');
      fetchTableData(selectedTable, pagination.current);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Failed to delete record');
    } finally {
      setDeleteRecord(null);
    }
  };

  const renderCellValue = (text: unknown) => {
    if (text === null || text === undefined) {
      return <span className="text-muted-foreground">NULL</span>;
    }
    if (typeof text === 'boolean') {
      return (
        <Badge variant={text ? 'default' : 'destructive'}>{String(text)}</Badge>
      );
    }
    if (typeof text === 'object') {
      return JSON.stringify(text).substring(0, 50) + '…';
    }
    return String(text).substring(0, 100);
  };

  const getVisibleColumns = (tableName: string) => {
    const columns = schema[tableName] || [];
    const columnLimit = tableName === 'attendance_records' ? columns.length : 8;
    return columns.slice(0, columnLimit);
  };

  const tables = ALLOWED_TABLES.filter((t) => schema[t]);
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  if (loading || !dbInfo) {
    return <LoadingScreen label="Loading database information…" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Database management</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total records"
          value={dbInfo.totalRecords}
          icon={Table2}
          accent="primary"
        />
        <StatCard
          title="Total tables"
          value={tables.length}
          icon={Database}
          accent="campaigns"
        />
        <StatCard
          title="Database status"
          value="Connected"
          icon={CheckCircle}
          accent="campaigns"
          deltaPositive
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Database tables & data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={selectedTable && schema[selectedTable] ? selectedTable : tables[0] || ''}
            onValueChange={(key) => {
              setSelectedTable(key);
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
          >
            <TabsList className="mb-4 h-auto flex-wrap">
              {tables.map((table) => (
                <TabsTrigger key={table} value={table} className="text-xs">
                  {table}
                </TabsTrigger>
              ))}
            </TabsList>
            {tables.map((table) => (
              <TabsContent key={table} value={table} className="space-y-4">
                <div>
                  <p className="text-sm font-medium">
                    Columns ({schema[table]?.length || 0}):
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {schema[table]?.map((col) => (
                      <Badge key={col.name} variant="secondary">
                        {col.name}{' '}
                        <span className="text-muted-foreground">({col.type})</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {getVisibleColumns(table).map((col) => (
                          <TableHead key={col.name}>{col.name}</TableHead>
                        ))}
                        <TableHead className="sticky right-0 bg-card">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: getVisibleColumns(table).length + 1 }).map(
                              (__, j) => (
                                <TableCell key={j}>
                                  <Skeleton className="h-4 w-full" />
                                </TableCell>
                              )
                            )}
                          </TableRow>
                        ))
                      ) : tableData.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={getVisibleColumns(table).length + 1}
                            className="text-center text-muted-foreground"
                          >
                            No records
                          </TableCell>
                        </TableRow>
                      ) : (
                        tableData.map((record, idx) => {
                          const idField = table === 'milestones' ? 'stage_number' : 'id';
                          return (
                            <TableRow key={String(record[idField] ?? idx)}>
                              {getVisibleColumns(table).map((col) => (
                                <TableCell key={col.name} className="max-w-[160px] truncate">
                                  {renderCellValue(record[col.name])}
                                </TableCell>
                              ))}
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleView(record)}
                                  >
                                    <Eye className="size-4" />
                                    View
                                  </Button>
                                  {isSkaduteye && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(record)}
                                      >
                                        <Pencil className="size-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => setDeleteRecord(record)}
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {pagination.total > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground tabular-nums">
                      Total {pagination.total} records
                    </p>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(pagination.pageSize)}
                        onValueChange={(v) =>
                          setPagination((prev) => ({
                            ...prev,
                            pageSize: Number(v),
                            current: 1,
                          }))
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['25', '50', '100'].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s} / page
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.current <= 1}
                        onClick={() =>
                          setPagination((prev) => ({ ...prev, current: prev.current - 1 }))
                        }
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <span className="text-sm tabular-nums">
                        {pagination.current} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.current >= totalPages}
                        onClick={() =>
                          setPagination((prev) => ({ ...prev, current: prev.current + 1 }))
                        }
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={editModalVisible} onOpenChange={setEditModalVisible}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit record in {selectedTable}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            {schema[selectedTable]
              ?.filter(
                (col) =>
                  col.name !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at'
              )
              .map((col) => (
                <div key={col.name} className="space-y-2">
                  <Label htmlFor={col.name}>
                    {col.name} ({col.type})
                  </Label>
                  {col.type === 'boolean' ? (
                    <Select
                      value={editFormValues[col.name] || 'false'}
                      onValueChange={(v) =>
                        setEditFormValues((prev) => ({ ...prev, [col.name]: v }))
                      }
                    >
                      <SelectTrigger id={col.name}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : col.type === 'text' ? (
                    <Textarea
                      id={col.name}
                      rows={3}
                      value={editFormValues[col.name] || ''}
                      onChange={(e) =>
                        setEditFormValues((prev) => ({
                          ...prev,
                          [col.name]: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <Input
                      id={col.name}
                      value={editFormValues[col.name] || ''}
                      onChange={(e) =>
                        setEditFormValues((prev) => ({
                          ...prev,
                          [col.name]: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto">
                Update record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewModalVisible} onOpenChange={setViewModalVisible}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>View record from {selectedTable}</DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <div className="max-h-[500px] space-y-3 overflow-auto">
              {Object.entries(editingRecord).map(([key, value]) => (
                <div key={key} className="border-b border-border pb-3">
                  <p className="font-medium">{key}</p>
                  <div className="mt-1 text-sm">
                    {value === null || value === undefined ? (
                      <span className="text-muted-foreground">NULL</span>
                    ) : typeof value === 'boolean' ? (
                      <Badge variant={value ? 'default' : 'destructive'}>
                        {String(value)}
                      </Badge>
                    ) : typeof value === 'object' ? (
                      <pre className="rounded-md bg-muted p-2 text-xs">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    ) : (
                      <span>{String(value)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewModalVisible(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRecord} onOpenChange={() => setDeleteRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Table statistics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Users" value={dbInfo.tables.users} icon={User} accent="members" />
          <StatCard title="Groups" value={dbInfo.tables.groups} icon={UsersRound} accent="churches" />
          <StatCard title="New converts" value={dbInfo.tables.new_converts} icon={Heart} accent="arrivals" />
          <StatCard
            title="Progress records"
            value={dbInfo.tables.progress_records}
            icon={CheckCircle}
            accent="primary"
          />
          <StatCard
            title="Attendance records"
            value={dbInfo.tables.attendance_records}
            icon={CheckCircle}
            accent="campaigns"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Database information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Database provider:</strong> Neon Database
            (Serverless PostgreSQL)
          </p>
          <p>
            <strong className="text-foreground">Connection:</strong> Pooled connection for optimal
            performance
          </p>
          <p>
            <strong className="text-foreground">Location:</strong> US East (AWS)
          </p>
          <p>
            <strong className="text-foreground">Backup:</strong> Automatic backups managed by Neon
            Database
          </p>
          <div className="mt-4 flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-foreground">Backup recommendation</p>
              <p className="mt-1">
                Neon Database automatically backs up your data. For additional safety, consider
                exporting your data regularly using the export features in each management section.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
