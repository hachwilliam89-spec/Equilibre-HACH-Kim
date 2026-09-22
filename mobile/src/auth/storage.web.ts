// Aperçu web uniquement : aucun jeton dans localStorage ou sessionStorage.
let value: string | null = null;
export const storage = {
  read: async () => value,
  write: async (next: string) => {
    value = next;
  },
  clear: async () => {
    value = null;
  },
};
