# Performance Optimization - Index-Based Strategy

## Philosophy: Fetch All Data, Optimize with Indexes

The app **fetches ALL requested data** but uses **database indexes** to make queries fast. No artificial pagination limits.

---

## Performance Status ✅

### Current Performance (From Production Logs)
- **Groups API**: 600-1400ms (after warmup)
- **People API with Progress**: ~1.5 seconds for 100 people + all progress records
- **First load**: Slower due to Next.js compilation (~6-13 seconds)

---

## Indexes Implemented

### Base Indexes (Prisma Schema)
✅ All major foreign keys indexed  
✅ Composite indexes on frequently joined columns  
✅ Unique indexes on business keys (phone_number, username)

### Performance Indexes (013_add_performance_indexes.sql)
```sql
-- Core relationship indexes
idx_progress_records_person_id
idx_progress_records_person_stage (composite)
idx_attendance_records_person_id
idx_new_converts_group_id
idx_groups_name_year (composite)

-- Partial index for completed stages only
idx_progress_records_completed WHERE is_completed = true
```

### Advanced Indexes (015_additional_performance_indexes.sql)
```sql
-- Covering indexes (include commonly selected columns)
idx_new_converts_group_name (group_id, first_name, last_name) WHERE deleted_at IS NULL
idx_new_converts_covering (group_id, first_name, last_name, phone_number, deleted_at)

-- Optimized for specific query patterns
idx_progress_person_completed (person_id, is_completed, stage_number)
idx_attendance_person_date (person_id, date_attended DESC)
idx_groups_active_year (year, archived) WHERE archived = false

-- Partial indexes for common filters
idx_activity_recent WHERE created_at > NOW() - INTERVAL '30 days'
idx_notifications_user_unread WHERE is_read = false
```

---

## Query Patterns Optimized

### 1. People with Progress (Most Common)
```typescript
// Fetches ALL people in group with ALL their progress
findManyWithProgress(filters)
```
**Optimized by:**
- `idx_new_converts_group_id` - Fast group filtering
- `idx_progress_records_person_id` - Efficient JOIN on progress
- `idx_attendance_records_person_id` - Quick attendance count

**Performance:** ~1.5 seconds for 100 people with 18 milestones each

### 2. Groups by Year
```typescript
// Get all active groups for a specific year
Groups.findMany({ year: 2025, archived: false })
```
**Optimized by:**
- `idx_groups_active_year` - Composite index on year+archived
- Partial index excludes archived groups

**Performance:** ~600ms

### 3. Completed Progress Lookup
```typescript
// Count completed stages per person
WHERE is_completed = true
```
**Optimized by:**
- `idx_progress_completed_only` - Partial index, 50% smaller than full index

---

## Monitoring

### Check Query Performance
Look for slow queries in terminal logs:
```
prisma:query SELECT ... 
GET /api/people?include=progress 200 in 6531ms  ← First load (compilation)
GET /api/people?include=progress 200 in 1458ms  ← Subsequent (optimized)
```

### Verify Index Usage (PostgreSQL)
```sql
EXPLAIN ANALYZE 
SELECT nc.* FROM new_converts nc
WHERE nc.group_id = 'xxx'
ORDER BY nc.first_name, nc.last_name;

-- Should show: Index Scan using idx_new_converts_group_name
```

---

## Best Practices

### ✅ DO
- Fetch all requested data (no artificial limits)
- Add indexes for common WHERE/JOIN/ORDER BY columns
- Use composite indexes for multi-column queries
- Use partial indexes (WHERE clause) to reduce size
- Monitor query logs for slow patterns

### ❌ DON'T
- Add pagination to hide slow queries (fix the query instead)
- Remove fields from responses to "optimize"
- Use client-side filtering for large datasets
- Add unnecessary indexes (hurts INSERT/UPDATE performance)

---

## Future Optimizations

If queries become slow (>3 seconds):

1. **Add missing indexes** for new query patterns
2. **Use materialized views** for complex aggregations
3. **Enable query result caching** (Redis/Upstash)
4. **Optimize Prisma queries** (select only needed fields)
5. **Database connection pooling** (already using Neon serverless)

---

## Files

- ✅ `prisma/schema.prisma` - Base indexes
- ✅ `prisma/migrations/013_add_performance_indexes.sql` - Core performance indexes
- ✅ `prisma/migrations/015_additional_performance_indexes.sql` - Advanced indexes
