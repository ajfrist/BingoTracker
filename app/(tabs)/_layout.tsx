import { Tabs } from 'expo-router';
import React from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { display: 'none' },
        headerShown: false,
      }}>
      <Tabs.Screen name="index" options={{ title: 'BINGO Tracker' }} />
      <Tabs.Screen name="setup" options={{ title: 'Setup New Game' }} />
      <Tabs.Screen name="previous" options={{ title: 'Previous Games' }} />
    </Tabs>
  );
}
