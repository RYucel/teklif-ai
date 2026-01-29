import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import ProposalsScreen from '../screens/ProposalsScreen';
import ChatScreen from '../screens/ChatScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Tab = createBottomTabNavigator();

// Simple emoji-based icons to avoid SVG dependencies
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
    let emoji = '🏠';
    if (name === 'Teklifler') emoji = '📄';
    if (name === 'Asistan') emoji = '💬';
    if (name === 'Bildirimler') emoji = '🔔';

    return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
    );
}

export default function TabNavigator() {
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            id="main-tabs"
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
                tabBarActiveTintColor: '#13ec5b',
                tabBarInactiveTintColor: '#61896f',
                tabBarStyle: {
                    backgroundColor: '#fff',
                    borderTopWidth: 1,
                    borderTopColor: '#dbe6df',
                    height: 65 + insets.bottom,
                    paddingBottom: insets.bottom + 8,
                    paddingTop: 8,
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginTop: 2,
                },
                tabBarItemStyle: {
                    paddingVertical: 4,
                },
            })}
        >
            <Tab.Screen name="Ana Sayfa" component={HomeScreen} />
            <Tab.Screen name="Teklifler" component={ProposalsScreen} />
            <Tab.Screen name="Asistan" component={ChatScreen} />
            <Tab.Screen name="Bildirimler" component={NotificationsScreen} />
        </Tab.Navigator>
    );
}
