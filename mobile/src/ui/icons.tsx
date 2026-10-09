import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "./theme";

type IconProps = { size?: number; color?: string; strokeWidth?: number };

/** Icônes au trait arrondi, dessinées pour l'application (pas de police d'icônes). */
function Icon({
  size = 24,
  color = colors.ink,
  strokeWidth = 2,
  children,
}: IconProps & { children: (stroke: { stroke: string; strokeWidth: number }) => React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children({ stroke: color, strokeWidth })}
    </Svg>
  );
}

const line = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ChevronLeft = (p: IconProps) => (
  <Icon {...p}>{(st) => <Path d="M15 5l-7 7 7 7" {...st} {...line} />}</Icon>
);

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>{(st) => <Path d="M9 5l7 7-7 7" {...st} {...line} />}</Icon>
);

export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>{(st) => <Path d="M5 9l7 7 7-7" {...st} {...line} />}</Icon>
);

/** Balance : onglet « Suivi ». */
export const ScaleIcon = (p: IconProps) => (
  <Icon {...p}>
    {(st) => (
      <>
        <Rect x={3.5} y={3.5} width={17} height={17} rx={5} {...st} />
        <Path d="M8.5 9.5a4.5 4.5 0 0 1 7 0" {...st} {...line} />
        <Path d="M12 9.5l1.4-1.6" {...st} {...line} />
      </>
    )}
  </Icon>
);

/** Bol : onglet « Journal ». */
export const BowlIcon = (p: IconProps) => (
  <Icon {...p}>
    {(st) => (
      <>
        <Path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z" {...st} {...line} />
        <Path d="M9 7.5c0-1.5 1-2 1-3.5M13.5 7.5c0-1.5 1-2 1-3.5" {...st} {...line} />
      </>
    )}
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    {(st) => (
      <>
        <Circle cx={12} cy={8.5} r={4} {...st} />
        <Path d="M4.5 20a7.5 7.5 0 0 1 15 0" {...st} {...line} />
      </>
    )}
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    {(st) => (
      <>
        <Circle cx={9} cy={9} r={3.5} {...st} />
        <Path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" {...st} {...line} />
        <Path d="M15.5 5.8a3.5 3.5 0 0 1 0 6.4M18 19.5a6.5 6.5 0 0 0-2.4-5" {...st} {...line} />
      </>
    )}
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>{(st) => <Path d="M12 5v14M5 12h14" {...st} {...line} />}</Icon>
);

export const KeyIcon = (p: IconProps) => (
  <Icon {...p}>
    {(st) => (
      <>
        <Circle cx={8} cy={12} r={4} {...st} />
        <Path d="M12 12h8.5M17.5 12v3M20.5 12v2" {...st} {...line} />
      </>
    )}
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    {(st) => (
      <>
        <Circle cx={11} cy={11} r={6.5} {...st} />
        <Path d="M16 16l4 4" {...st} {...line} />
      </>
    )}
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>{(st) => <Path d="M6 6l12 12M18 6L6 18" {...st} {...line} />}</Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>{(st) => <Path d="M5 12h14" {...st} {...line} />}</Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>{(st) => <Path d="M5 12.5l4.5 4.5L19 7.5" {...st} {...line} />}</Icon>
);

/** Étoile des favoris : pleine quand l'aliment est en favori. */
export const StarIcon = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24">
    <Path
      d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
      fill={filled ? (p.color ?? colors.ink) : "none"}
      stroke={p.color ?? colors.ink}
      strokeWidth={p.strokeWidth ?? 1.8}
      strokeLinejoin="round"
    />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    {(st) => (
      <>
        <Circle cx={12} cy={12} r={8} {...st} />
        <Path d="M12 7.5V12l3 2" {...st} {...line} />
      </>
    )}
  </Icon>
);

/** Porte et flèche sortante : déconnexion. */
export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    {(st) => (
      <>
        <Path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" {...st} {...line} />
        <Path d="M14 8l4 4-4 4M18 12H9.5" {...st} {...line} />
      </>
    )}
  </Icon>
);

/** Cible : onglet « Plan ». */
export const TargetIcon = (p: IconProps) => (
  <Icon {...p}>
    {(st) => (
      <>
        <Circle cx={12} cy={12} r={8} {...st} />
        <Circle cx={12} cy={12} r={4} {...st} />
        <Circle cx={12} cy={12} r={0.8} {...st} />
      </>
    )}
  </Icon>
);
