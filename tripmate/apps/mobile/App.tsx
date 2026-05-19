import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from './src/store/auth';
import LoginScreen from './src/screens/LoginScreen';
import TripsScreen from './src/screens/TripsScreen';
import TripDetailScreen from './src/screens/TripDetailScreen';
import CreateTripScreen from './src/screens/CreateTripScreen';
import JoinTripScreen from './src/screens/JoinTripScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import SettlementScreen from './src/screens/SettlementScreen';
import AlbumScreen from './src/screens/AlbumScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import DiscoverResultsScreen from './src/screens/DiscoverResultsScreen';
import TraveloguesScreen from './src/screens/TraveloguesScreen';
import TravelogueDetailScreen from './src/screens/TravelogueDetailScreen';
import { colors } from './src/lib/theme';

export type RootStackParamList = {
  Login: undefined;
  Trips: undefined;
  CreateTrip: undefined;
  JoinTrip: undefined;
  TripDetail: { tripId: string };
  Expenses: { tripId: string };
  AddExpense: { tripId: string };
  Settlement: { tripId: string };
  Album: { tripId: string };
  Discover: { tripId?: string };
  DiscoverResults: { discoveryId: string };
  Travelogues: { tripId: string };
  TravelogueDetail: { tripId: string; travelogueId: string };
};
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { session, loading, bootstrap } = useAuth();
  useEffect(() => { bootstrap(); }, [bootstrap]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          {session ? (
            <>
              <Stack.Screen name="Trips" component={TripsScreen} options={{ title: '我的旅程' }} />
              <Stack.Screen name="CreateTrip" component={CreateTripScreen} options={{ title: '新建旅程' }} />
              <Stack.Screen name="JoinTrip" component={JoinTripScreen} options={{ title: '加入旅程' }} />
              <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: '旅程详情' }} />
              <Stack.Screen name="Expenses" component={ExpensesScreen} options={{ title: '团队记账' }} />
              <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: '新增账单' }} />
              <Stack.Screen name="Settlement" component={SettlementScreen} options={{ title: '净额与转账' }} />
              <Stack.Screen name="Album" component={AlbumScreen} options={{ title: '共享相册' }} />
              <Stack.Screen name="Discover" component={DiscoverScreen} options={{ title: '发现目的地' }} />
              <Stack.Screen name="DiscoverResults" component={DiscoverResultsScreen} options={{ title: '候选目的地' }} />
              <Stack.Screen name="Travelogues" component={TraveloguesScreen} options={{ title: 'AI 游记' }} />
              <Stack.Screen name="TravelogueDetail" component={TravelogueDetailScreen} options={{ title: '游记' }} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
