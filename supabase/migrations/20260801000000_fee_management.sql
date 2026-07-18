-- Migration: Student Fee Management
-- 1. Fee Structures
create table fee_structures (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  fee_type text not null default 'tuition', -- e.g., tuition, exam, library, registration, late_fee, miscellaneous
  frequency text not null default 'one-time', -- e.g., one-time, annual, semester, monthly
  course_id uuid references courses(id) on delete set null, -- optional: if tied to a specific course
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Fee Assessments (Invoices)
create table fee_assessments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references profiles(id) on delete cascade,
  fee_structure_id uuid not null references fee_structures(id) on delete restrict,
  amount_assessed numeric(10, 2) not null check (amount_assessed >= 0),
  amount_paid numeric(10, 2) not null default 0 check (amount_paid >= 0),
  due_date timestamp with time zone not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Fee Installments (Payment Plans)
create table fee_installments (
  id uuid primary key default uuid_generate_v4(),
  assessment_id uuid not null references fee_assessments(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  due_date timestamp with time zone not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 4. Fee Discounts (Scholarships & Concessions)
create table fee_discounts (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  value numeric(10, 2) not null check (value > 0),
  active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 5. Fee Assessments Discounts (Mapping applied discounts)
create table fee_assessments_discounts (
  id uuid primary key default uuid_generate_v4(),
  assessment_id uuid not null references fee_assessments(id) on delete cascade,
  discount_id uuid not null references fee_discounts(id) on delete restrict,
  amount_deducted numeric(10, 2) not null check (amount_deducted > 0),
  created_at timestamp with time zone default now()
);

-- 6. Fee Payments
create table fee_payments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references profiles(id) on delete cascade,
  assessment_id uuid not null references fee_assessments(id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('credit_card', 'bank_transfer', 'cash', 'online_gateway', 'wallet')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  reference_number text unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 7. Fee Refunds
create table fee_refunds (
  id uuid primary key default uuid_generate_v4(),
  payment_id uuid not null references fee_payments(id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  reason text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'processed', 'rejected')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table fee_structures enable row level security;
alter table fee_assessments enable row level security;
alter table fee_installments enable row level security;
alter table fee_discounts enable row level security;
alter table fee_assessments_discounts enable row level security;
alter table fee_payments enable row level security;
alter table fee_refunds enable row level security;

-- Indexes
create index idx_fee_structures_course on fee_structures(course_id);
create index idx_fee_assessments_student on fee_assessments(student_id);
create index idx_fee_installments_assessment on fee_installments(assessment_id);
create index idx_fee_assessments_discounts_assessment on fee_assessments_discounts(assessment_id);
create index idx_fee_payments_student on fee_payments(student_id);
create index idx_fee_payments_assessment on fee_payments(assessment_id);
create index idx_fee_refunds_payment on fee_refunds(payment_id);

-- Triggers for updated_at
create trigger trg_fee_structures_updated_at before update on fee_structures for each row execute function set_updated_at();
create trigger trg_fee_assessments_updated_at before update on fee_assessments for each row execute function set_updated_at();
create trigger trg_fee_installments_updated_at before update on fee_installments for each row execute function set_updated_at();
create trigger trg_fee_discounts_updated_at before update on fee_discounts for each row execute function set_updated_at();
create trigger trg_fee_payments_updated_at before update on fee_payments for each row execute function set_updated_at();
create trigger trg_fee_refunds_updated_at before update on fee_refunds for each row execute function set_updated_at();

-- RLS Policies

-- Admin can manage everything
create policy "admin manage fee_structures" on fee_structures for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin manage fee_assessments" on fee_assessments for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin manage fee_installments" on fee_installments for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin manage fee_discounts" on fee_discounts for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin manage fee_assessments_discounts" on fee_assessments_discounts for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin manage fee_payments" on fee_payments for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin manage fee_refunds" on fee_refunds for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Students can read active fee structures and discounts
create policy "student read active fee_structures" on fee_structures for select using (status = 'active');
create policy "student read active fee_discounts" on fee_discounts for select using (active = true);

-- Students can read their own data
create policy "student read own fee_assessments" on fee_assessments for select using (student_id = auth.uid());
create policy "student read own fee_installments" on fee_installments for select using (exists (select 1 from fee_assessments a where a.id = fee_installments.assessment_id and a.student_id = auth.uid()));
create policy "student read own fee_assessments_discounts" on fee_assessments_discounts for select using (exists (select 1 from fee_assessments a where a.id = fee_assessments_discounts.assessment_id and a.student_id = auth.uid()));
create policy "student read own fee_payments" on fee_payments for select using (student_id = auth.uid());
create policy "student read own fee_refunds" on fee_refunds for select using (exists (select 1 from fee_payments p where p.id = fee_refunds.payment_id and p.student_id = auth.uid()));

-- Students can insert payments (simulated gateway)
create policy "student insert own fee_payments" on fee_payments for insert with check (student_id = auth.uid());

-- Students can insert refund requests
create policy "student insert own fee_refunds" on fee_refunds for insert with check (exists (select 1 from fee_payments p where p.id = fee_refunds.payment_id and p.student_id = auth.uid()));
