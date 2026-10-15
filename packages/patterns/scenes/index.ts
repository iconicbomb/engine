// Every generated fixture: fixtures/<name>.graph.json is exactly SCENES[name]() serialised.
import { buildR3Hook } from "./r3-hook";
import { buildCursorHover, buildS3Demo, buildS4Demo, buildS5Demo } from "./cursor-hover";
import { buildS15Demo, buildS1Demo, buildS2Demo, buildS6Demo, buildS9Demo, buildT10Demo, buildT11Demo, buildT13Demo, buildT2Demo, buildT4Demo, buildT6Demo } from "./macro-demos";

export const SCENES: Record<string, () => unknown> = {
  "r3-hook": buildR3Hook,
  "cursor-hover": buildCursorHover,
  "s1-card-rise": buildS1Demo,
  "s2-ripple-pill": buildS2Demo,
  "s3-hover-fill-card": buildS3Demo,
  "s4-jump-cut": buildS4Demo,
  "s5-cursor-click": buildS5Demo,
  "s6-ticker-list": buildS6Demo,
  "s9-pill-marquee": buildS9Demo,
  "s15-ambient-glow": buildS15Demo,
  "t2-tail-typewriter": buildT2Demo,
  "t4-word-append": buildT4Demo,
  "t6-colour-sweep": buildT6Demo,
  "t10-echo-trail": buildT10Demo,
  "t11-tracking-contraction": buildT11Demo,
  "t13-logo-typewriter": buildT13Demo,
};
