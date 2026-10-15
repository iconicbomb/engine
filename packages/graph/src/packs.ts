// Style pack registry: the measured looks under packages/graph/packs/*.json, validated once at load. Selected by
// graph.style.pack; the runtime resolves field / surfaces / type defaults from the pack (graph values win).
import { StylePack } from "./stylepack";
import darkNeon from "../packs/dark-neon.json";
import lightBlueprint from "../packs/light-blueprint.json";
import warmEditorial from "../packs/warm-editorial.json";
import typographicBw from "../packs/typographic-bw.json";
import glassBrand from "../packs/glass-brand.json";

export const STYLE_PACKS: Record<string, StylePack> = Object.fromEntries(
  [darkNeon, lightBlueprint, warmEditorial, typographicBw, glassBrand].map((p) => { const v = StylePack.parse(p); return [v.name, v]; }),
);
export const STYLE_PACK_NAMES = Object.keys(STYLE_PACKS);
export function stylePack(name: string | undefined): StylePack | undefined { return name ? STYLE_PACKS[name] : undefined; }
