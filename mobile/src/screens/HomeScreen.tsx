import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

interface Proposal {
    id: string;
    proposal_no: string;
    customer_name: string;
    status: string;
    amount: number;
    currency: string;
    created_at: string;
}

export default function HomeScreen() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [stats, setStats] = useState({
        approvedAmount: 0,
        targetProgress: 0,
        pendingCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('proposals')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const fetchedProposals = data as Proposal[];
            setProposals(fetchedProposals);

            const approved = fetchedProposals.filter(p => p.status === 'approved');
            const pending = fetchedProposals.filter(p => ['draft', 'sent', 'revised'].includes(p.status));

            const totalApproved = approved.reduce((acc, p) => acc + (p.amount || 0), 0);
            const targetAmount = 50000;
            const progress = Math.min(100, Math.round((totalApproved / targetAmount) * 100));

            setStats({
                approvedAmount: totalApproved,
                targetProgress: progress,
                pendingCount: pending.length
            });

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    const formatCurrency = (amount: number) => {
        return '$' + amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    };

    const getTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffHours < 24) return `${diffHours} sa önce`;
        return `${diffDays} gün önce`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return '#16a34a';
            case 'rejected': return '#ef4444';
            case 'draft': return '#9ca3af';
            default: return '#ca8a04';
        }
    };

    const getStatusText = (status: string) => {
        const map: Record<string, string> = {
            approved: 'Onaylandı',
            rejected: 'Reddedildi',
            draft: 'Taslak',
            sent: 'Gönderildi',
            revised: 'Revize'
        };
        return map[status] || status;
    };

    const [userProfile, setUserProfile] = useState<{ full_name?: string; role?: string; email?: string } | null>(null);

    // Initial Auth Check
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Try fetch profile
                const { data: profile } = await supabase
                    .from('representatives')
                    .select('full_name, role')
                    .eq('id', user.id)
                    .single();

                setUserProfile({
                    full_name: profile?.full_name || 'Kullanıcı',
                    role: profile?.role || 'Satış Temsilcisi', // Fallback role
                    email: user.email
                });
            }
        };
        getUser();
    }, []);

    // ... fetchData logic ...

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#13ec5b" />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Merhaba, {userProfile?.full_name?.split(' ')[0] || '...'}</Text>
                        <Text style={styles.subtitle}>{userProfile?.role || 'Yükleniyor...'}</Text>
                    </View>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {userProfile?.full_name ? userProfile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AI'}
                        </Text>
                    </View>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>AYLIK HEDEF</Text>
                        <Text style={styles.statValue}>%{stats.targetProgress}</Text>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${stats.targetProgress}%` }]} />
                        </View>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>ONAYLANAN</Text>
                        <Text style={styles.statValue}>{formatCurrency(stats.approvedAmount)}</Text>
                        <Text style={styles.pendingText}>{stats.pendingCount} Bekleyen</Text>
                    </View>
                </View>

                {/* Recent Proposals */}
                <Text style={styles.sectionTitle}>Son İşlemler</Text>

                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color="#13ec5b" />
                ) : (
                    <View style={styles.proposalList}>
                        {proposals.slice(0, 10).map((proposal) => (
                            <View key={proposal.id} style={styles.proposalCard}>
                                <View style={styles.proposalInfo}>
                                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(proposal.status) }]} />
                                    <View style={styles.proposalDetails}>
                                        <Text style={styles.customerName} numberOfLines={1}>{proposal.customer_name}</Text>
                                        <Text style={styles.proposalMeta}>{proposal.proposal_no} • {getStatusText(proposal.status)}</Text>
                                    </View>
                                </View>
                                <View style={styles.proposalRight}>
                                    <Text style={styles.amount}>{formatCurrency(proposal.amount)}</Text>
                                    <Text style={styles.timeAgo}>{getTimeAgo(proposal.created_at)}</Text>
                                </View>
                            </View>
                        ))}
                        {proposals.length === 0 && (
                            <Text style={styles.emptyText}>Henüz teklif yok.</Text>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f6f8f6',
    },
    scrollView: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111813',
    },
    subtitle: {
        fontSize: 12,
        color: '#61896f',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#13ec5b',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontWeight: 'bold',
        color: '#102216',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dbe6df',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#61896f',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#111813',
    },
    progressBar: {
        height: 4,
        backgroundColor: '#e5e7eb',
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#13ec5b',
    },
    pendingText: {
        fontSize: 12,
        color: '#13ec5b',
        fontWeight: 'bold',
        marginTop: 4,
    },
    actionButton: {
        backgroundColor: '#13ec5b',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 32,
    },
    actionButtonText: {
        color: '#102216',
        fontWeight: 'bold',
        fontSize: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111813',
        marginBottom: 16,
    },
    proposalList: {
        gap: 12,
        marginBottom: 32,
    },
    proposalCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dbe6df',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    proposalInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    proposalDetails: {
        flex: 1,
    },
    customerName: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#111813',
    },
    proposalMeta: {
        fontSize: 12,
        color: '#61896f',
    },
    proposalRight: {
        alignItems: 'flex-end',
    },
    amount: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#111813',
    },
    timeAgo: {
        fontSize: 10,
        color: '#61896f',
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        color: '#61896f',
        paddingVertical: 16,
    },
});
