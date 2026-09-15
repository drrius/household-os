import { Text, View } from "react-native";

export default function GroceriesScreen() {
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      testID="groceries-screen"
    >
      <Text>Groceries — lands in the Groceries PR.</Text>
    </View>
  );
}
