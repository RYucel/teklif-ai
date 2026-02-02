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
    debugStatus: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [debugStatus, setDebugStatus] = useState<string>("Initializing Auth...");
    const router = useRouter();
    const pathname = usePathname();

    // Timeout helper
    const timeoutPromise = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms));

    const fetchProfile = async (userId: string) => {
        setDebugStatus(`Fetching Profile: ${userId.substring(0, 5)}...`);
        try {
            // Race between fetch and timeout (5s)
            const fetchQuery = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const { data, error } = await Promise.race([
                fetchQuery,
                timeoutPromise(5000)
            ]) as any;

            if (error) {
                console.error('Profile fetch error:', error);
                setDebugStatus(`Profile Error: ${error.message}`);
                return null;
            }
            return data as UserProfile;
        } catch (err) {
            console.error('Profile fetch exception:', err);
            setDebugStatus("Profile Exception/Timeout");
            return null;
        }
    };

    useEffect(() => {
        // Extended safety timeout (7s) to allow for slower connections
        // This is a "last resort" fallback.
        const timeoutId = setTimeout(() => {
            console.warn('Auth global timeout reached (7s)');
            setDebugStatus("Global Timeout (7s)");
            setLoading(false);
        }, 7000);

        setDebugStatus("Checking Session...");
        // Get initial session
        supabase.auth.getSession().then(async ({ data: { session: currentSession }, error }) => {
            clearTimeout(timeoutId);

            if (error) {
                console.error('GetSession error:', error);
                setDebugStatus(`Session Error: ${error.message}`);
                // Ensure we don't leave stale state
                setSession(null);
                setUser(null);
                setProfile(null);
                setLoading(false);
                return;
            }

            if (currentSession?.user) {
                console.log('Session found:', currentSession.user.email);
                setDebugStatus(`Session Found: ${currentSession.user.email}`);
                setSession(currentSession);
                setUser(currentSession.user);

                const userProfile = await fetchProfile(currentSession.user.id);
                if (!userProfile) {
                    console.error("User authenticated but no profile found (or timed out). Forcing logout.");
                    setDebugStatus("Profile Missing - Logging Out");

                    // Critical: Clear everything completely
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    localStorage.clear();
                    await supabase.auth.signOut().catch(() => { });

                    setLoading(false);
                    router.push('/login');
                    return;
                }
                setProfile(userProfile);
            } else {
                console.log('No active session');
                setDebugStatus("No Active Session");
                // Clear state to be safe
                setSession(null);
                setUser(null);
                setProfile(null);
            }

            setLoading(false);
        }).catch(err => {
            console.error('Auth initialization error:', err);
            setDebugStatus(`Auth Init Error: ${err.message}`);
            clearTimeout(timeoutId);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                console.log('Auth state change:', event, newSession?.user?.email);
                setDebugStatus(`Auth Event: ${event}`);

                if (event === 'SIGNED_OUT') {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                } else if (newSession?.user) {
                    setSession(newSession);
                    setUser(newSession.user);

                    // Only fetch profile if we don't have it or if it's a different user
                    // Getting it again on every event is safer to ensure sync
                    const userProfile = await fetchProfile(newSession.user.id);
                    if (!userProfile && event !== 'INITIAL_SESSION') {
                        // If it fails during a session update (e.g. token refresh), 
                        // we might want to be careful. But if profile is gone, user is invalid.
                        console.warn("Profile check failed during auth change");
                        // Optional: Force logout here too? 
                        // For now, let's allow it to start 'loading' if needed or keep old profile?
                        // Better: strict consistency.
                    }
                    if (userProfile) {
                        setProfile(userProfile);
                    }
                    setLoading(false);
                } else {
                    // No session
                    setLoading(false);
                }
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
            setDebugStatus("Redirecting to Login...");
            router.push('/login');
        } else if (user && isPublicPath) {
            setDebugStatus("Redirecting to Home...");
            router.push('/');
        }
    }, [user, loading, pathname, router]);

    const signIn = async (email: string, password: string) => {
        setDebugStatus("Signing In...");
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error };
    };

    const signOut = async () => {
        setDebugStatus("Signing Out...");
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Error signing out:", error);
        }

        // Force clear local storage to remove any stuck tokens
        localStorage.clear();

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
        debugStatus,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            {/* Debug overlay for development */}
            {/* <div className="fixed bottom-0 right-0 bg-black/80 text-white p-2 text-xs z-50">
                Status: {debugStatus} | Loading: {loading ? 'T' : 'F'} | User: {user ? 'Y' : 'N'}
            </div> */}
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
