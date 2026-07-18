import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envConfig = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, value] = line.split('=');
  if (key && value) acc[key.trim()] = value.trim();
  return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = envConfig.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const accounts = [
  { email: 'admin@edunexus.com', password: 'demo1234', meta: { full_name: 'Admin Demo', role: 'admin' } },
  { email: 'professor@edunexus.com', password: 'demo1234', meta: { full_name: 'Professor Demo', role: 'professor' } },
  { email: 'student@edunexus.com', password: 'demo1234', meta: { full_name: 'Student Demo', role: 'student' } }
];

async function createAccounts() {
  for (const acc of accounts) {
    console.log(`Creating user ${acc.email}...`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: acc.meta
    });
    
    if (error) {
      console.error(`Error creating ${acc.email}:`, error.message);
    } else {
      console.log(`Successfully created ${acc.email} (ID: ${data.user.id})`);
      
      // Update role in profiles since trigger defaults to student
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: acc.meta.role })
        .eq('id', data.user.id);
        
      if (profileError) {
        console.error(`Error updating role for ${acc.email}:`, profileError.message);
      }
    }
  }
}

createAccounts();
