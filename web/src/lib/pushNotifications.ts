
import { supabase } from '@/lib/supabaseClient';

const VAPID_PUBLIC_KEY = 'BN93gFFNJtO214xAX9AmcivFdkGkWhlZjD_R6cSttW82MWtW-dw-gpXKGPd6Z_cI15bXhDTEisTuW7Fv6sJEkK4';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function subscribeUserToPush() {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker not supported');
    }

    if (!('PushManager' in window)) {
        throw new Error('Push Manager not supported');
    }

    const registration = await navigator.serviceWorker.ready;

    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
        console.log('User already subscribed:', existingSubscription);
        return existingSubscription;
    }

    const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    try {
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        // Save to Supabase
        const { error } = await supabase.from('push_subscriptions').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            endpoint: subscription.endpoint,
            p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh')!)))),
            auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')!))))
        });

        if (error) {
            console.error('Failed to save subscription:', error);
            // Optional: Unsubscribe if we can't save to DB
            // await subscription.unsubscribe();
            // throw error;
        }

        console.log('User subscribed successfully:', subscription);
        return subscription;
    } catch (error) {
        console.error('Failed to subscribe user:', error);
        throw error;
    }
}
