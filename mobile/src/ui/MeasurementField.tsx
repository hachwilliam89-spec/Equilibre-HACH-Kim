import { Picker } from "@react-native-picker/picker";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { PickerSheet } from "./PickerSheet";
import { styles as s } from "./styles";

const heights = Array.from({ length: 250 }, (_, index) => index + 1);
const weights = Array.from({ length: 351 }, (_, index) => index);
const decimals = Array.from({ length: 10 }, (_, index) => index);
export function MeasurementField({ label, value, onChange, unit, error, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; unit: "kg" | "cm"; error?: string; disabled?: boolean;
}) {
  const [manual, setManual] = useState(false);
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(0);
  const [decimal, setDecimal] = useState(0);
  const show = () => {
    const number = Number(value.replace(",", "."));
    // Preserve unusual values and precision through the unrestricted keyboard input.
    if (value && (!Number.isFinite(number) || number <= 0 || number > (unit === "cm" ? 250 : 350.9) ||
      Math.abs(number * (unit === "cm" ? 1 : 10) - Math.round(number * (unit === "cm" ? 1 : 10))) > 1e-8)) {
      setManual(true);
      return;
    }
    const initial = Number.isFinite(number) && number > 0 ? number : unit === "cm" ? 170 : 70;
    const tenths = Math.round(initial * 10);
    setWhole(Math.floor(tenths / 10));
    setDecimal(tenths % 10);
    setOpen(true);
  };
  return <View style={{ gap: 6 }}>
    <Text style={s.label}>{label}</Text>
    {manual ? <TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" editable={!disabled} /> :
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} : ${value || "Choisir"}`} disabled={disabled} onPress={show} style={[s.input, disabled && s.disabled]}>
        <Text style={s.text}>{value ? `${value.replace(".", ",")} ${unit}` : `Choisir ${unit === "cm" ? "la taille" : "le poids"}`}</Text>
      </Pressable>}
    <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setManual(!manual)}><Text style={s.link}>{manual ? "Utiliser le sélecteur" : "Saisir au clavier"}</Text></Pressable>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <PickerSheet visible={open} title={label} onCancel={() => setOpen(false)} onConfirm={() => { onChange(String(unit === "cm" ? whole : (whole * 10 + decimal) / 10)); setOpen(false); }}>
      <View style={{ flexDirection: "row" }}>
        <Picker accessibilityLabel={unit === "cm" ? "Centimètres" : "Kilogrammes"} selectedValue={whole} onValueChange={setWhole} style={{ flex: 2 }} itemStyle={{ color: "#173b33" }}>
          {(unit === "cm" ? heights : weights).map((number) => <Picker.Item key={number} label={`${number} ${unit}`} value={number} />)}
        </Picker>
        {unit === "kg" && <Picker accessibilityLabel="Dixièmes de kilogramme" selectedValue={decimal} onValueChange={setDecimal} style={{ flex: 1 }} itemStyle={{ color: "#173b33" }}>
          {decimals.map((number) => <Picker.Item key={number} label={`,${number}`} value={number} />)}
        </Picker>}
      </View>
      <Text style={s.text}>{unit === "cm" ? whole : `${whole},${decimal}`} {unit}</Text>
    </PickerSheet>
  </View>;
}
