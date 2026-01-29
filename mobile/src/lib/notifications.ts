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
        shouldShowBanner: true,
        shouldShowList: true,
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

            try {
                const expoToken = (await Notifications.getExpoPushTokenAsync({
                    projectId,
                })).data;
                token = expoToken;
            } catch (expoError) {
                // Fallback to native FCM token
                const deviceToken = (await Notifications.getDevicePushTokenAsync()).data;
                token = deviceToken;
            }

            if (token) {
                await saveTokenToDatabase(token);
            }

        } catch (e) {
            console.error('Error in notification flow:', e);
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

async function saveTokenToDatabase(token: string) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if subscription exists
        const { data: existing, error: selectError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('endpoint', token)
            .single();

        if (!existing) {
            const { error: insertError } = await supabase
                .from('push_subscriptions')
                .insert({
                    user_id: user.id,
                    endpoint: token
                });

            if (insertError) {
                console.error('DB Fail: Insert Error:', insertError.message);
            }
        }
    } catch (e) {
        console.error('CRITICAL DB ERROR:', (e as Error).message);
    }
}
