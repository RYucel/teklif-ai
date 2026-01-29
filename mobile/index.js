// CRITICAL: This import MUST be first, before any other imports
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';

function Main() {
    return (
        <SafeAreaProvider>
            <App />
        </SafeAreaProvider>
    );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Main);
