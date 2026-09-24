import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Client, Plan, Preview, clients, currentPlan, planSchema, previewSchema, requestApi } from "../../plans/api";
import { budgetSchema, goalsSchema, weeklyRate } from "../../plans/form";
import { Button, Field, Screen } from "../../plans/ui";
import { styles as s } from "../../ui/styles";

import { DateField } from "../../ui/DateField";
import { MeasurementField } from "../../ui/MeasurementField";
import { displayDate, nextDate } from "../../ui/dates";

const activities = { sedentaire: "Sédentaire", actif: "Actif", sportif: "Sportif", athlete: "Athlète" } as const;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export default function UserPlan() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [step, setStep] = useState<"detail" | "goals" | "budget">("detail");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [fields, setFields] = useState({ poidsDepart: "", poidsCible: "", dateDebut: today(), dateCible: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [activity, setActivity] = useState<keyof typeof activities>("sedentaire");
  const [budget, setBudget] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [suggestedBudget, setSuggestedBudget] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([clients(), currentPlan(userId)]).then(([all, current]) => {
      if (!active) return;
      const selected = all.find((u) => u.id === userId);
      if (!selected) throw new Error("Cet utilisateur n’est pas rattaché à votre compte.");
      setClient(selected); setPlan(current);
    }).catch((e: Error) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, reload]);
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Opération impossible."); }
    finally { lock.current = false; setBusy(false); }
  };
  const goals = goalsSchema.safeParse(fields);
  const rate = goals.success ? weeklyRate(goals.data.poidsDepart, goals.data.poidsCible, goals.data.dateDebut, goals.data.dateCible) : null;
  const imc = goals.success && client?.tailleCm ? goals.data.poidsCible / (client.tailleCm / 100) ** 2 : null;
  const automatic = !!(client?.age && client?.sexe);
  const next = () => {
    setFieldErrors({}); setError("");
    if (!goals.success) {
      setFieldErrors(Object.fromEntries(goals.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return;
    }
    if (!client?.tailleCm) { setError("La taille doit être renseignée dans le profil avant de soumettre un plan."); return; }
    const limit = goals.data.poidsCible < goals.data.poidsDepart ? 1 : 0.5;
    if (imc! < 18.5) { setFieldErrors({ poidsCible: "L’IMC cible doit être au moins égal à 18,5." }); return; }
    if (rate! > limit + 1e-9) { setFieldErrors({ dateCible: `Rythme maximal : ${limit} kg/semaine. Allongez la durée ou ajustez l’objectif.` }); return; }
    setPreview(null); setBudget(""); setSuggestedBudget(null); setStep("budget");
  };
  const calculate = () => run(async () => {
    if (!goals.success) throw new Error("Vérifiez les objectifs.");
    let manual: number | undefined;
    if (!automatic) {
      const parsed = budgetSchema.safeParse(budget);
      if (!parsed.success) throw new Error("Saisissez un budget calorique positif.");
      manual = parsed.data;
    }
    const result = previewSchema.parse(await requestApi("/plans/preview", "POST", { ...goals.data, userId, niveauActivite: activity, ...(manual === undefined ? {} : { budgetCalorique: manual }) }));
    setPreview(result); setSuggestedBudget(manual === undefined ? result.budgetCalorique : null);
    setBudget(String(result.budgetCalorique));
  });
  const submit = () => run(async () => {
    if (!goals.success || !preview) throw new Error("Consultez la proposition avant de soumettre le plan.");
    const parsed = budgetSchema.safeParse(budget);
    if (!parsed.success) throw new Error("Saisissez un budget calorique positif.");
    const result = planSchema.parse(await requestApi("/plans", "POST", {
      ...goals.data, userId, niveauActivite: activity,
      // Sans modification, laisser le serveur recalculer la suggestion et son avertissement.
      ...(suggestedBudget !== null && parsed.data === suggestedBudget ? {} : { budgetCalorique: parsed.data }),
    }));
    setPlan(result); setStep("detail"); setNotice("Le plan a été soumis et enregistré."); setPreview(null);
  });
  const cancel = () => Alert.alert("Annuler le plan ?", "L’utilisateur n’aura plus de plan actif.", [
    { text: "Conserver", style: "cancel" },
    { text: "Annuler le plan", style: "destructive", onPress: () => void run(async () => {
      if (!plan) return;
      await requestApi(`/plans/${encodeURIComponent(plan.id)}/cancel`, "POST");
      setPlan(null); setNotice("Le plan a été annulé.");
    }) },
  ]);
  return <Screen>
    <Text style={s.title}>{step === "detail" ? "Suivi d’un utilisateur" : step === "goals" ? "Objectifs · 1/2" : "Budget et validation · 2/2"}</Text>
    {client && <Text style={s.text}>{client.email}{client.tailleCm ? ` · ${client.tailleCm} cm` : " · Taille non renseignée"}</Text>}
    {!!notice && <Text accessibilityRole="alert" style={s.text}>{notice}</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {loading ? <ActivityIndicator /> : client && <>
      {step === "detail" && <View style={s.card}>
        <Text style={s.label}>Plan actuel</Text>
        {plan ? <>
          <Text style={s.text}>{plan.poidsDepart} kg → {plan.poidsCible} kg</Text>
          <Text style={s.text}>{displayDate(plan.dateDebut)} → {displayDate(plan.dateCible)}</Text>
          <Text style={s.text}>IMC cible : {plan.imcCible.toFixed(1)}</Text>
          <Text style={s.text}>Budget : {plan.budgetCalorique.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kcal/jour</Text>
          <Text style={s.text}>Statut : actif</Text>
          {plan.budgetPlafonneAuBmr && <Text style={s.text}>Le budget suggéré a été ramené au BMR.</Text>}
          <Button title="Annuler le plan actif" disabled={busy} onPress={cancel} />
        </> : <>
          <Text style={s.text}>Aucun plan actif.</Text>
          {!client.tailleCm && <Text style={s.error}>La taille du profil doit être renseignée avant la soumission.</Text>}
          <Button title="Créer un plan" disabled={busy || !client.tailleCm} onPress={() => { setStep("goals"); setNotice(""); }} />
        </>}
      </View>}
      {step === "goals" && <View style={s.card}>
        {([ ["poidsDepart", "Poids de départ (kg)"], ["poidsCible", "Poids cible (kg)"] ] as const).map(([key, label]) => <MeasurementField key={key} label={label} unit="kg" value={fields[key]} onChange={(value) => { setFields((old) => ({ ...old, [key]: value })); setFieldErrors((old) => ({ ...old, [key]: "" })); }} error={fieldErrors[key]} />)}
        <DateField label="Date de début" value={fields.dateDebut} onChange={(value) => {
          const resetTarget = !!fields.dateCible && fields.dateCible <= value;
          setFields((old) => ({ ...old, dateDebut: value, dateCible: resetTarget ? "" : old.dateCible }));
          setFieldErrors((old) => ({ ...old, dateDebut: "", dateCible: resetTarget ? "Choisissez une date cible après la nouvelle date de début." : "" }));
        }} error={fieldErrors.dateDebut} />
        <DateField label="Date cible" value={fields.dateCible} minimum={fields.dateDebut ? nextDate(fields.dateDebut) : undefined} onChange={(value) => { setFields((old) => ({ ...old, dateCible: value })); setFieldErrors((old) => ({ ...old, dateCible: "" })); }} error={fieldErrors.dateCible} />
        {rate !== null && <Text style={s.text}>Rythme : {rate.toFixed(2)} kg/semaine · IMC cible : {imc?.toFixed(1)}</Text>}
        <Button title="Continuer vers le budget" onPress={next} />
        <Button title="Abandonner" onPress={() => { setStep("detail"); setError(""); }} />
      </View>}
      {step === "budget" && <View style={s.card}>
        <Text style={s.label}>Niveau d’activité</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(Object.keys(activities) as (keyof typeof activities)[]).map((key) => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: activity === key }} disabled={busy} onPress={() => { setActivity(key); setPreview(null); setSuggestedBudget(null); if (automatic) setBudget(""); }} style={[s.input, activity === key && { backgroundColor: "#e4efea" }]}><Text>{activities[key]}</Text></Pressable>)}
        </View>
        {!automatic && <Text style={s.text}>Âge ou sexe non renseigné : saisissez le budget manuellement.</Text>}
        {(!automatic || preview) && <Field label="Budget retenu (kcal/jour)" value={budget} onChange={(value) => { setBudget(value); if (!automatic) setPreview(null); }} numeric disabled={busy} />}
        <Button title={automatic ? "Calculer la proposition" : "Vérifier la proposition"} disabled={busy} onPress={() => void calculate()} />
        {preview && <>
          <Text style={s.label}>Récapitulatif du plan</Text>
          <Text style={s.text}>{preview.poidsDepart} kg → {preview.poidsCible} kg</Text>
          <Text style={s.text}>{displayDate(preview.dateDebut)} → {displayDate(preview.dateCible)}</Text>
          <Text style={s.text}>IMC cible : {preview.imcCible.toFixed(1)}</Text>
          {suggestedBudget !== null && <Text style={s.text}>Budget suggéré : {suggestedBudget.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kcal/jour</Text>}
          {!!preview.avertissement && <Text style={s.text}>{preview.avertissement}</Text>}
          <Text style={s.text}>Budget retenu : {budget} kcal/jour</Text>
          <Button title={busy ? "Traitement…" : "Créer et soumettre le plan"} disabled={busy} onPress={() => void submit()} />
        </>}
        <Button title="Retour aux objectifs" disabled={busy} onPress={() => { setStep("goals"); setPreview(null); setError(""); }} />
      </View>}
    </>}
    {step === "detail" && <Button title="Actualiser le plan" disabled={busy || loading} onPress={() => { setLoading(true); setError(""); setReload((v) => v + 1); }} />}
    <Button title="Retour à mes utilisateurs" disabled={busy} onPress={() => router.replace("/coach")} />
  </Screen>;
}
