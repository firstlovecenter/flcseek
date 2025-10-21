# Application Testing Guide

## Prerequisites
✅ Database migrated to Neon PostgreSQL
✅ Environment variables configured (.env.local)
✅ All dependencies installed (npm install)
✅ App running (npm run dev)

## Test Credentials
- **Super Admin**: username: `admin`, password: `admin123`
- **Create Sheep Seeker**: Use Super Admin → Users → Create User

## Testing Plan

### Phase 1: Authentication & Authorization

#### Test 1.1: Login
1. Navigate to http://localhost:3000
2. Login with admin credentials
3. ✅ Should redirect to `/super-admin` dashboard
4. Verify navigation sidebar appears

#### Test 1.2: Role-Based Access
1. Login as Super Admin
2. ✅ Should see all 12 department links, SMS, Reports, Users menus
3. Create a Sheep Seeker user
4. Logout and login as Sheep Seeker
5. ✅ Should only see People, Attendance, Progress menus
6. ✅ Try accessing `/super-admin/users` - should redirect

### Phase 2: Super Admin Features

#### Test 2.1: Dashboard
1. Login as Super Admin
2. Navigate to `/super-admin`
3. ✅ Should see department cards
4. ✅ Each card shows: Total Members, Avg Progress, Avg Attendance
5. Click a department card
6. ✅ Should navigate to department detail page

#### Test 2.2: People Management
1. Navigate to "People" → "All People"
2. ✅ Table displays with columns: Name, Phone, Department, Progress, Attendance
3. Test search: Type a name
4. ✅ Table filters results
5. Test department filter: Select a department
6. ✅ Table shows only that department
7. Click "Register New Person"
8. ✅ Form appears with validation
9. Fill form and submit
10. ✅ Success message appears
11. ✅ Redirects to people list
12. ✅ New person appears in table

#### Test 2.3: Department Detail
1. From dashboard, click "January" (or any month)
2. ✅ Shows list of people in that department
3. ✅ Breadcrumb shows: Super Admin > Department > January
4. ✅ Progress and attendance bars display
5. ✅ Last updated date shows
6. Click "View Details" on a person
7. ✅ Navigates to person detail page

#### Test 2.4: SMS Management
1. Navigate to "SMS" → "Send SMS"
2. Select "All Departments"
3. Type a message (max 160 chars)
4. ✅ Character counter updates
5. Click "Send SMS"
6. ✅ Success message with count of recipients
7. Navigate to "SMS" → "SMS Logs"
8. ✅ Table shows sent SMS with status
9. ✅ Statistics cards show: Total, Sent, Failed, Pending
10. Select date range
11. ✅ Table filters by date

#### Test 2.5: Reports
**Overview Report:**
1. Navigate to "Reports" → "Overview"
2. ✅ Shows Total People, Avg Progress, Avg Attendance
3. ✅ Department breakdown with progress bars

**Progress Report:**
1. Navigate to "Reports" → "Progress Report"
2. ✅ Shows all 15 stages
3. ✅ Each stage shows completion count and percentage
4. ✅ Progress bars display correctly

**Attendance Report:**
1. Navigate to "Reports" → "Attendance Report"
2. ✅ Table shows all people with attendance count
3. ✅ Goal achievers count displays
4. ✅ Sortable by attendance count

#### Test 2.6: User Management
1. Navigate to "Users" → "Manage Users"
2. ✅ Table shows all users
3. ✅ Cannot delete "admin" user
4. Click "Create New User"
5. Fill form: username, password (min 6 chars), role
6. ✅ Form validates
7. Submit form
8. ✅ Success message
9. ✅ Redirects to users list
10. ✅ New user appears
11. Click "Delete" on new user
12. ✅ Confirmation modal appears
13. Confirm delete
14. ✅ User removed from table

### Phase 3: Sheep Seeker Features

#### Test 3.1: People Management
1. Login as Sheep Seeker
2. Navigate to "People" → "My People"
3. ✅ Table displays all registered people
4. Test search functionality
5. ✅ Search filters results
6. Click "Register New Person"
7. Fill and submit form
8. ✅ New person registered successfully

#### Test 3.2: Attendance Tracking
1. Navigate to "Attendance"
2. ✅ Table shows all people with attendance progress
3. Select a date (today or past date)
4. Click "Mark Present" for a person
5. ✅ Success message
6. ✅ Attendance count increases
7. ✅ Progress bar updates

#### Test 3.3: Progress Tracking
1. Navigate to "Progress Tracking"
2. ✅ Table shows all people with progress percentage
3. Click "Update Progress" for a person
4. ✅ Modal opens with 15 stages
5. Check/uncheck stages
6. ✅ Completed stages show green background
7. ✅ Modal saves changes
8. Close modal
9. ✅ Table updates with new completion percentage

### Phase 4: Person Detail Page

#### Test 4.1: View Person Details
1. From any people list, click a person's name
2. ✅ Person detail page loads
3. ✅ TopNav shows with back button
4. ✅ Breadcrumb shows correct path
5. ✅ Personal info displays
6. ✅ Progress stages list shows (15 stages)
7. ✅ Attendance records display
8. Test updating progress
9. ✅ Progress updates successfully
10. Test marking attendance
11. ✅ Attendance marks successfully

### Phase 5: Navigation & UX

#### Test 5.1: Navigation
1. Click through all sidebar menu items
2. ✅ All links work
3. ✅ Breadcrumbs update correctly
4. ✅ Active menu item highlights
5. Test collapsible sidebar
6. ✅ Sidebar collapses/expands smoothly

#### Test 5.2: Breadcrumb Navigation
1. Navigate deep: Dashboard → Department → Person
2. ✅ Breadcrumb shows full path
3. Click breadcrumb links
4. ✅ Navigates correctly

#### Test 5.3: Quick Actions (if implemented)
1. Check header for quick actions dropdown
2. ✅ Quick actions appear based on role
3. Click quick action
4. ✅ Navigates to correct page

### Phase 6: Error Handling

#### Test 6.1: Form Validation
1. Try submitting empty forms
2. ✅ Validation messages appear
3. Try invalid phone format
4. ✅ Error message shows
5. Try short password (<6 chars)
6. ✅ Validation prevents submission

#### Test 6.2: API Errors
1. Disconnect internet (or simulate API failure)
2. Try loading a page
3. ✅ Error message displays
4. Reconnect
5. Try again
6. ✅ Page loads successfully

#### Test 6.3: Unauthorized Access
1. Logout
2. Try accessing `/super-admin/people` directly
3. ✅ Redirects to login
4. Login as Sheep Seeker
5. Try accessing `/super-admin/users`
6. ✅ Redirects to home or shows error

### Phase 7: Data Integrity

#### Test 7.1: Progress Tracking
1. Mark several stages as complete for a person
2. ✅ Progress percentage calculates correctly (X/15 * 100)
3. Navigate away and come back
4. ✅ Progress persists

#### Test 7.2: Attendance Tracking
1. Mark attendance for same person on different dates
2. ✅ Attendance count increments
3. Check attendance report
4. ✅ Correct count shows (max 52)

#### Test 7.3: Department Filtering
1. Register people in different departments
2. Filter by department
3. ✅ Only that department's people show
4. Check department detail page
5. ✅ Only shows people from that department

## Common Issues & Solutions

### Issue 1: "Unauthorized" Error
**Solution**: 
- Check if JWT_SECRET is set in .env.local
- Verify token is not expired
- Re-login

### Issue 2: Database Connection Error
**Solution**:
- Verify NEON_DATABASE_URL in .env.local
- Check Neon dashboard for database status
- Restart dev server

### Issue 3: SMS Not Sending
**Solution**:
- Verify MNOTIFY_API_KEY in .env.local
- Check mNotify account balance
- Verify phone number format

### Issue 4: Pages Not Loading
**Solution**:
- Check browser console for errors
- Verify no TypeScript compilation errors
- Restart dev server: `npm run dev`

### Issue 5: Navigation Not Showing
**Solution**:
- Verify user is logged in
- Check AuthContext is providing user data
- Verify Navigation component is in layout.tsx

## Performance Testing

### Test Load Times
1. Register 50+ people
2. Navigate to people list
3. ✅ Should load within 2-3 seconds
4. Apply filters
5. ✅ Filtering should be instant

### Test Concurrent Users
1. Open app in multiple browsers
2. Login with different users
3. ✅ Each session independent
4. Make changes in one browser
5. Refresh other browser
6. ✅ Changes reflect

## Browser Compatibility
Test on:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Edge (latest)
- ✅ Safari (if on Mac)

## Mobile Responsiveness
1. Open browser dev tools
2. Toggle device emulation
3. Test on:
   - ✅ iPhone SE (375px)
   - ✅ iPad (768px)
   - ✅ Desktop (1920px)
4. Verify:
   - ✅ Tables scroll horizontally if needed
   - ✅ Forms are usable
   - ✅ Navigation works
   - ✅ Buttons are tappable

## Final Checklist
- [ ] All Super Admin pages work
- [ ] All Sheep Seeker pages work
- [ ] All navigation links functional
- [ ] All forms validate and submit
- [ ] All tables display data
- [ ] Progress tracking works
- [ ] Attendance tracking works
- [ ] SMS sending works
- [ ] Reports generate correctly
- [ ] User management works
- [ ] Authentication works
- [ ] Authorization works
- [ ] Breadcrumbs work
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Mobile responsive
- [ ] Fast load times

## Sign-Off
Once all tests pass:
1. Document any issues found and resolved
2. Create backup of database
3. Deploy to staging/production
4. Re-test on production environment
5. Train end users
6. Go live! 🚀
