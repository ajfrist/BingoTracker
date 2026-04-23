import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // Helper for left-facing back arrow
  const BackArrow = (options: any) => (
    <Pressable
      onPress={() => {options['home'] ? router.navigate('/(tabs)') : router.navigate('/(tabs)/setup');}}
      style={{ marginLeft: 16 }}
      accessibilityLabel="Back to Home"
    >
      <IconSymbol name="chevron.left" size={28} color={colorScheme === 'dark' ? '#fff' : '#000'} />
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'BINGO Tracker', headerShown: false }} />
      <Tabs.Screen
        name="setup"
        options={{
          title: 'Setup New Game',
          headerShown: true,
          headerLeft: () => <BackArrow home={true} />,
        }}
      />
      <Tabs.Screen
        name="previous"
        options={{
          title: 'Previous Games',
          headerShown: true,
          headerLeft: () => <BackArrow home={true} />,
        }}
      />
      <Tabs.Screen
        name="BingoBoards"
        options={{
          title: 'Bingo Boards',
          headerShown: true,
          headerLeft: () => <BackArrow home={false} />,
        }}
      />
    </Tabs>
  );
}
