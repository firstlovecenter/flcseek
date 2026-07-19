'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function SuperadminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-lg font-semibold">Superadmin page failed</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Try again, or return to the superadmin home.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (window.location.href = '/superadmin')}
        >
          Superadmin
        </Button>
      </div>
    </div>
  );
}
