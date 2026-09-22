import * as SecureStore from "expo-secure-store";
// Un seul enregistrement évite un mélange ancien/nouveau jeton après rotation.
const KEY = "equilibre.session.v1";
export const storage = {
  read: () => SecureStore.getItemAsync(KEY),
  write: (value: string) => SecureStore.setItemAsync(KEY, value),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
