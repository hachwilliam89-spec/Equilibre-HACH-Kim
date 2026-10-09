import { createContext, type ReactNode } from "react";

/** Fond sur lequel l'action de compte est posée. */
export type AccountActionTone = "onBrand" | "onPage";

/**
 * Action de compte (déconnexion) fournie par les espaces connectés.
 * Les layouts utilisateur et coach la fournissent ; `Screen` l'affiche dans
 * sa barre fixe, sans dépendre du module d'authentification.
 */
export const AccountActionContext = createContext<((tone: AccountActionTone) => ReactNode) | null>(null);
