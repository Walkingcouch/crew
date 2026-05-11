import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';

const ACTIVE_COLOR  = '#2d8055'; // --color-crew-primary
const INACTIVE_COLOR = '#a8a39a'; // --color-n-400
const TAB_BG        = '#ffffff'; // --color-n-0
const BORDER_COLOR  = '#e4e2dd'; // --color-n-200

type SFSymbol = React.ComponentProps<typeof SymbolView>['name'];

function TabIcon({
  name,
  focused,
}: {
  name: SFSymbol;
  focused: boolean;
}) {
  return (
    <SymbolView
      name={name}
      size={24}
      tintColor={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
      type={focused ? 'hierarchical' : 'monochrome'}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: BORDER_COLOR,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: 'DMSans_500Medium',
          fontSize: 10,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="house.fill" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="magnifyingglass" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="briefcase.fill" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="message.fill" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person.crop.circle.fill" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
