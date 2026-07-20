import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import React from 'react';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList>
        <TabTrigger name="home" href="/" />
        <TabTrigger name="explore" href="/explore" />
      </TabList>
    </Tabs>
  );
}
