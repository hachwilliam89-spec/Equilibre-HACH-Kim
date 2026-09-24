import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { dateValue, displayDate, localDate } from "./dates";
import { PickerSheet } from "./PickerSheet";
import { styles as s } from "./styles";

export type DateFieldProps = { label: string; value: string; onChange: (value: string) => void; minimum?: string; error?: string };
export function DateField({ label, value, onChange, minimum, error }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const show = () => {
    const initial = value || dateValue(new Date());
    const date = localDate(minimum && initial < minimum ? minimum : initial);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: date, mode: "date", minimumDate: minimum ? localDate(minimum) : undefined,
        onValueChange: (_, selected) => onChange(dateValue(selected)),
      });
    } else { setDraft(date); setOpen(true); }
  };
  return <View style={{ gap: 6 }}>
    <Text style={s.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} : ${value ? displayDate(value) : "Choisir une date"}`} onPress={show} style={s.input}>
      <Text style={s.text}>{value ? displayDate(value) : "Choisir une date"}</Text>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <PickerSheet visible={open} title={label} onCancel={() => setOpen(false)} onConfirm={() => { onChange(dateValue(draft)); setOpen(false); }}>
      {open && <DateTimePicker value={draft} mode="date" display="inline" locale="fr-FR" themeVariant="light" minimumDate={minimum ? localDate(minimum) : undefined} onValueChange={(_, date) => setDraft(date)} />}
    </PickerSheet>
  </View>;
}
