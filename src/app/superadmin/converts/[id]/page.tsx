'use client';

import { useEffect, useState, use } from 'react';
import { Save, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { message } from '@/lib/toast';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Convert {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string;
  date_of_birth: string | null;
  gender: string | null;
  residential_location: string | null;
  school_residential_location: string | null;
  occupation_type: string | null;
  group_name: string;
  registered_by: string;
  created_at: string;
  updated_at: string;
}

interface ConvertFormValues {
  first_name: string;
  last_name: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  residential_location: string;
  school_residential_location: string;
  occupation_type: string;
  group_name: string;
}

export default function EditConvertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convert, setConvert] = useState<Convert | null>(null);
  const [formValues, setFormValues] = useState<ConvertFormValues>({
    first_name: '',
    last_name: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
    residential_location: '',
    school_residential_location: '',
    occupation_type: '',
    group_name: '',
  });

  useEffect(() => {
    if (token) {
      fetchConvert();
    }
  }, [token, id]);

  const fetchConvert = async () => {
    try {
      const response = await fetch(`/api/superadmin/converts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (response.ok) {
        setConvert(data.convert);
        setFormValues({
          first_name: data.convert.first_name || '',
          last_name: data.convert.last_name || '',
          phone_number: data.convert.phone_number || '',
          date_of_birth: data.convert.date_of_birth || '',
          gender: data.convert.gender || '',
          residential_location: data.convert.residential_location || '',
          school_residential_location: data.convert.school_residential_location || '',
          occupation_type: data.convert.occupation_type || '',
          group_name: data.convert.group_name || '',
        });
      } else {
        message.error(data.error || 'Failed to load convert');
        router.back();
      }
    } catch (error) {
      message.error('Failed to fetch convert details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/superadmin/converts/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formValues),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success('Convert details updated successfully');
        setConvert(data.convert);
        setTimeout(() => router.back(), 1000);
      } else {
        message.error(data.error || 'Failed to update convert');
      }
    } catch (error) {
      message.error('Failed to save changes');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen label="Loading convert details…" />;
  }

  if (!convert) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Convert not found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="size-4" />
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-0">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="size-4" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit convert details</CardTitle>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Name:</strong> {convert.full_name}
            </p>
            <p>
              <strong className="text-foreground">Group:</strong>{' '}
              <Badge variant="secondary">{convert.group_name}</Badge>
            </p>
            <p className="tabular-nums">
              <strong className="text-foreground">Created:</strong>{' '}
              {new Date(convert.created_at).toLocaleDateString()}{' '}
              <strong className="text-foreground">Updated:</strong>{' '}
              {new Date(convert.updated_at).toLocaleDateString()}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First name *</Label>
                <Input
                  id="first_name"
                  placeholder="First name"
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
                  placeholder="Last name"
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
                  placeholder="Phone number"
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
                    setFormValues((f) => ({ ...f, gender: v === '__none__' ? '' : v }))
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
                  placeholder="Residential location"
                  value={formValues.residential_location}
                  onChange={(e) =>
                    setFormValues((v) => ({ ...v, residential_location: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school_residential_location">
                  School/residential location (if student)
                </Label>
                <Input
                  id="school_residential_location"
                  placeholder="School or residential location"
                  value={formValues.school_residential_location}
                  onChange={(e) =>
                    setFormValues((v) => ({
                      ...v,
                      school_residential_location: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group_name">Group *</Label>
                <Input id="group_name" value={formValues.group_name} disabled />
              </div>
            </div>

            <Separator />

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                <Save className="size-4" />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
