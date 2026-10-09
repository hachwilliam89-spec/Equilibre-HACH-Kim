import { z } from "zod";
import { parseApiData } from "../network/http";
import { requestApi } from "../plans/api";
import { identitySchema, type Identity } from "./identity";

export const coachAccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  prenom: z.string().optional(),
  nom: z.string().optional(),
  coachCode: z.string(),
});
export type CoachAccount = z.infer<typeof coachAccountSchema>;

export const getCoachAccount = async () =>
  parseApiData(coachAccountSchema, await requestApi("/coach/me"));

export const updateCoachIdentity = async (identity: Identity) =>
  parseApiData(coachAccountSchema, await requestApi("/coach/me", "PATCH", identitySchema.parse(identity)));
