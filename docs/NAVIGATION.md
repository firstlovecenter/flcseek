# Navigation Components Documentation

## Overview
This document describes the navigation components added to the FLC Sheep Seeking application to provide a comprehensive navigation experience for both Super Admin and Sheep Seeker roles.

## Components Added

### 1. Navigation Component (`components/Navigation.tsx`)
**Purpose:** Main navigation wrapper with sidebar and header.

**Features:**
- Collapsible sidebar with role-based menu items
- Fixed header with user profile dropdown
- Automatic role detection (Super Admin vs Sheep Seeker)
- Responsive design with mobile breakpoints
- Dark-themed sidebar with branding
- Persistent navigation across all authenticated pages

**Usage:**
```tsx
import Navigation from '@/components/Navigation';

<Navigation>
  {children}
</Navigation>
```

**Super Admin Menu Items:**
- Dashboard
- People Management
  - All People
  - Register New
- Departments (12 months: January - December)
- SMS Management
  - Send Messages
  - SMS Logs
- Reports
  - Overview
  - Progress Report
  - Attendance Report
- User Management
  - All Users
  - Create User

**Sheep Seeker Menu Items:**
- Dashboard
- People
  - All People
  - Register New
- Attendance
- Progress Tracking

### 2. TopNav Component (`components/TopNav.tsx`)
**Purpose:** Simple top navigation bar for detail pages.

**Features:**
- Displays page title
- Optional back button with customizable URL
- User profile dropdown
- Brand logo/link to dashboard
- Sticky positioning

**Usage:**
```tsx
import TopNav from '@/components/TopNav';

<TopNav 
  title="Person Details" 
  showBack={true} 
  backUrl="/super-admin"
/>
```

**Props:**
- `title?: string` - Page title to display
- `showBack?: boolean` - Whether to show back button (default: false)
- `backUrl?: string` - URL to navigate to when back is clicked

### 3. AppBreadcrumb Component (`components/AppBreadcrumb.tsx`)
**Purpose:** Dynamic breadcrumb navigation based on current route.

**Features:**
- Automatically generates breadcrumb from URL path
- Role-aware home link
- Clickable breadcrumb items (except last)
- Pretty formatting of route segments

**Usage:**
```tsx
import AppBreadcrumb from '@/components/AppBreadcrumb';

<AppBreadcrumb />
```

**Example Output:**
- `/super-admin/people/register` → Super Admin > People > Register
- `/sheep-seeker/attendance` → Sheep Seeker > Attendance

### 4. QuickActions Component (`components/QuickActions.tsx`)
**Purpose:** Dropdown menu for quick access to common actions.

**Features:**
- Role-based action items
- Icon-based menu items
- Dropdown positioning

**Usage:**
```tsx
import QuickActions from '@/components/QuickActions';

<QuickActions />
```

**Super Admin Actions:**
- Register New Person
- Send SMS
- Create User
- View Reports

**Sheep Seeker Actions:**
- Register New Person
- View All People

## Integration

### Root Layout (`app/layout.tsx`)
The Navigation component has been integrated into the root layout to provide consistent navigation across all pages:

```tsx
<AuthProvider>
  <Navigation>{children}</Navigation>
</AuthProvider>
```

### Updated Pages

#### 1. Super Admin Dashboard (`app/super-admin/page.tsx`)
- Removed duplicate header and layout components
- Added AppBreadcrumb
- Now uses Navigation from layout

#### 2. Sheep Seeker Dashboard (`app/sheep-seeker/page.tsx`)
- Removed duplicate header and layout components
- Added AppBreadcrumb
- Simplified page structure

#### 3. Person Detail Page (`app/person/[id]/page.tsx`)
- Replaced custom header with TopNav component
- Added back button functionality
- Added AppBreadcrumb
- Role-aware back navigation

## Design Features

### Responsive Design
- Sidebar collapses on mobile (< 992px breakpoint)
- Hamburger menu toggle
- Smooth transitions

### User Experience
- Persistent user context (username, role) in header
- Profile dropdown with logout option
- Active route highlighting in sidebar
- Breadcrumb trail for context

### Styling
- Ant Design theming
- Dark sidebar (#001529)
- White header with shadow
- Consistent spacing and padding
- Brand colors (#1890ff)

## Navigation Flow

### Login Flow
1. User logs in at `/`
2. Redirected to role-specific dashboard
3. Navigation sidebar appears
4. All navigation items available

### Page Navigation
1. Click sidebar menu item
2. Navigate to new page
3. Breadcrumb updates automatically
4. Active menu item highlighted

### Logout Flow
1. Click user avatar in header
2. Select "Logout" from dropdown
3. Session cleared
4. Redirected to login page
5. Navigation hidden

## Customization

### Adding New Menu Items
Edit `components/Navigation.tsx`:

```tsx
const superAdminMenuItems = [
  // Add new item
  {
    key: '/super-admin/new-feature',
    icon: <NewIcon />,
    label: <Link href="/super-admin/new-feature">New Feature</Link>,
  },
];
```

### Styling Navigation
Modify styles in `components/Navigation.tsx`:

```tsx
style={{
  background: '#yourColor',
  // other styles
}}
```

### Adding User Menu Items
Edit `userMenuItems` in `Navigation.tsx`:

```tsx
const userMenuItems = [
  {
    key: 'new-action',
    icon: <Icon />,
    label: 'New Action',
    onClick: handleAction,
  },
];
```

## Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- Screen reader friendly
- High contrast ratios
- Focus indicators

## Performance

- Lazy loading of menu items
- Optimized re-renders with React hooks
- Memoized callbacks where appropriate
- Minimal bundle size impact

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive on mobile devices
- Graceful degradation for older browsers

## Future Enhancements

Potential improvements:
1. User preferences for sidebar state
2. Search functionality in navigation
3. Recently visited pages
4. Keyboard shortcuts
5. Dark mode toggle
6. Notification badges on menu items
7. Collapsible sub-menus state persistence

## Testing

To test navigation:
1. Login as Super Admin - verify all menu items visible
2. Login as Sheep Seeker - verify limited menu items
3. Test breadcrumb on different routes
4. Test back button on detail pages
5. Test logout from user dropdown
6. Test responsive behavior on mobile
7. Test keyboard navigation

## Troubleshooting

### Navigation not showing
- Ensure user is authenticated
- Check AuthProvider is wrapping Navigation
- Verify token is valid

### Menu items not clickable
- Check Link components have correct href
- Verify user has permission for route

### Breadcrumb showing wrong path
- Clear cache and reload
- Check pathname is correct
- Verify route exists in app router

## Related Files

- `components/Navigation.tsx` - Main navigation
- `components/TopNav.tsx` - Top bar navigation
- `components/AppBreadcrumb.tsx` - Breadcrumb trail
- `components/QuickActions.tsx` - Quick action dropdown
- `app/layout.tsx` - Root layout integration
- `contexts/AuthContext.tsx` - Authentication context
