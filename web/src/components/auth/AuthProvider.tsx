'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'representative';
    department?: string;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Profile fetch error:', error);
                return null;
            }
            return data as UserProfile;
        } catch (err) {
            console.error('Profile fetch exception:', err);
            return null;
        }
    };

    useEffect(() => {
        // Safety timeout - force stop loading after 10 seconds
        const timeoutId = setTimeout(() => {
            console.warn('Auth timeout reached (10s), forcing loading false');
            setLoading(false);
        }, 10000);

        // Get initial session
        supabase.auth.getSession().then(async ({ data: { session: currentSession }, error }) => {
            clearTimeout(timeoutId);

            if (error) {
                console.error('GetSession error:', error);
                setLoading(false);
                return;
            }

            if (currentSession?.user) {
                console.log('Session found:', currentSession.user.email);
                setSession(currentSession);
                setUser(currentSession.user);

                const userProfile = await fetchProfile(currentSession.user.id);
                setProfile(userProfile);
            } else {
                console.log('No active session');
            }

            setLoading(false);
        }).catch(err => {
            console.error('Auth initialization error:', err);
            clearTimeout(timeoutId);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                console.log('Auth state change:', event, newSession?.user?.email);

                setSession(newSession);
                setUser(newSession?.user ?? null);

                if (newSession?.user) {
                    const userProfile = await fetchProfile(newSession.user.id);
                    setProfile(userProfile);
                } else {
                    setProfile(null);
                }

                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    // Redirect logic
    useEffect(() => {
        if (loading) return;

        const publicPaths = ['/login', '/forgot-password'];
        const isPublicPath = publicPaths.includes(pathname);

        if (!user && !isPublicPath) {
            router.push('/login');
        } else if (user && isPublicPath) {
            router.push('/');
        }
    }, [user, loading, pathname, router]);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setSession(null);
        router.push('/login');
    };

    const value: AuthContextType = {
        user,
        profile,
        session,
        loading,
        signIn,
        signOut,
        isAdmin: profile?.role === 'admin',
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
