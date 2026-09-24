import { Text, View } from "react-native";
import type { DateFieldProps } from "./DateField";
import { styles as s } from "./styles";

export function DateField({ label, value, onChange, minimum, error }: DateFieldProps) {
  return <View style={{ gap: 6 }}>
    <Text style={s.label}>{label}</Text>
    <input aria-label={label} type="date" value={value} min={minimum} onChange={(event) => onChange(event.target.value)} style={{ padding: 15, fontSize: 16, borderRadius: 12, border: "1px solid #b8cbc0", color: "#173b33", background: "#fbfdfb", minWidth: 0 }} />
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}
