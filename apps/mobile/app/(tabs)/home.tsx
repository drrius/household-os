import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      testID="home-screen"
    >
      <Text>Home — lands in the Home PR.</Text>
    </View>
  );
}
