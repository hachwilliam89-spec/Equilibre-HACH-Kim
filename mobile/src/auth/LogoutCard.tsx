import { Text, View } from "react-native";
import { Button } from "../plans/ui";
import { styles as s } from "../ui/styles";
import { useLogout } from "./useLogout";

export function LogoutCard() {
  const { leave, busy, error, warning, label } = useLogout();
  return (
    <View style={{ gap: 10 }}>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!!warning && <Text accessibilityRole="alert" style={s.error}>{warning}</Text>}
      <Button title={label} variant="danger" disabled={busy} onPress={() => void leave()} />
    </View>
  );
}
