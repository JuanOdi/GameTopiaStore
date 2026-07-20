import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function ExploreScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Explore</Text>
      </View>
    </>
  );
}
