# CoconutKiss Operations

A production-ready, mobile-first internal web app for tracking coconut stock, seller allocations, supplier deliveries, payments, audits, and events. The frontend is static (HTML/CSS/JS) and the backend uses Supabase (Postgres + Auth + RLS).

## Repository layout

```
.
├── index.html
├── styles.css
├── supabase.sql
└── src
    ├── auth.js
    ├── config.js
    ├── dashboard.js
    ├── db.js
    ├── events.js
    ├── reports.js
    ├── sellers.js
    ├── stock.js
    ├── suppliers.js
    ├── ui.js
    └── utils.js
```

## Setup

### 1) Create a Supabase project

1. Create a new project at https://supabase.com
2. Note your **Project URL** and **anon public** key.

### 2) Run the SQL

1. Open **SQL Editor** in Supabase.
2. Run the full contents of `supabase.sql` to create tables, policies, functions, indexes, and seed data.

### 3) Create users + assign roles

1. Create three users in **Authentication > Users** (two admins, one supervisor).
2. For each user, insert a profile row:

```sql
insert into profiles (user_id, role)
values ('<user-uuid>', 'admin');

insert into profiles (user_id, role)
values ('<user-uuid>', 'supervisor');
```

3. For sellers, set a PIN hash (example using bcrypt):

```sql
update sellers
set pin_hash = crypt('1234', gen_salt('bf'))
where name = 'Kojo';
```

### 4) Configure frontend keys

In `index.html`, set your Supabase keys before publishing. For GitHub Pages, define them in a small inline script **before** `config.js`, or replace the placeholders in `src/config.js`:

```html
<script>
  window.SUPABASE_URL = "YOUR_SUPABASE_URL";
  window.SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
</script>
```

### 5) Enable GitHub Pages

1. Push to GitHub.
2. In **Settings > Pages**, select the default branch and root folder.
3. Save. Your app will be hosted at the GitHub Pages URL.

## Notes

- Basis unit price is fixed at **6 GHS per coconut**.
- Payments are confirmed only when a seller enters the correct PIN.
- Supervisor accounts can create ledger and event records but cannot edit joints or suppliers.
