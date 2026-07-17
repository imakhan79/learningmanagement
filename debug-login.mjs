import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tptlhindktmqhaxhacdu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwdGxoaW5ka3RtcWhheGhhY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMDQ1MTUsImV4cCI6MjA5OTg4MDUxNX0.Nygu7SwfmGBmG5Z6hMLYVVbrHteBCKqs4Rk_DXZWtjg';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwdGxoaW5ka3RtcWhheGhhY2R1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDMwNDUxNSwiZXhwIjoyMDk5ODgwNTE1fQ._UzSxwZtJuBw0uibnXizjg7K_ye6nTg4bRfBymjBn8g';

// Test sign-in with anon key (same as the browser does)
const client = createClient(SUPABASE_URL, ANON_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

console.log('=== Testing Login ===\n');

// Try sign in
const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
  email: 'admin@demo.com',
  password: 'demo1234',
});

if (signInErr) {
  console.log('❌ Sign in FAILED:', signInErr.message);
  console.log('   Code:', signInErr.status);
} else {
  console.log('✅ Sign in SUCCESS! User ID:', signInData.user?.id);
  
  // Try to fetch profile
  const { data: profile, error: profileErr } = await client
    .from('profiles')
    .select('*')
    .eq('id', signInData.user.id)
    .maybeSingle();

  if (profileErr) {
    console.log('❌ Profile fetch FAILED:', profileErr.message);
    console.log('   Hint: RLS may be blocking profile read');
  } else if (!profile) {
    console.log('❌ Profile NOT FOUND for user ID:', signInData.user?.id);
  } else {
    console.log('✅ Profile loaded:', profile);
  }
  
  await client.auth.signOut();
}

// List all auth users with admin key
console.log('\n=== Auth Users in Supabase ===');
const { data: { users } } = await admin.auth.admin.listUsers();
for (const u of users) {
  console.log(`  - ${u.email} | confirmed: ${u.email_confirmed_at ? '✅' : '❌'} | id: ${u.id}`);
}

// List all profiles
console.log('\n=== Profiles in DB ===');
const { data: profiles, error: pErr } = await admin.from('profiles').select('*');
if (pErr) console.log('  Error:', pErr.message);
else if (!profiles?.length) console.log('  ⚠️  No profiles found!');
else profiles.forEach(p => console.log(`  - ${p.email} | role: ${p.role} | id: ${p.id}`));
