import { Text, View } from "react-native";
import { tokens } from "../../src/theme/tokens";

export default function TodayScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.color.background,
      }}
      testID="today-screen"
    >
      <Text testID="today-title">Household OS — Today</Text>
      <Text>Shell ready. Read model lands in the Today PR.</Text>
    </View>
  );
}
