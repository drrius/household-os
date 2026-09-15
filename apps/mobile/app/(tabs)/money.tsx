import { Text, View } from "react-native";

export default function MoneyScreen() {
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      testID="money-screen"
    >
      <Text>Money — lands in the Money PR.</Text>
    </View>
  );
}
