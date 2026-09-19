import { Tabs } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";

const tabIcons: Record<string, SymbolViewProps["name"]> = {
  today: { ios: "sun.max", android: "today", web: "today" },
  plan: { ios: "calendar", android: "calendar_month", web: "calendar_month" },
  groceries: { ios: "cart", android: "shopping_cart", web: "shopping_cart" },
  money: { ios: "creditcard", android: "payments", web: "payments" },
  home: { ios: "house", android: "home", web: "home" },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarIcon: ({ color, size }) => {
          const name = tabIcons[route.name];
          return name ? (
            <SymbolView name={name} tintColor={color} size={size} />
          ) : null;
        },
      })}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="plan" options={{ title: "Plan" }} />
      <Tabs.Screen name="groceries" options={{ title: "Groceries" }} />
      <Tabs.Screen name="money" options={{ title: "Money" }} />
      <Tabs.Screen name="home" options={{ title: "Home" }} />
    </Tabs>
  );
}
