import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
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

export default function ProposalsScreen() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchProposals();
    }, []);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredProposals(proposals);
        } else {
            const lower = searchTerm.toLowerCase();
            setFilteredProposals(proposals.filter(p =>
                (p.customer_name || '').toLowerCase().includes(lower) ||
                (p.proposal_no || '').toLowerCase().includes(lower)
            ));
        }
    }, [searchTerm, proposals]);

    const fetchProposals = async () => {
        try {
            const { data, error } = await supabase
                .from('proposals')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProposals(data as Proposal[]);
            setFilteredProposals(data as Proposal[]);
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number, currency: string) => {
        const symbol = currency === 'TRY' ? '₺' : currency === 'EUR' ? '€' : '$';
        return symbol + amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'approved': return { bg: '#dcfce7', text: '#166534' };
            case 'rejected': return { bg: '#fee2e2', text: '#991b1b' };
            case 'sent': return { bg: '#dbeafe', text: '#1e40af' };
            case 'revised': return { bg: '#fef9c3', text: '#854d0e' };
            default: return { bg: '#f3f4f6', text: '#4b5563' };
        }
    };

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            approved: 'ONAYLANDI',
            rejected: 'REDDEDİLDİ',
            draft: 'TASLAK',
            sent: 'GÖNDERİLDİ',
            revised: 'REVİZE',
        };
        return map[status] || status.toUpperCase();
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Search Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Teklifler</Text>
                <View style={styles.searchRow}>
                    <View style={styles.searchBox}>
                        <Text style={styles.searchIcon}>🔍</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Teklif ara..."
                            placeholderTextColor="#9ca3af"
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>
                    <TouchableOpacity style={styles.filterButton}>
                        <Text>⚙️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#13ec5b" />
                </View>
            ) : (
                <FlatList
                    data={filteredProposals}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>Teklif bulunamadı.</Text>}
                    renderItem={({ item }) => {
                        const statusStyle = getStatusStyle(item.status);
                        return (
                            <View style={styles.proposalCard}>
                                <View style={styles.proposalLeft}>
                                    <View style={styles.proposalHeader}>
                                        <Text style={styles.proposalNo}>{item.proposal_no}</Text>
                                        <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                                            <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                                                {getStatusLabel(item.status)}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.customerName} numberOfLines={1}>{item.customer_name}</Text>
                                </View>
                                <View style={styles.proposalRight}>
                                    <Text style={styles.amount}>{formatCurrency(item.amount, item.currency)}</Text>
                                    <Text style={styles.date}>{formatDate(item.created_at)}</Text>
                                </View>
                            </View>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f6f8f6',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#dbe6df',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111813',
        marginBottom: 16,
    },
    searchRow: {
        flexDirection: 'row',
        gap: 8,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f6f8f6',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: '#dbe6df',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111813',
    },
    filterButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f6f8f6',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#dbe6df',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        padding: 16,
    },
    emptyText: {
        textAlign: 'center',
        color: '#61896f',
        marginTop: 40,
    },
    proposalCard: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dbe6df',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    proposalLeft: {
        flex: 1,
    },
    proposalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    proposalNo: {
        fontWeight: 'bold',
        color: '#111813',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    customerName: {
        fontSize: 14,
        color: '#61896f',
    },
    proposalRight: {
        alignItems: 'flex-end',
    },
    amount: {
        fontWeight: '900',
        fontSize: 16,
        color: '#111813',
    },
    date: {
        fontSize: 10,
        color: '#61896f',
    },
});
