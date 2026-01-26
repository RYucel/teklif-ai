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

    const fetchProfile = async (userId: string) => {
        setDebugStatus(`Fetching Profile: ${userId.substring(0, 5)}...`);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Profile fetch error:', error);
                setDebugStatus(`Profile Error: ${error.message}`);
                // If profile fetch fails (e.g. RLS or missing data), consider user invalid
                return null;
            }
            return data as UserProfile;
        } catch (err) {
            console.error('Profile fetch exception:', err);
            setDebugStatus("Profile Exception");
            return null;
        }
    };

    // Force sign out if we have a user but no profile after a grace period?
    // Better: Handle in the effect.

    useEffect(() => {
        // Safety timeout - force stop loading after 5 seconds
        const timeoutId = setTimeout(() => {
            console.warn('Auth timeout reached (5s), forcing loading false');
            setDebugStatus("Timeout Reached (5s) - Force Load");
            setLoading(false);
        }, 5000);

        setDebugStatus("Checking Session...");
        // Get initial session
        supabase.auth.getSession().then(async ({ data: { session: currentSession }, error }) => {
            clearTimeout(timeoutId);

            if (error) {
                console.error('GetSession error:', error);
                setDebugStatus(`Session Error: ${error.message}`);
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
                    console.error("User authenticated but no profile found. Forcing logout.");
                    await signOut(); // Auto logout if no profile
                    return;
                }
                setProfile(userProfile);
            } else {
                console.log('No active session');
                setDebugStatus("No Active Session");
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
                } else if (newSession) {
                    setSession(newSession);
                    setUser(newSession.user);
                    if (newSession.user) {
                        const userProfile = await fetchProfile(newSession.user.id);
                        if (!userProfile && event !== 'INITIAL_SESSION') {
                            // Only force logout here if it's not the initial load (handled above)
                            // Actually, let's just warn or let the UI handle empty profile
                            console.warn("Profile missing for logged in user");
                        }
                        setProfile(userProfile);
                    }
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
