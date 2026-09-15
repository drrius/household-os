import { Text, View } from "react-native";

export default function TodayScreen() {
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      testID="today-screen"
    >
      <Text testID="today-title">Household OS — Today</Text>
      <Text testID="online-note">Online-only scaffold. No offline queue.</Text>
    </View>
  );
}
