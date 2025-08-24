import { createClient } from '@supabase/supabase-js';
const supabaseUrl = "https://pmniwmjnvqrofgmkpkjp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtbml3bWpudnFyb2ZnbWtwa2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5ODQ1ODIsImV4cCI6MjA3MTU2MDU4Mn0.nNsFtV30WZ8jQebR6uUzwNfEGW4u4FUYrEgYVo_V6kI";

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface AuthUser {
  id: string;
  email?: string;
  username?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  username?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export class AuthService {
  // Sign up new user
  static async signUp({ email, password, username }: SignUpData) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username?.trim() || email.split('@')[0]
          }
        }
      });

      if (error) throw error;

      if (data.user && data.user.email_confirmed_at) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: username?.trim() || email.split('@')[0]
          });
        } catch (profileError) {
          console.log('Profile creation handled by trigger or already exists');
        }
      }

      return { user: data.user, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  }

  static async signIn({ email, password }: SignInData) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) throw error;

      return { user: data.user, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  }

  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  static async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session, error: null };
    } catch (error: any) {
      return { session: null, error: error.message };
    }
  }

  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;

      if (!user) return { user: null, error: null };

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        username: profile?.username || user.email?.split('@')[0] || 'Anonymous'
      };

      return { user: authUser, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  }

  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { user } = await this.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  }
}