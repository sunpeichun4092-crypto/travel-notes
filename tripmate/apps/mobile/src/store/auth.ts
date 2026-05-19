import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  bootstrap: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  loading: true,
  bootstrap: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session ?? null, loading: false });
    supabase.auth.onAuthStateChange((_evt, session) => set({ session }));
  },
  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  signUpWithEmail: async (email, password, display_name) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: display_name ?? email.split('@')[0] } },
    });
    if (error) throw error;
  },
  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
