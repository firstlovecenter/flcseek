# FLC Sheep Seeking - User Login Credentials

Generated: October 21, 2025

## Quick Reference

| Role | Access Level | Dashboard | Count |
|------|--------------|-----------|-------|
| Super Admin | Full system access | `/super-admin` | 1 |
| Lead Pastor | View all months (read-only) | `/sheep-seeker` | 1 |
| Admin | Full edit access for assigned month | `/sheep-seeker` | 12 |
| Leader | View-only for assigned month | `/sheep-seeker` | 12 |

---

## Super Admin

**Full system access to all features and months**

| Username | Password | Email |
|----------|----------|-------|
| *(existing)* | *(unchanged)* | skaduteye@gmail.com |

---

## Lead Pastor

**Can view all months but cannot edit**

| Username | Password | Access |
|----------|----------|--------|
| `leadpastor` | `LeadPastor2025!` | All months (view-only) |

---

## Admins (Full Edit Access)

**Each admin has full edit access for their assigned month**

| Month | Username | Password | Group |
|-------|----------|----------|-------|
| January | `january_admin` | `JanuaryAdmin2025!` | January |
| February | `february_admin` | `FebruaryAdmin2025!` | February |
| March | `march_admin` | `MarchAdmin2025!` | March |
| April | `april_admin` | `AprilAdmin2025!` | April |
| May | `may_admin` | `MayAdmin2025!` | May |
| June | `june_admin` | `JuneAdmin2025!` | June |
| July | `july_admin` | `JulyAdmin2025!` | July |
| August | `august_admin` | `AugustAdmin2025!` | August |
| September | `september_admin` | `SeptemberAdmin2025!` | September |
| October | `october_admin` | `OctoberAdmin2025!` | October |
| November | `november_admin` | `NovemberAdmin2025!` | November |
| December | `december_admin` | `DecemberAdmin2025!` | December |

---

## Leaders (View-Only Access)

**Each leader can only view their assigned month**

| Month | Username | Password | Group |
|-------|----------|----------|-------|
| January | `january_leader` | `JanuaryLeader2025!` | January |
| February | `february_leader` | `FebruaryLeader2025!` | February |
| March | `march_leader` | `MarchLeader2025!` | March |
| April | `april_leader` | `AprilLeader2025!` | April |
| May | `may_leader` | `MayLeader2025!` | May |
| June | `june_leader` | `JuneLeader2025!` | June |
| July | `july_leader` | `JulyLeader2025!` | July |
| August | `august_leader` | `AugustLeader2025!` | August |
| September | `september_leader` | `SeptemberLeader2025!` | September |
| October | `october_leader` | `OctoberLeader2025!` | October |
| November | `november_leader` | `NovemberLeader2025!` | November |
| December | `december_leader` | `DecemberLeader2025!` | December |

---

## Password Pattern

All passwords follow the pattern: `{Month}{Role}2025!`

**Examples:**
- Admin: `JanuaryAdmin2025!`
- Leader: `JanuaryLeader2025!`
- Lead Pastor: `LeadPastor2025!`

**Note:** Passwords are case-sensitive and include an exclamation mark at the end.

---

## Login Instructions

1. Go to `http://localhost:3000` (or your deployment URL)
2. Enter your username and password
3. Click "Sign In"
4. You will be redirected to the appropriate dashboard based on your role

### First-Time Login

If this is your first time logging in:
1. Clear your browser cache (press `Ctrl + Shift + Delete`)
2. Clear Local Storage in Developer Tools (`F12` → Application → Local Storage → Clear)
3. Refresh the page (`Ctrl + F5`)
4. Try logging in again

---

## Troubleshooting

### Login fails with "Invalid credentials"
- Double-check the username and password (they are case-sensitive)
- Make sure you're including the exclamation mark at the end of the password
- Try clearing your browser cache and localStorage

### Redirected to `/stream-leader` error page
- Clear your browser's localStorage
- Log out and log back in
- Hard refresh the page (`Ctrl + F5`)

### Cannot see your assigned month's data
- Contact the super admin to verify your group assignment
- Make sure you're logged in with the correct account

---

## Security Notes

⚠️ **Important Security Reminders:**

1. Change these default passwords after first login
2. Do not share login credentials
3. Log out when finished using the system
4. Keep this document secure and confidential
5. Contact the super admin if you suspect unauthorized access

---

## Support

For issues or questions, contact the system administrator at: **skaduteye@gmail.com**

---

*Document generated automatically - Last updated: October 21, 2025*
