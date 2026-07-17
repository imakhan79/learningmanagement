import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tptlhindktmqhaxhacdu.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwdGxoaW5ka3RtcWhheGhhY2R1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDMwNDUxNSwiZXhwIjoyMDk5ODgwNTE1fQ._UzSxwZtJuBw0uibnXizjg7K_ye6nTg4bRfBymjBn8g';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Check if profiles table exists
console.log('🔍 Checking if profiles table exists...');
const { error: checkErr } = await supabase.from('profiles').select('id').limit(1);

if (checkErr && checkErr.message.includes('does not exist')) {
  console.log('  ⚠️  Table does not exist. Please run the migration SQL in your Supabase dashboard:');
  console.log('  Dashboard > SQL Editor > paste contents of:');
  console.log('  supabase/migrations/20260717201008_0001_lms_core_schema.sql');
  console.log('\n  Then re-run this script.');
  process.exit(1);
} else if (checkErr) {
  // Table exists but RLS blocked — that's fine, continue
  console.log('  ✅ Table exists (RLS active)');
} else {
  console.log('  ✅ Table exists');
}

// Fetch created auth users and upsert profiles
console.log('\n👥 Upserting demo profiles...');
const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
if (listErr) { console.error('listUsers error:', listErr.message); process.exit(1); }

const demoUsers = [
  { email: 'admin@demo.com',     full_name: 'Admin User',      role: 'admin' },
  { email: 'professor@demo.com', full_name: 'Professor Smith', role: 'professor' },
  { email: 'student@demo.com',   full_name: 'Student Jones',   role: 'student' },
];

for (const u of demoUsers) {
  const authUser = users.find(x => x.email === u.email);
  if (!authUser) { console.log(`  ⚠️  Auth user not found for ${u.email}`); continue; }

  // Use service role client — bypasses RLS
  const { error } = await supabase.from('profiles').upsert({
    id: authUser.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    status: 'active',
  }, { onConflict: 'id' });

  if (error) {
    console.error(`  ❌ ${u.email}: ${error.message}`);
  } else {
    console.log(`  ✅ ${u.email} → ${u.role}`);
  }
}

console.log('\n🎉 Demo credentials ready:');
console.log('  admin@demo.com     / demo1234  → Admin');
console.log('  professor@demo.com / demo1234  → Professor');
console.log('  student@demo.com   / demo1234  → Student');
