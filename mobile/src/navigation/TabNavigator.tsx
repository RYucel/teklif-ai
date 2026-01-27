import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import ProposalsScreen from '../screens/ProposalsScreen';
import ChatScreen from '../screens/ChatScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
    const icons: Record<string, string> = {
        'Ana Sayfa': '🏠',
        'Teklifler': '📄',
        'Asistan': '💬',
        'Bildirimler': '🔔',
    };
    return (
        <View style={styles.iconContainer}>
            <Text style={[styles.icon, focused && styles.iconFocused]}>{icons[name]}</Text>
        </View>
    );
}

export default function TabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
                tabBarActiveTintColor: '#13ec5b',
                tabBarInactiveTintColor: '#61896f',
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabLabel,
            })}
        >
            <Tab.Screen name="Ana Sayfa" component={HomeScreen} />
            <Tab.Screen name="Teklifler" component={ProposalsScreen} />
            <Tab.Screen name="Asistan" component={ChatScreen} />
            <Tab.Screen name="Bildirimler" component={NotificationsScreen} />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#dbe6df',
        height: 60,
        paddingBottom: 8,
        paddingTop: 8,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 20,
        opacity: 0.6,
    },
    iconFocused: {
        opacity: 1,
    },
});
