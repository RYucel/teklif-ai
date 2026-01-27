import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            alert('Push notification permissions are required!');
            return;
        }

        // Get the token that uniquely identifies this device
        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            if (!projectId) {
                // Fallback for dev or bare workflow if needed, though usually projectId is required
                // console.warn('Project ID not found');
            }

            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;

            console.log('Expo Push Token:', token);

            // Save to Supabase
            await saveTokenToDatabase(token);

        } catch (e) {
            console.error('Error getting push token:', e);
        }
    } else {
        alert('Must use physical device for Push Notifications');
    }

    return token;
}

async function saveTokenToDatabase(token: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if subscription exists
    const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('endpoint', token) // Reusing endpoint column for token
        .single();

    if (!existing) {
        await supabase
            .from('push_subscriptions')
            .insert({
                user_id: user.id,
                endpoint: token, // Storing Expo token in endpoint
                keys: { type: 'expo' }, // Marker to distinguish from web push
                user_agent: Platform.OS + ' ' + Platform.Version
            });
    }
}
