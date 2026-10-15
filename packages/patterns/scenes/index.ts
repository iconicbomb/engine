// Every generated fixture: fixtures/<name>.graph.json is exactly SCENES[name]() serialised.
import { buildR3Hook } from "./r3-hook";
import { buildS15Demo, buildT13Demo, buildT2Demo, buildT4Demo, buildT6Demo } from "./macro-demos";

export const SCENES: Record<string, () => unknown> = {
  "r3-hook": buildR3Hook,
  "s15-ambient-glow": buildS15Demo,
  "t2-tail-typewriter": buildT2Demo,
  "t4-word-append": buildT4Demo,
  "t6-colour-sweep": buildT6Demo,
  "t13-logo-typewriter": buildT13Demo,
};
