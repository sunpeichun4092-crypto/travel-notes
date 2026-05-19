// Helper: get the current user on the server, redirect to /login if missing.
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase-server';

export async function requireUser() {
  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');
  return { user: data.user, supabase };
}

export async function getOptionalUser() {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
