import { View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from "react-native-svg";
import type { FoodIconKind } from "./food-icon-kind";

const palette: Record<FoodIconKind, string> = {
  bowl: "#f7ebd5", bread: "#f7ebd5", pasta: "#f7ebd5", potato: "#f7ebd5",
  meat: "#f9e6e1", fish: "#ddf1ee", egg: "#fbf1d6",
  milk: "#e5eff8", yogurt: "#e5eff8", cheese: "#fbf1d6",
  apple: "#fae7e3", banana: "#fbf1d6", fruit: "#fae7e3",
  carrot: "#fbeadb", leaf: "#e3f1e7", mushroom: "#f3e8df",
  nut: "#f4eadb", oil: "#e9efdc", chocolate: "#eee4df", honey: "#fbefd8",
};

function Illustration({ kind }: { kind: FoodIconKind }) {
  switch (kind) {
    case "bowl": return <>
      <Path d="M8 22h32c-1 11-7 17-16 17S9 33 8 22Z" fill="#d4a365" stroke="#805b37" strokeWidth="1.5" />
      <Ellipse cx="24" cy="22" rx="16" ry="5" fill="#fff8e8" stroke="#805b37" strokeWidth="1.5" />
      <Circle cx="17" cy="20" r="1.4" fill="#bd9553" /><Circle cx="25" cy="19" r="1.4" fill="#bd9553" /><Circle cx="32" cy="21" r="1.4" fill="#bd9553" />
    </>;
    case "bread": return <>
      <Path d="M10 19c-2-8 3-13 9-11 3-2 8-2 11 0 7-1 11 5 8 11v20H10V19Z" fill="#bd8150" stroke="#805333" strokeWidth="1.5" />
      <Path d="M14 20c-2-6 1-9 6-8 3-2 6-2 9 0 5-1 8 3 6 8v16H14V20Z" fill="#f7dfad" />
    </>;
    case "pasta": return <>
      <Path d="M10 26h28c-1 8-6 13-14 13s-13-5-14-13Z" fill="#c98256" stroke="#81583e" strokeWidth="1.5" />
      <Ellipse cx="24" cy="26" rx="14" ry="4" fill="#fff4d2" stroke="#81583e" strokeWidth="1.5" />
      <Path d="M14 23c4-8 6 5 10-4s6 6 10-2" fill="none" stroke="#db9f30" strokeWidth="3" strokeLinecap="round" />
    </>;
    case "potato": return <>
      <Ellipse cx="24" cy="25" rx="17" ry="12" fill="#c99b62" stroke="#8a623c" strokeWidth="1.5" />
      <Circle cx="16" cy="22" r="1.4" fill="#8a623c" /><Circle cx="28" cy="18" r="1.2" fill="#8a623c" /><Circle cx="30" cy="29" r="1.3" fill="#8a623c" />
    </>;
    case "meat": return <>
      <Path d="M10 17c5-8 18-10 26-2 6 7 3 16-5 21-9 5-21 1-25-7-2-5 0-9 4-12Z" fill="#c76556" stroke="#8a3d39" strokeWidth="1.6" />
      <Path d="M15 19c4-4 13-6 18-1" fill="none" stroke="#edaa9b" strokeWidth="2" strokeLinecap="round" />
      <Ellipse cx="25" cy="27" rx="5" ry="3.4" fill="#f9dfcd" />
    </>;
    case "fish": return <>
      <Polygon points="8,24 4,14 4,34" fill="#4f9f9a" stroke="#286d70" strokeWidth="1.5" />
      <Ellipse cx="26" cy="24" rx="17" ry="11" fill="#73b8ae" stroke="#286d70" strokeWidth="1.5" />
      <Circle cx="34" cy="21" r="1.8" fill="#21474a" />
      <Path d="M16 18c3 4 3 8 0 12M22 16c3 5 3 11 0 16" fill="none" stroke="#cce6df" strokeWidth="1.5" />
    </>;
    case "egg": return <>
      <Ellipse cx="24" cy="25" rx="17" ry="13" fill="#fffdf7" stroke="#b6aa91" strokeWidth="1.6" />
      <Circle cx="24" cy="25" r="8" fill="#efbd4b" stroke="#c78c30" strokeWidth="1" />
    </>;
    case "milk": return <>
      <Path d="M14 15h20v26H14V15Z" fill="#fdfefe" stroke="#5a86a3" strokeWidth="1.5" />
      <Path d="M14 15l5-7h10l5 7H14Z" fill="#a8c9e1" stroke="#5a86a3" strokeWidth="1.5" />
      <Path d="M18 27c3-3 9 3 12 0v9H18v-9Z" fill="#a8c9e1" />
    </>;
    case "yogurt": return <>
      <Path d="M11 16h26l-3 24H14l-3-24Z" fill="#fdfefe" stroke="#6487a0" strokeWidth="1.5" />
      <Rect x="9" y="12" width="30" height="5" rx="2" fill="#7fb2cc" stroke="#6487a0" strokeWidth="1" />
      <Path d="M15 25c6-4 12 4 18 0l-1 10H16l-1-10Z" fill="#a8cfe0" />
    </>;
    case "cheese": return <>
      <Path d="M7 32 38 12l3 25H7v-5Z" fill="#f3c65a" stroke="#ad7c2b" strokeWidth="1.5" />
      <Path d="M7 32h34v5H7v-5Z" fill="#dfaa3d" />
      <Circle cx="31" cy="28" r="2.4" fill="#d99d35" /><Circle cx="23" cy="32" r="1.6" fill="#d99d35" />
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
    case "fruit": return <>
      <Circle cx="24" cy="25" r="15" fill="#eb9370" stroke="#b85f4c" strokeWidth="1.5" />
      <Path d="M24 11c0-4 2-6 5-7" fill="none" stroke="#715444" strokeWidth="2" strokeLinecap="round" />
      <Path d="M27 11c4-5 9-4 11-2-3 4-7 5-11 2Z" fill="#68a273" />
      <Path d="M16 20c2-3 4-4 7-4" fill="none" stroke="#ffd2b7" strokeWidth="2" strokeLinecap="round" />
    </>;
    case "carrot": return <>
      <Path d="M22 13 35 19 17 41 13 38 22 13Z" fill="#ee9a48" stroke="#b76b35" strokeWidth="1.5" />
      <Path d="M22 14c-6-5-8-9-6-10 4 0 7 3 9 9M24 14c1-6 4-9 7-9 2 3 0 7-4 11" fill="#66a06d" stroke="#49835d" strokeWidth="1.2" />
      <Line x1="20" y1="25" x2="27" y2="28" stroke="#d47c3b" strokeWidth="1.5" />
    </>;
    case "leaf": return <>
      <Path d="M9 32c0-15 13-23 30-21 2 17-7 29-22 29-5 0-8-3-8-8Z" fill="#77b488" stroke="#3b8060" strokeWidth="1.5" />
      <Path d="M10 40c8-13 17-19 27-25" fill="none" stroke="#3b8060" strokeWidth="2" strokeLinecap="round" />
      <Path d="M18 28l-3-9M27 21l-1-8" fill="none" stroke="#a5d5ac" strokeWidth="1.5" />
    </>;
    case "mushroom": return <>
      <Path d="M20 24h8v15h-8V24Z" fill="#f8e8d1" stroke="#8f725d" strokeWidth="1.5" />
      <Path d="M8 25c1-11 8-17 16-17s15 6 16 17H8Z" fill="#ba8064" stroke="#875d4c" strokeWidth="1.5" />
      <Circle cx="18" cy="17" r="2" fill="#f8dec9" /><Circle cx="29" cy="14" r="2.5" fill="#f8dec9" />
    </>;
    case "nut": return <>
      <Ellipse cx="19" cy="25" rx="8" ry="13" transform="rotate(-23 19 25)" fill="#b98754" stroke="#815b3c" strokeWidth="1.5" />
      <Ellipse cx="29" cy="25" rx="8" ry="13" transform="rotate(23 29 25)" fill="#c99965" stroke="#815b3c" strokeWidth="1.5" />
      <Path d="M19 17c-2 6-2 12 1 16M29 17c2 6 2 12-1 16" fill="none" stroke="#e4bc86" strokeWidth="1.5" />
    </>;
    case "oil": return <>
      <Rect x="20" y="6" width="8" height="7" rx="1" fill="#6f8654" />
      <Path d="M18 13h12l4 7v18c0 2-2 3-4 3H18c-2 0-4-1-4-3V20l4-7Z" fill="#b2ba68" stroke="#687744" strokeWidth="1.5" />
      <Path d="M16 26h16v11H16V26Z" fill="#d5c767" />
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
