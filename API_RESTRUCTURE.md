# API Restructure Summary

## Overview

The API has been restructured with a new versioned approach (`/api/v1/`) that provides:

1. **Consistent Response Format** - All endpoints return standardized JSON responses
2. **Centralized Query Layer** - Database operations are organized by domain
3. **Standardized Middleware** - Authentication and authorization helpers
4. **Input Validation** - Reusable validation utilities
5. **Type Safety** - TypeScript types throughout

## New Directory Structure

```
lib/
├── api/
│   ├── index.ts        # Central exports
│   ├── response.ts     # Standardized API responses
│   ├── middleware.ts   # Auth middleware (requireAuth, requireAdmin, etc.)
│   ├── validators.ts   # Input validation utilities
│   └── client.ts       # Browser-side API client
│
└── db/
    ├── index.ts        # Database connection & query utilities
    └── queries/
        ├── people.ts     # People (new_converts) operations
        ├── groups.ts     # Groups operations
        ├── users.ts      # Users operations
        ├── progress.ts   # Progress records operations
        ├── attendance.ts # Attendance records operations
        └── milestones.ts # Milestones operations

app/api/v1/
├── people/
│   ├── route.ts          # GET (list), POST (create)
│   ├── [id]/route.ts     # GET, PATCH, DELETE
│   └── bulk/route.ts     # POST (bulk create)
│
├── groups/
│   ├── route.ts          # GET, POST
│   ├── [id]/route.ts     # GET, PATCH, DELETE
│   └── clone-year/route.ts
│
├── users/
│   ├── route.ts          # GET, POST
│   ├── [id]/route.ts     # GET, PATCH, DELETE
│   └── leaders/route.ts  # GET leaders for assignment
│
├── progress/
│   └── [personId]/route.ts  # GET, PATCH
│
├── attendance/
│   └── route.ts          # GET, POST (single or bulk)
│
├── milestones/
│   └── route.ts          # GET (active milestones)
│
├── admin/
│   └── milestones/route.ts  # Admin milestone management
│
└── stats/
    └── route.ts          # Dashboard statistics

hooks/
└── use-api.ts            # React hooks for API calls
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": ["first_name is required"]
  }
}
```

## API Client Usage (Client-Side)

```typescript
import { api } from '@/lib/api';

// List people with progress
const response = await api.people.list({ include: 'progress' });
if (response.success) {
  const people = response.data.people;
}

// Create a person
const createResponse = await api.people.create({
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '0201234567',
});

// Update progress
await api.progress.update(personId, {
  stage_number: 5,
  is_completed: true,
});

// Get dashboard stats
const stats = await api.stats.getDashboard({ year: 2025 });
```

## React Hook Usage

```typescript
import { useApi, useApiMutation } from '@/hooks/use-api';
import { api } from '@/lib/api';

function MyComponent() {
  // Fetch data on mount
  const { data, loading, error } = useApi(
    () => api.people.list({ include: 'progress' }),
    { immediate: true }
  );

  // Mutation hook
  const { mutate, isSubmitting } = useApiMutation(
    (person) => api.people.create(person),
    { onSuccess: () => refetch() }
  );
}
```

## Migration Path

### Phase 1 (Current)
- ✅ Created new `/api/v1/` routes
- ✅ Created centralized query layer
- ✅ Created API client and hooks
- Existing routes continue to work

### Phase 2 (Gradual)
- Update pages to use new `api` client
- Start with new features, then migrate existing pages

### Phase 3 (Cleanup)
- Remove deprecated `/api/` routes
- Update all fetch calls to use API client

## Backward Compatibility

The existing `/api/people`, `/api/groups`, etc. routes continue to work.
New features should use the `/api/v1/` routes and the `api` client.

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Access denied |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid input data |
| DUPLICATE | 409 | Resource already exists |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Query Layer Benefits

1. **Single Source of Truth** - All DB operations in one place
2. **Optimized Queries** - JOINs and aggregations pre-built
3. **Transaction Support** - Multi-query operations wrapped
4. **Type Safety** - TypeScript interfaces for all inputs/outputs
5. **Reusable** - Same queries work for API routes and background jobs
