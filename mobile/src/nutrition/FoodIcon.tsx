import { View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from "react-native-svg";
import type { FoodIconKind } from "./food-icon-kind";

const palette: Record<FoodIconKind, string> = {
  // Féculents
  riceWhite: "#eef1f4", riceBrown: "#f1e8d6", pasta: "#f7ebd5", bread: "#f7ebd5",
  breadSlice: "#f7ebd5", baguette: "#f7ebd5", potato: "#f4ead3", sweetPotato: "#fbe6d2",
  oats: "#f3ecdb", corn: "#fbf2cf", quinoa: "#f1ecde", couscous: "#f6efd7",
  // Légumineuses
  lentils: "#fbe7d6", chickpeas: "#f4ecd7", redBeans: "#f6e1dc", whiteBeans: "#eef1ea", tofu: "#eef1ea",
  // Viandes
  chicken: "#f9e6e1", beefPatty: "#f3e4de", turkeyCutlet: "#f7ece0", ham: "#fbe6e8", porkFillet: "#f8e6e1",
  // Poissons
  salmon: "#fbe7df", tuna: "#f6e0dc", sardine: "#e3eef0", shrimp: "#fbe3dc", cabillaud: "#e3eef0",
  // Œufs
  egg: "#fbf1d6", eggWhite: "#f7f6ee", eggYolk: "#fbefcf", eggFried: "#fbf4df", eggScrambled: "#fbf1d2", omelette: "#fbf0ce",
  // Légumes
  carrot: "#fbeadb", broccoli: "#e3f1e7", mushroom: "#f3e8df", cauliflower: "#eef2ea",
  cucumber: "#e6f0e0", zucchini: "#e8f0dd", greenBeans: "#e6f0df", lettuce: "#e8f3e4",
  onion: "#f0e8f0", bellPepper: "#fbe3dc", spinach: "#e3f1e7", tomato: "#fbe3df",
  eggplant: "#ece2f0", peas: "#e6f1dd", beet: "#f3dfeb",
  // Fruits
  apple: "#fae7e3", banana: "#fbf3d5", avocado: "#e9f0db", pear: "#eef2d8", kiwi: "#e9f0d6",
  peach: "#fbe6dc", grape: "#efe3f3", orange: "#fdeacb", strawberry: "#fbe2e2",
  clementine: "#fdeacb", pineapple: "#fbf2cf", blueberries: "#e4e6f3",
  // Produits laitiers
  milk: "#e5eff8", yogurt: "#e5eff8", fromageBlanc: "#eef4fa", skyr: "#eef4fa",
  cheeseWedge: "#fbf1d6", cheeseBlock: "#fbf0d2", mozzarella: "#eef3f6", camembert: "#f6efdd",
  // Autres
  almond: "#f4eadb", butter: "#fbf1d6", chocolate: "#eee4df", honey: "#fbefd8",
  oil: "#e9efdc", peanutButter: "#efe1d2", walnut: "#f0e5d6",
  // Fallback génériques (chips de famille, aliments futurs)
  bowl: "#f7ebd5", leaf: "#e3f1e7", fruit: "#fae7e3", meat: "#f9e6e1", fish: "#ddf1ee",
};

function Illustration({ kind }: { kind: FoodIconKind }) {
  switch (kind) {
    // ---------------------------------------------------------------- FÉCULENTS
    case "bowl": return <>
      <Path d="M8 22h32c-1 11-7 17-16 17S9 33 8 22Z" fill="#d4a365" stroke="#805b37" strokeWidth="1.5" />
      <Ellipse cx="24" cy="22" rx="16" ry="5" fill="#fff8e8" stroke="#805b37" strokeWidth="1.5" />
      <Circle cx="18" cy="20" r="1.4" fill="#bd9553" /><Circle cx="25" cy="19" r="1.4" fill="#bd9553" /><Circle cx="31" cy="21" r="1.4" fill="#bd9553" />
    </>;
    case "riceWhite": return <>
      <Path d="M8 23h32c-1 11-7 16-16 16S9 34 8 23Z" fill="#dfe4ea" stroke="#8b929c" strokeWidth="1.5" />
      <Ellipse cx="24" cy="23" rx="16" ry="5" fill="#fbfcfe" stroke="#8b929c" strokeWidth="1.5" />
      <Ellipse cx="18" cy="21" rx="2" ry="1" fill="#fff" stroke="#cfd4da" strokeWidth="0.5" />
      <Ellipse cx="25" cy="20" rx="2" ry="1" fill="#fff" stroke="#cfd4da" strokeWidth="0.5" transform="rotate(25 25 20)" />
      <Ellipse cx="31" cy="22" rx="2" ry="1" fill="#fff" stroke="#cfd4da" strokeWidth="0.5" transform="rotate(-20 31 22)" />
    </>;
    case "riceBrown": return <>
      <Path d="M8 23h32c-1 11-7 16-16 16S9 34 8 23Z" fill="#e7dcc6" stroke="#9c8666" strokeWidth="1.5" />
      <Ellipse cx="24" cy="23" rx="16" ry="5" fill="#f3ead8" stroke="#9c8666" strokeWidth="1.5" />
      <Ellipse cx="18" cy="21" rx="2" ry="1" fill="#c9a877" transform="rotate(15 18 21)" />
      <Ellipse cx="25" cy="20" rx="2" ry="1" fill="#bd9a66" transform="rotate(-25 25 20)" />
      <Ellipse cx="31" cy="22" rx="2" ry="1" fill="#c9a877" transform="rotate(20 31 22)" />
    </>;
    case "couscous": return <>
      <Path d="M8 23h32c-1 11-7 16-16 16S9 34 8 23Z" fill="#e9dcb8" stroke="#a98f4f" strokeWidth="1.5" />
      <Ellipse cx="24" cy="23" rx="16" ry="5" fill="#f4e9c6" stroke="#a98f4f" strokeWidth="1.5" />
      <Circle cx="17" cy="21" r="1" fill="#dcc069" /><Circle cx="21" cy="20" r="1" fill="#e6cb74" /><Circle cx="25" cy="21" r="1" fill="#dcc069" />
      <Circle cx="29" cy="20" r="1" fill="#e6cb74" /><Circle cx="23" cy="23" r="1" fill="#dcc069" /><Circle cx="28" cy="23" r="1" fill="#e6cb74" />
    </>;
    case "quinoa": return <>
      <Path d="M8 23h32c-1 11-7 16-16 16S9 34 8 23Z" fill="#e8e1d0" stroke="#a0926f" strokeWidth="1.5" />
      <Ellipse cx="24" cy="23" rx="16" ry="5" fill="#f3eee0" stroke="#a0926f" strokeWidth="1.5" />
      <Circle cx="18" cy="21" r="1.5" fill="none" stroke="#c7b683" strokeWidth="1" /><Circle cx="24" cy="20" r="1.5" fill="none" stroke="#c7b683" strokeWidth="1" />
      <Circle cx="30" cy="21" r="1.5" fill="none" stroke="#c7b683" strokeWidth="1" /><Circle cx="27" cy="23" r="1.5" fill="none" stroke="#c7b683" strokeWidth="1" />
    </>;
    case "oats": return <>
      <Path d="M8 22h32c-1 11-7 17-16 17S9 33 8 22Z" fill="#d9c7a0" stroke="#8f7a52" strokeWidth="1.5" />
      <Ellipse cx="24" cy="22" rx="16" ry="5" fill="#f3ead6" stroke="#8f7a52" strokeWidth="1.5" />
      <Path d="M15 21c3-2 6 2 9 0s6 2 9 0" fill="none" stroke="#c9b283" strokeWidth="1.6" strokeLinecap="round" />
    </>;
    case "pasta": return <>
      <Path d="M10 26h28c-1 8-6 13-14 13s-13-5-14-13Z" fill="#c98256" stroke="#81583e" strokeWidth="1.5" />
      <Ellipse cx="24" cy="26" rx="14" ry="4" fill="#fff4d2" stroke="#81583e" strokeWidth="1.5" />
      <Path d="M14 23c4-8 6 5 10-4s6 6 10-2" fill="none" stroke="#db9f30" strokeWidth="3" strokeLinecap="round" />
    </>;
    case "bread": return <>
      <Path d="M10 19c-2-8 3-13 9-11 3-2 8-2 11 0 7-1 11 5 8 11v20H10V19Z" fill="#bd8150" stroke="#805333" strokeWidth="1.5" />
      <Path d="M14 20c-2-6 1-9 6-8 3-2 6-2 9 0 5-1 8 3 6 8v16H14V20Z" fill="#f7dfad" />
    </>;
    case "breadSlice": return <>
      <Path d="M13 23c0-7 5-11 11-11s11 4 11 11v14a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V23Z" fill="#e3b872" stroke="#b1803f" strokeWidth="1.5" />
      <Path d="M16 24c0-5 4-8 8-8s8 3 8 8v12H16V24Z" fill="#f7e3b8" />
    </>;
    case "baguette": return <>
      <Path d="M9 33 30 12c2-2 6-2 8 0s2 6 0 8L17 41c-2 2-6 2-8 0s-2-6 0-8Z" fill="#dcab63" stroke="#a9752f" strokeWidth="1.5" />
      <Path d="M18 23l3 3M23 28l3 3M28 18l3 3" stroke="#8a5f2a" strokeWidth="1.5" strokeLinecap="round" />
    </>;
    case "potato": return <>
      <Ellipse cx="24" cy="25" rx="17" ry="12" fill="#c99b62" stroke="#8a623c" strokeWidth="1.5" />
      <Circle cx="16" cy="22" r="1.4" fill="#8a623c" /><Circle cx="28" cy="18" r="1.2" fill="#8a623c" /><Circle cx="30" cy="29" r="1.3" fill="#8a623c" />
    </>;
    case "sweetPotato": return <>
      <Path d="M8 28c-3-8 6-15 15-15 9 0 17 4 16 10-1 7-11 13-21 11-6-1-9-2-10-6Z" fill="#dc8347" stroke="#a65a28" strokeWidth="1.5" />
      <Circle cx="18" cy="23" r="1.2" fill="#a65a28" /><Circle cx="28" cy="27" r="1.2" fill="#a65a28" />
    </>;
    case "corn": return <>
      <Path d="M12 24c-4-6-2-12 2-13 2 6 4 9 6 11M36 24c4-6 2-12-2-13-2 6-4 9-6 11" fill="#8db24f" stroke="#5f8033" strokeWidth="1.3" />
      <Ellipse cx="24" cy="27" rx="8" ry="14" fill="#f4cc46" stroke="#b78d26" strokeWidth="1.5" />
      <Path d="M20 17v20M24 15v24M28 17v20" stroke="#dcab2f" strokeWidth="1" />
      <Path d="M18 21h12M18 27h12M18 33h12" stroke="#dcab2f" strokeWidth="1" />
    </>;
    // ------------------------------------------------------------- LÉGUMINEUSES
    case "lentils": return <>
      <Path d="M8 22h32c-1 11-7 17-16 17S9 33 8 22Z" fill="#d79a62" stroke="#8a5c33" strokeWidth="1.5" />
      <Ellipse cx="24" cy="22" rx="16" ry="5" fill="#f0d4a7" stroke="#8a5c33" strokeWidth="1.5" />
      <Ellipse cx="17" cy="20" rx="2.4" ry="1.2" fill="#c06a35" /><Ellipse cx="24" cy="19" rx="2.4" ry="1.2" fill="#b65c2c" />
      <Ellipse cx="31" cy="20" rx="2.4" ry="1.2" fill="#c06a35" /><Ellipse cx="27" cy="22" rx="2.4" ry="1.2" fill="#b65c2c" />
    </>;
    case "chickpeas": return <>
      <Path d="M8 22h32c-1 11-7 17-16 17S9 33 8 22Z" fill="#d4b776" stroke="#8a7140" strokeWidth="1.5" />
      <Ellipse cx="24" cy="22" rx="16" ry="5" fill="#f1e2bd" stroke="#8a7140" strokeWidth="1.5" />
      <Circle cx="18" cy="20" r="2.3" fill="#e4cd8f" stroke="#bfa259" strokeWidth="0.7" /><Circle cx="25" cy="19" r="2.3" fill="#e4cd8f" stroke="#bfa259" strokeWidth="0.7" />
      <Circle cx="31" cy="21" r="2.3" fill="#e4cd8f" stroke="#bfa259" strokeWidth="0.7" />
    </>;
    case "redBeans": return <>
      <Path d="M8 22h32c-1 11-7 17-16 17S9 33 8 22Z" fill="#c98b6e" stroke="#834f39" strokeWidth="1.5" />
      <Ellipse cx="24" cy="22" rx="16" ry="5" fill="#f0d8c6" stroke="#834f39" strokeWidth="1.5" />
      <Path d="M16 21c-1-2 1-3 3-2 2-1 3 1 2 3-2 1-4 1-5-1Z" fill="#9c3030" /><Path d="M24 20c-1-2 1-3 3-2 2-1 3 1 2 3-2 1-4 1-5-1Z" fill="#8a2626" />
      <Path d="M31 21c-1-2 1-3 3-2 2-1 3 1 2 3-2 1-4 1-5-1Z" fill="#9c3030" />
    </>;
    case "whiteBeans": return <>
      <Path d="M8 22h32c-1 11-7 17-16 17S9 33 8 22Z" fill="#cdbf9c" stroke="#857a5c" strokeWidth="1.5" />
      <Ellipse cx="24" cy="22" rx="16" ry="5" fill="#eee7d3" stroke="#857a5c" strokeWidth="1.5" />
      <Ellipse cx="18" cy="20" rx="3" ry="1.5" fill="#f6f1e2" stroke="#cfc3a1" strokeWidth="0.7" transform="rotate(15 18 20)" />
      <Ellipse cx="26" cy="20" rx="3" ry="1.5" fill="#f6f1e2" stroke="#cfc3a1" strokeWidth="0.7" transform="rotate(-18 26 20)" />
    </>;
    case "tofu": return <>
      <Path d="M12 18 24 12l12 6-12 6-12-6Z" fill="#fbfcf7" stroke="#c7c1a9" strokeWidth="1.5" />
      <Path d="M12 18v13l12 6V24Z" fill="#edeee2" stroke="#c7c1a9" strokeWidth="1.5" />
      <Path d="M36 18v13l-12 6V24Z" fill="#f5f6ec" stroke="#c7c1a9" strokeWidth="1.5" />
    </>;
    // ------------------------------------------------------------------ VIANDES
    case "meat": return <>
      <Path d="M10 17c5-8 18-10 26-2 6 7 3 16-5 21-9 5-21 1-25-7-2-5 0-9 4-12Z" fill="#c76556" stroke="#8a3d39" strokeWidth="1.6" />
      <Path d="M15 19c4-4 13-6 18-1" fill="none" stroke="#edaa9b" strokeWidth="2" strokeLinecap="round" />
      <Ellipse cx="25" cy="27" rx="5" ry="3.4" fill="#f9dfcd" />
    </>;
    case "chicken": return <>
      <Ellipse cx="20" cy="20" rx="11" ry="10" fill="#c97a4e" stroke="#8a4f2d" strokeWidth="1.6" />
      <Path d="M14 16c3-3 8-4 11-1" fill="none" stroke="#e7ac85" strokeWidth="2" strokeLinecap="round" />
      <Path d="M26 26 34 34" stroke="#f3e7d2" strokeWidth="5" strokeLinecap="round" />
      <Circle cx="36" cy="32" r="3" fill="#f3e7d2" stroke="#cbb79a" strokeWidth="0.8" /><Circle cx="32" cy="36" r="3" fill="#f3e7d2" stroke="#cbb79a" strokeWidth="0.8" />
    </>;
    case "beefPatty": return <>
      <Ellipse cx="24" cy="27" rx="16" ry="7" fill="#6f4330" stroke="#4a2c1f" strokeWidth="1.5" />
      <Ellipse cx="24" cy="23" rx="16" ry="7" fill="#9a5c3f" stroke="#4a2c1f" strokeWidth="1.5" />
      <Circle cx="18" cy="22" r="1.2" fill="#733f2a" /><Circle cx="26" cy="24" r="1.2" fill="#733f2a" /><Circle cx="30" cy="21" r="1.2" fill="#733f2a" />
    </>;
    case "turkeyCutlet": return <>
      <Path d="M10 26c-2-9 9-15 19-12 9 2 11 10 6 15-6 6-23 5-25-3Z" fill="#e8c9a6" stroke="#b08a5f" strokeWidth="1.5" />
      <Path d="M15 22l6 8M22 20l6 8M29 20l4 6" stroke="#c9a877" strokeWidth="1.4" strokeLinecap="round" />
    </>;
    case "ham": return <>
      <Path d="M11 17h20c3 0 6 3 6 8s-3 8-6 8H11c-1 0-2-1-2-2V19c0-1 1-2 2-2Z" fill="#eda0a4" stroke="#bf6a72" strokeWidth="1.5" />
      <Path d="M31 17c3 0 6 3 6 8s-3 8-6 8" fill="none" stroke="#f6cfc9" strokeWidth="2" />
    </>;
    case "porkFillet": return <>
      <Ellipse cx="24" cy="24" rx="14" ry="11" fill="#d98f7e" stroke="#a65a4b" strokeWidth="1.6" />
      <Ellipse cx="24" cy="24" rx="9" ry="7" fill="#edb9ad" />
      <Ellipse cx="24" cy="24" rx="4" ry="3" fill="#e0a08f" />
    </>;
    // ----------------------------------------------------------------- POISSONS
    case "fish": return <>
      <Polygon points="8,24 4,14 4,34" fill="#4f9f9a" stroke="#286d70" strokeWidth="1.5" />
      <Ellipse cx="26" cy="24" rx="17" ry="11" fill="#73b8ae" stroke="#286d70" strokeWidth="1.5" />
      <Circle cx="34" cy="21" r="1.8" fill="#21474a" />
      <Path d="M16 18c3 4 3 8 0 12M22 16c3 5 3 11 0 16" fill="none" stroke="#cce6df" strokeWidth="1.5" />
    </>;
    case "salmon": return <>
      <Path d="M9 23c7-7 21-9 31-4-2 5-4 9-4 9-10 5-21 3-27-2 0 0 0-2 0-3Z" fill="#f0976f" stroke="#c8653f" strokeWidth="1.5" />
      <Path d="M14 22c7-3 16-3 21 1M14 26c7 2 16 2 21-1" fill="none" stroke="#fbd9c6" strokeWidth="1.6" />
    </>;
    case "tuna": return <>
      <Path d="M12 13h17c6 0 11 5 11 12s-5 12-11 12H12Z" fill="#b24f46" stroke="#7d2d26" strokeWidth="1.5" />
      <Path d="M29 13c6 0 11 5 11 12s-5 12-11 12" fill="none" stroke="#d98379" strokeWidth="2" />
      <Path d="M18 25h14" stroke="#8a352c" strokeWidth="1.4" />
    </>;
    case "sardine": return <>
      <Polygon points="9,24 4,17 4,31" fill="#9fb0b5" stroke="#5f7075" strokeWidth="1.4" />
      <Ellipse cx="26" cy="24" rx="16" ry="9" fill="#c2cdd0" stroke="#5f7075" strokeWidth="1.4" />
      <Circle cx="34" cy="22" r="1.6" fill="#324043" />
      <Path d="M18 19c2 3 2 7 0 10" fill="none" stroke="#8a9a9f" strokeWidth="1.4" />
    </>;
    case "cabillaud": return <>
      <Path d="M9 22c7-6 21-8 31-3-2 6-4 10-4 10-10 5-21 3-27-2 0 0 0-3 0-5Z" fill="#eef2f0" stroke="#9fb3b0" strokeWidth="1.5" />
      <Path d="M15 21c7-3 16-3 21 1M14 26c7 2 16 2 22-1" fill="none" stroke="#cdd9d6" strokeWidth="1.4" />
    </>;
    case "shrimp": return <>
      <Path d="M32 15c-10-3-20 4-20 14 0 5 4 9 9 9 3 0 5-1 7-3" fill="none" stroke="#ef8a63" strokeWidth="6" strokeLinecap="round" />
      <Path d="M31 13l6-2-2 6z" fill="#ef8a63" />
      <Path d="M25 15c-7 1-12 7-12 13M21 17c-6 2-9 7-9 12" fill="none" stroke="#f7b79d" strokeWidth="1.3" />
      <Circle cx="30" cy="18" r="1.2" fill="#7d3a26" />
    </>;
    // --------------------------------------------------------------------- ŒUFS
    case "egg": return <>
      <Ellipse cx="24" cy="26" rx="13" ry="16" fill="#fffdf7" stroke="#c9bfa2" strokeWidth="1.6" />
      <Circle cx="24" cy="27" r="7" fill="#f2c24a" stroke="#cf9a2f" strokeWidth="1" />
    </>;
    case "eggWhite": return <>
      <Ellipse cx="24" cy="26" rx="13" ry="16" fill="#fdfdfa" stroke="#cfcab3" strokeWidth="1.6" />
      <Ellipse cx="24" cy="27" rx="6" ry="5.5" fill="#f3f1e6" />
    </>;
    case "eggYolk": return <>
      <Ellipse cx="24" cy="31" rx="15" ry="7" fill="#fdfbf2" stroke="#e4dabd" strokeWidth="1.4" />
      <Circle cx="24" cy="23" r="9" fill="#f3b437" stroke="#cf9020" strokeWidth="1.2" />
      <Circle cx="21" cy="20" r="2.4" fill="#f7cd6b" opacity="0.7" />
    </>;
    case "eggFried": return <>
      <Path d="M12 24c-4-8 6-13 11-10 3-5 12-3 12 3 6 1 6 9 0 12 2 6-7 10-12 7-7 3-15-4-14-12 0 0 1-1 3-0Z" fill="#fffdf6" stroke="#dacfb0" strokeWidth="1.5" />
      <Circle cx="24" cy="24" r="6.5" fill="#f4b73a" stroke="#cf9020" strokeWidth="1.1" />
    </>;
    case "eggScrambled": return <>
      <Path d="M10 30c-4-6 2-11 7-9 2-4 10-4 12 0 6-2 11 3 8 8 3 5-3 9-8 8-4 3-12 2-14-2-4 0-7-2-5-5Z" fill="#f4cf5e" stroke="#cfa733" strokeWidth="1.5" />
      <Circle cx="18" cy="26" r="1.2" fill="#dcb23f" /><Circle cx="27" cy="24" r="1.2" fill="#dcb23f" /><Circle cx="24" cy="31" r="1.2" fill="#dcb23f" />
    </>;
    case "omelette": return <>
      <Path d="M7 31c0-10 8-16 17-16s17 6 17 16H7Z" fill="#f3cb52" stroke="#c9a02f" strokeWidth="1.5" />
      <Path d="M13 30c3-6 19-6 23 0" fill="none" stroke="#dab23e" strokeWidth="1.6" />
      <Path d="M30 20c2 1 4 3 5 5" fill="none" stroke="#e8c25a" strokeWidth="1.4" strokeLinecap="round" />
    </>;
    // ------------------------------------------------------------------ LÉGUMES
    case "carrot": return <>
      <Path d="M22 13 35 19 17 41 13 38 22 13Z" fill="#ee9a48" stroke="#b76b35" strokeWidth="1.5" />
      <Path d="M22 14c-6-5-8-9-6-10 4 0 7 3 9 9M24 14c1-6 4-9 7-9 2 3 0 7-4 11" fill="#66a06d" stroke="#49835d" strokeWidth="1.2" />
      <Line x1="20" y1="25" x2="27" y2="28" stroke="#d47c3b" strokeWidth="1.5" />
    </>;
    case "broccoli": return <>
      <Rect x="21" y="25" width="6" height="14" rx="2.5" fill="#9cbf6f" stroke="#6f8f4a" strokeWidth="1.2" />
      <Circle cx="17" cy="20" r="6.5" fill="#4f8f54" stroke="#356b3a" strokeWidth="1.2" />
      <Circle cx="26" cy="15" r="7.5" fill="#5a9b5e" stroke="#356b3a" strokeWidth="1.2" />
      <Circle cx="32" cy="21" r="6.5" fill="#4f8f54" stroke="#356b3a" strokeWidth="1.2" />
      <Circle cx="24" cy="23" r="6.5" fill="#5a9b5e" stroke="#356b3a" strokeWidth="1.2" />
    </>;
    case "mushroom": return <>
      <Path d="M20 24h8v15h-8V24Z" fill="#f8e8d1" stroke="#8f725d" strokeWidth="1.5" />
      <Path d="M8 25c1-11 8-17 16-17s15 6 16 17H8Z" fill="#ba8064" stroke="#875d4c" strokeWidth="1.5" />
      <Circle cx="18" cy="17" r="2" fill="#f8dec9" /><Circle cx="29" cy="14" r="2.5" fill="#f8dec9" />
    </>;
    case "cauliflower": return <>
      <Path d="M11 24c-3-2-3-7 1-8 0-4 5-6 8-3 3-3 9-2 9 3 4 0 5 5 2 8Z" fill="#f3efe2" stroke="#b8b196" strokeWidth="1.4" />
      <Path d="M12 23c6 3 12 3 18 0l-2 14H14l-2-14Z" fill="#8fbd6f" stroke="#5f8f45" strokeWidth="1.4" />
      <Circle cx="17" cy="17" r="2" fill="#fbf9f0" /><Circle cx="24" cy="15" r="2.3" fill="#fbf9f0" /><Circle cx="30" cy="18" r="2" fill="#fbf9f0" />
    </>;
    case "cucumber": return <>
      <Rect x="18" y="8" width="12" height="32" rx="6" fill="#3f8f3a" stroke="#2a6128" strokeWidth="1.5" />
      <Path d="M24 12v24" stroke="#6fb45f" strokeWidth="1.4" />
      <Circle cx="24" cy="18" r="0.9" fill="#d7ecc9" /><Circle cx="24" cy="24" r="0.9" fill="#d7ecc9" /><Circle cx="24" cy="30" r="0.9" fill="#d7ecc9" />
    </>;
    case "zucchini": return <>
      <Rect x="24" y="8" width="4" height="5" rx="1.5" fill="#6f9b3f" stroke="#4f6b28" strokeWidth="1" />
      <Rect x="17" y="12" width="14" height="28" rx="7" fill="#5f9b3f" stroke="#3f6b28" strokeWidth="1.5" />
      <Path d="M22 17v18" stroke="#8ec26f" strokeWidth="1.6" strokeLinecap="round" />
    </>;
    case "greenBeans": return <>
      <Path d="M11 36c1-14 5-22 11-26" fill="none" stroke="#5a9b4e" strokeWidth="4" strokeLinecap="round" />
      <Path d="M17 38c1-14 5-22 11-26" fill="none" stroke="#6aa858" strokeWidth="4" strokeLinecap="round" />
      <Path d="M23 39c1-14 5-22 11-26" fill="none" stroke="#5a9b4e" strokeWidth="4" strokeLinecap="round" />
    </>;
    case "lettuce": return <>
      <Circle cx="24" cy="26" r="15" fill="#8fc27a" stroke="#4f8f54" strokeWidth="1.5" />
      <Path d="M24 11v30M12 19c7 4 17 4 24 0M12 33c7-4 17-4 24 0" fill="none" stroke="#5f9b5e" strokeWidth="1.4" />
      <Circle cx="24" cy="26" r="6" fill="#c4e0ab" />
    </>;
    case "onion": return <>
      <Path d="M24 15c8 0 13 7 12 14-1 7-7 11-12 11s-11-4-12-11c-1-7 4-14 12-14Z" fill="#e7d7ea" stroke="#9a7fa0" strokeWidth="1.5" />
      <Path d="M24 15v25M18 17c-3 5-3 16 0 22M30 17c3 5 3 16 0 22" fill="none" stroke="#b89cbf" strokeWidth="1.2" />
      <Path d="M22 15c-1-4 0-6 2-7 2 1 3 3 2 7" fill="#8fbd6f" stroke="#5f8f45" strokeWidth="1.1" />
    </>;
    case "bellPepper": return <>
      <Path d="M14 21c0-5 4-7 10-7s10 2 10 7c0 11-4 17-10 17s-10-6-10-17Z" fill="#d6473f" stroke="#9a2b25" strokeWidth="1.5" />
      <Path d="M19 38c-2-10-2-16 0-21M29 38c2-10 2-16 0-21" fill="none" stroke="#b2332c" strokeWidth="1.2" />
      <Rect x="22" y="9" width="4" height="7" rx="1.5" fill="#5f8f45" stroke="#3f6b28" strokeWidth="1" />
    </>;
    case "spinach":
    case "leaf": return <>
      <Path d="M9 32c0-15 13-23 30-21 2 17-7 29-22 29-5 0-8-3-8-8Z" fill="#77b488" stroke="#3b8060" strokeWidth="1.5" />
      <Path d="M10 40c8-13 17-19 27-25" fill="none" stroke="#3b8060" strokeWidth="2" strokeLinecap="round" />
      <Path d="M18 28l-3-9M27 21l-1-8" fill="none" stroke="#a5d5ac" strokeWidth="1.5" />
    </>;
    case "tomato": return <>
      <Circle cx="24" cy="27" r="14" fill="#e04b3a" stroke="#a52f22" strokeWidth="1.5" />
      <Path d="M24 13l-4-3M24 13l4-3M24 13l-5 1M24 13l5 1M24 13v3" fill="none" stroke="#5f8f45" strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M15 22c2-3 5-4 8-4" fill="none" stroke="#f3a89c" strokeWidth="2" strokeLinecap="round" />
    </>;
    case "eggplant": return <>
      <Path d="M20 15c6-4 13 0 13 9 0 10-6 16-13 16s-12-5-12-13c0-7 5-10 12-12Z" fill="#6b3f8f" stroke="#43265c" strokeWidth="1.5" />
      <Path d="M21 15c-1-4 0-6 3-7 2 1 4 3 3 7" fill="#5f8f45" stroke="#3f6b28" strokeWidth="1.2" />
      <Path d="M15 24c2-3 4-4 7-4" fill="none" stroke="#9c7ab5" strokeWidth="2" strokeLinecap="round" />
    </>;
    case "peas": return <>
      <Path d="M11 18c11 1 22 10 26 21-11-1-22-10-26-21Z" fill="#6aa84f" stroke="#3f6b28" strokeWidth="1.5" />
      <Circle cx="19" cy="22" r="3" fill="#8bc34a" stroke="#5f8f45" strokeWidth="0.8" />
      <Circle cx="25" cy="28" r="3" fill="#8bc34a" stroke="#5f8f45" strokeWidth="0.8" />
      <Circle cx="31" cy="34" r="3" fill="#8bc34a" stroke="#5f8f45" strokeWidth="0.8" />
    </>;
    case "beet": return <>
      <Circle cx="23" cy="26" r="12" fill="#9c2d59" stroke="#64173a" strokeWidth="1.5" />
      <Path d="M23 38c1 3 2 5 3 6" fill="none" stroke="#7d2246" strokeWidth="2" strokeLinecap="round" />
      <Path d="M18 15c-2-4-1-7 1-8 2 3 3 6 2 9M26 15c2-4 5-6 7-5-1 4-3 6-6 8" fill="#6aa84f" stroke="#3f6b28" strokeWidth="1.1" />
    </>;
    // -------------------------------------------------------------------- FRUITS
    case "fruit": return <>
      <Circle cx="24" cy="25" r="15" fill="#eb9370" stroke="#b85f4c" strokeWidth="1.5" />
      <Path d="M24 11c0-4 2-6 5-7" fill="none" stroke="#715444" strokeWidth="2" strokeLinecap="round" />
      <Path d="M27 11c4-5 9-4 11-2-3 4-7 5-11 2Z" fill="#68a273" />
      <Path d="M16 20c2-3 4-4 7-4" fill="none" stroke="#ffd2b7" strokeWidth="2" strokeLinecap="round" />
    </>;
    case "apple": return <>
      <Path d="M25 16c-8-6-17-2-17 8 0 10 7 18 13 16 2-1 4-1 6 0 7 2 14-8 14-17 0-9-9-13-16-7Z" fill="#df675a" stroke="#a14440" strokeWidth="1.5" />
      <Path d="M24 16c-1-5 1-8 4-10" fill="none" stroke="#705044" strokeWidth="2" strokeLinecap="round" />
      <Path d="M27 11c3-5 8-5 11-4-2 5-6 7-11 4Z" fill="#559567" />
      <Path d="M13 21c2-3 4-4 6-4" fill="none" stroke="#f7aaa0" strokeWidth="2" strokeLinecap="round" />
    </>;
    case "banana": return <>
      <Path d="M7 31c9 11 29 8 35-14-8 12-21 16-32 10L7 31Z" fill="#edc94f" stroke="#ad8430" strokeWidth="1.6" />
      <Path d="M11 30c11 7 22 2 29-10" fill="none" stroke="#fff0a4" strokeWidth="2" strokeLinecap="round" />
    </>;
    case "avocado": return <>
      <Ellipse cx="24" cy="26" rx="12" ry="15" fill="#4f7a37" stroke="#355225" strokeWidth="1.6" />
      <Ellipse cx="24" cy="26" rx="8.5" ry="11.5" fill="#cfe0a0" />
      <Circle cx="24" cy="28" r="4.5" fill="#8a5a2b" stroke="#6a421d" strokeWidth="1" />
    </>;
    case "pear": return <>
      <Path d="M24 13c2 0 3 2 3 4 0 2-1 3-1 5 4 2 7 6 7 12 0 6-5 10-9 10s-9-4-9-10c0-6 3-10 7-12 0-2-1-3-1-5 0-2 1-4 3-4Z" fill="#c3d24a" stroke="#8a9a2e" strokeWidth="1.5" />
      <Path d="M24 13c0-3 1-5 3-6" fill="none" stroke="#705044" strokeWidth="2" strokeLinecap="round" />
    </>;
    case "kiwi": return <>
      <Circle cx="24" cy="24" r="15" fill="#8a6a3a" stroke="#5f4722" strokeWidth="1.5" />
      <Circle cx="24" cy="24" r="12.5" fill="#86b24a" />
      <Circle cx="24" cy="24" r="4" fill="#eef4dd" />
      <Circle cx="24" cy="15" r="1" fill="#2c3a1c" /><Circle cx="31" cy="20" r="1" fill="#2c3a1c" /><Circle cx="30" cy="29" r="1" fill="#2c3a1c" />
      <Circle cx="24" cy="33" r="1" fill="#2c3a1c" /><Circle cx="17" cy="29" r="1" fill="#2c3a1c" /><Circle cx="18" cy="20" r="1" fill="#2c3a1c" />
    </>;
    case "peach": return <>
      <Circle cx="24" cy="26" r="14" fill="#f0a65f" stroke="#c87634" strokeWidth="1.5" />
      <Path d="M24 13c3 5 3 21 0 26" fill="none" stroke="#dc8a44" strokeWidth="1.4" />
      <Circle cx="19" cy="23" r="5" fill="#f4bd82" opacity="0.6" />
      <Path d="M24 13c1-4 4-6 7-6-1 4-3 6-7 6Z" fill="#6aa84f" stroke="#3f6b28" strokeWidth="1" />
    </>;
    case "grape": return <>
      <Path d="M26 12c0-3 3-5 6-5-1 4-3 5-6 5Z" fill="#6aa84f" stroke="#3f6b28" strokeWidth="1" />
      <Path d="M24 11v5" stroke="#6a4b32" strokeWidth="1.6" strokeLinecap="round" />
      <Circle cx="18" cy="21" r="4" fill="#7c4f9e" stroke="#4e2f68" strokeWidth="0.8" /><Circle cx="27" cy="21" r="4" fill="#8a5aab" stroke="#4e2f68" strokeWidth="0.8" />
      <Circle cx="22" cy="27" r="4" fill="#8a5aab" stroke="#4e2f68" strokeWidth="0.8" /><Circle cx="31" cy="27" r="4" fill="#7c4f9e" stroke="#4e2f68" strokeWidth="0.8" />
      <Circle cx="26" cy="33" r="4" fill="#7c4f9e" stroke="#4e2f68" strokeWidth="0.8" /><Circle cx="16" cy="28" r="3.6" fill="#7c4f9e" stroke="#4e2f68" strokeWidth="0.8" />
    </>;
    case "orange": return <>
      <Circle cx="24" cy="26" r="14" fill="#f29b2e" stroke="#c0701a" strokeWidth="1.5" />
      <Circle cx="24" cy="26" r="14" fill="none" stroke="#dc8a22" strokeWidth="0.8" strokeDasharray="1 2" />
      <Path d="M24 13c1-4 4-6 7-6-1 4-3 6-7 6Z" fill="#6aa84f" stroke="#3f6b28" strokeWidth="1" />
      <Circle cx="24" cy="14" r="1.6" fill="#c0701a" />
    </>;
    case "clementine": return <>
      <Ellipse cx="24" cy="27" rx="14" ry="12" fill="#f3892a" stroke="#c0661a" strokeWidth="1.5" />
      <Path d="M24 16c3 0 5 1 5 3M24 16c-3 0-5 1-5 3" fill="none" stroke="#d87820" strokeWidth="1" />
      <Path d="M24 15c1-3 4-5 7-5-1 4-3 5-7 5Z" fill="#6aa84f" stroke="#3f6b28" strokeWidth="1" />
    </>;
    case "pineapple": return <>
      <Path d="M24 8c-3 3-6 4-6 4 2 1 3 2 3 2s-4 1-5 3c3 0 5-1 5-1s-2 3-2 5c3-2 5-5 5-5s2 3 5 5c0-2-2-5-2-5s2 1 5 1c-1-2-5-3-5-3s1-1 3-2c0 0-3-1-6-4Z" fill="#6aa84f" stroke="#3f6b28" strokeWidth="1.2" />
      <Ellipse cx="24" cy="30" rx="11" ry="12" fill="#e8b23e" stroke="#b07d20" strokeWidth="1.5" />
      <Path d="M16 24l16 12M32 24 16 36M19 21l12 18M29 21 17 39" stroke="#b07d20" strokeWidth="0.9" />
    </>;
    case "strawberry": return <>
      <Path d="M24 40c-8-3-13-10-13-17 0-3 3-5 6-3 2-2 5-3 7-3s5 1 7 3c3-2 6 0 6 3 0 7-5 14-13 17Z" fill="#e23b3b" stroke="#a52020" strokeWidth="1.5" />
      <Path d="M17 18c2-3 5-4 7-4s5 1 7 4c-2 2-5 3-7 3s-5-1-7-3Z" fill="#5f9b4e" stroke="#3f6b28" strokeWidth="1.1" />
      <Circle cx="19" cy="26" r="0.9" fill="#fbe2a0" /><Circle cx="25" cy="24" r="0.9" fill="#fbe2a0" /><Circle cx="29" cy="28" r="0.9" fill="#fbe2a0" />
      <Circle cx="22" cy="31" r="0.9" fill="#fbe2a0" /><Circle cx="27" cy="33" r="0.9" fill="#fbe2a0" />
    </>;
    case "blueberries": return <>
      <Circle cx="18" cy="27" r="8" fill="#4a5fa0" stroke="#2f3f73" strokeWidth="1.3" />
      <Circle cx="30" cy="23" r="8" fill="#5469ac" stroke="#2f3f73" strokeWidth="1.3" />
      <Circle cx="28" cy="34" r="7" fill="#4a5fa0" stroke="#2f3f73" strokeWidth="1.3" />
      <Path d="M16 25l1.5 1.5 1.5-1.5M28 21l1.5 1.5 1.5-1.5M26 32l1.5 1.5 1.5-1.5" fill="none" stroke="#9aa8d6" strokeWidth="1" strokeLinecap="round" />
    </>;
    // -------------------------------------------------------- PRODUITS LAITIERS
    case "milk": return <>
      <Path d="M14 15h20v26H14V15Z" fill="#fdfefe" stroke="#5a86a3" strokeWidth="1.5" />
      <Path d="M14 15l5-7h10l5 7H14Z" fill="#a8c9e1" stroke="#5a86a3" strokeWidth="1.5" />
      <Path d="M18 27c3-3 9 3 12 0v9H18v-9Z" fill="#a8c9e1" />
    </>;
    case "yogurt": return <>
      <Path d="M13 16h22l-2 24H15l-2-24Z" fill="#fdfefe" stroke="#6487a0" strokeWidth="1.5" />
      <Rect x="11" y="12" width="26" height="5" rx="2" fill="#7fb2cc" stroke="#6487a0" strokeWidth="1" />
      <Path d="M16 25c6-4 10 4 16 0l-1 10H17l-1-10Z" fill="#a8cfe0" />
    </>;
    case "fromageBlanc": return <>
      <Path d="M9 23h30c-1 10-6 15-15 15S10 33 9 23Z" fill="#fbfdff" stroke="#9db6c6" strokeWidth="1.5" />
      <Ellipse cx="24" cy="23" rx="15" ry="4.5" fill="#fff" stroke="#9db6c6" strokeWidth="1.5" />
      <Path d="M31 10l3 2-8 11-3-2 8-11Z" fill="#cdd9e2" stroke="#8fa6b5" strokeWidth="1.2" />
    </>;
    case "skyr": return <>
      <Path d="M11 17h26l-2 22H13l-2-22Z" fill="#ffffff" stroke="#6e94b0" strokeWidth="1.5" />
      <Rect x="9" y="12" width="30" height="6" rx="2" fill="#cfe0ec" stroke="#6e94b0" strokeWidth="1" />
      <Path d="M17 26c5-3 9 3 14 0l-1 11H18l-1-11Z" fill="#eef4fa" />
    </>;
    case "cheeseWedge": return <>
      <Path d="M7 32 38 12l3 25H7v-5Z" fill="#f3c65a" stroke="#ad7c2b" strokeWidth="1.5" />
      <Path d="M7 32h34v5H7v-5Z" fill="#dfaa3d" />
      <Circle cx="31" cy="28" r="2.4" fill="#d99d35" /><Circle cx="23" cy="32" r="1.6" fill="#d99d35" />
    </>;
    case "cheeseBlock": return <>
      <Path d="M9 21 33 14v18l-24 6V21Z" fill="#edc766" stroke="#b08a2e" strokeWidth="1.5" />
      <Path d="M9 21 33 14l6 3-24 6-6-3Z" fill="#f3d888" stroke="#b08a2e" strokeWidth="1.5" />
      <Path d="M33 14v18l6 3V17Z" fill="#dcb24f" stroke="#b08a2e" strokeWidth="1.5" />
      <Circle cx="18" cy="29" r="1.6" fill="#d9ad45" />
    </>;
    case "mozzarella": return <>
      <Ellipse cx="24" cy="35" rx="15" ry="3.5" fill="#dfe8ee" />
      <Circle cx="24" cy="23" r="12" fill="#fbfdfd" stroke="#cdd7dd" strokeWidth="1.5" />
      <Ellipse cx="20" cy="19" rx="3.5" ry="2.5" fill="#ffffff" opacity="0.8" />
    </>;
    case "camembert": return <>
      <Ellipse cx="22" cy="27" rx="14" ry="10" fill="#f6ecd2" stroke="#c9b27a" strokeWidth="1.5" />
      <Ellipse cx="22" cy="24" rx="14" ry="10" fill="#fbf5e3" stroke="#c9b27a" strokeWidth="1.5" />
      <Path d="M22 24 36 19c1 3 1 6 0 9L22 24Z" fill="#f2e3b8" stroke="#c9b27a" strokeWidth="1.2" />
    </>;
    // -------------------------------------------------------------------- AUTRES
    case "almond": return <>
      <Path d="M18 10c5 2 7 10 4 18-2 6-6 10-9 9-4-1-5-9-2-17 2-6 4-10 7-10Z" fill="#d6ab74" stroke="#9c7440" strokeWidth="1.4" />
      <Path d="M17 14c-1 6-1 13 1 18" fill="none" stroke="#b58c54" strokeWidth="1.2" />
      <Path d="M31 15c4 2 5 9 2 16-2 5-5 8-8 7-3-1-4-8-1-15 2-5 4-8 7-8Z" fill="#e0bb84" stroke="#9c7440" strokeWidth="1.4" />
    </>;
    case "butter": return <>
      <Path d="M9 27 31 20l8 4-22 7-8-4Z" fill="#f2d873" stroke="#c7a23e" strokeWidth="1.5" />
      <Path d="M9 27v4l8 4v-4Z" fill="#e6c457" stroke="#c7a23e" strokeWidth="1.5" />
      <Path d="M17 31v4l22-7v-4Z" fill="#f7e49a" stroke="#c7a23e" strokeWidth="1.5" />
    </>;
    case "chocolate": return <>
      <Rect x="9" y="10" width="30" height="30" rx="3" fill="#70483d" stroke="#4d302e" strokeWidth="1.5" />
      <Line x1="19" y1="12" x2="19" y2="38" stroke="#9a6b56" strokeWidth="2" />
      <Line x1="29" y1="12" x2="29" y2="38" stroke="#9a6b56" strokeWidth="2" />
      <Line x1="11" y1="24" x2="37" y2="24" stroke="#9a6b56" strokeWidth="2" />
    </>;
    case "honey": return <>
      <Rect x="14" y="14" width="20" height="26" rx="5" fill="#e9ba4f" stroke="#a97930" strokeWidth="1.5" />
      <Rect x="12" y="10" width="24" height="6" rx="2" fill="#9a7048" />
      <Path d="M24 23c-4 5-5 7-2 9 2 2 5 1 6-1 1-2-1-4-4-8Z" fill="#fff1b3" />
    </>;
    case "oil": return <>
      <Rect x="20" y="6" width="8" height="7" rx="1" fill="#6f8654" />
      <Path d="M18 13h12l4 7v18c0 2-2 3-4 3H18c-2 0-4-1-4-3V20l4-7Z" fill="#b2ba68" stroke="#687744" strokeWidth="1.5" />
      <Path d="M16 26h16v11H16V26Z" fill="#d5c767" />
    </>;
    case "peanutButter": return <>
      <Path d="M13 19h22v19a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V19Z" fill="#e8d7b0" stroke="#b79b63" strokeWidth="1.5" />
      <Path d="M13 24h22v4H13z" fill="#c79a5a" opacity="0.6" />
      <Rect x="11" y="11" width="26" height="8" rx="2" fill="#b5844a" stroke="#8a6436" strokeWidth="1.2" />
    </>;
    case "walnut": return <>
      <Ellipse cx="24" cy="25" rx="13" ry="14" fill="#c49a62" stroke="#8a6436" strokeWidth="1.5" />
      <Path d="M24 11v28" stroke="#8a6436" strokeWidth="1.3" />
      <Path d="M24 16c-4 2-6 5-6 9s2 7 6 9M24 16c4 2 6 5 6 9s-2 7-6 9" fill="none" stroke="#9c7748" strokeWidth="1.2" />
    </>;
  }
}

export function FoodIcon({ kind, size = 44, boxed = true }: {
  kind: FoodIconKind;
  size?: number;
  boxed?: boolean;
}) {
  return (
    <View
      accessible={false}
      style={{
        width: size, height: size,
        borderRadius: boxed ? size * 0.28 : 0,
        backgroundColor: boxed ? palette[kind] : "transparent",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Svg width={size * (boxed ? 0.76 : 0.95)} height={size * (boxed ? 0.76 : 0.95)} viewBox="0 0 48 48">
        <Illustration kind={kind} />
      </Svg>
    </View>
  );
}
