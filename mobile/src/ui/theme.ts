/**
 * Charte Equilibre : un vert profond (marque), un vert vif (le point du
 * logo) et des fonds légèrement teintés pour sortir du « tout blanc ».
 */
export const colors = {
  brand: "#087454",
  brandDeep: "#0a4f3c",
  brandBright: "#1fbf86",
  mint: "#e3f3ea",
  mintSoft: "#f1f8f4",
  page: "#f4f8f5",
  card: "#ffffff",
  border: "#dbe7df",
  borderStrong: "#b8cbc0",
  ink: "#173b33",
  muted: "#536861",
  subtle: "#7c8f87",
  onBrand: "#ffffff",
  onBrandMuted: "#bfe6d4",
  danger: "#a32d29",
  warning: "#9a4d00",
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 } as const;
