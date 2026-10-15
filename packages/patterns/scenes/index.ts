// Every generated fixture: fixtures/<name>.graph.json is exactly SCENES[name]() serialised.
import { buildR3Hook } from "./r3-hook";
import { buildCursorHover, buildS10Demo, buildS3Demo, buildS4Demo, buildS5Demo } from "./cursor-hover";
import { buildImageSlotsDemo, buildLayoutDemo, buildPathsWiresDemo, buildRetargetDemo, buildTransitionsDemo, buildS11Demo, buildS12Demo, buildS13Demo, buildS14Demo, buildS15Demo, buildS16Demo, buildS1Demo, buildS2Demo, buildS6Demo, buildS7Demo, buildS8Demo, buildS9Demo, buildT10Demo, buildT11Demo, buildT13Demo, buildT2Demo, buildT4Demo, buildT6Demo } from "./macro-demos";

export const SCENES: Record<string, () => unknown> = {
  "r3-hook": buildR3Hook,
  "cursor-hover": buildCursorHover,
  "image-slots": buildImageSlotsDemo,
  "layout-row-column": buildLayoutDemo,
  "paths-wires": buildPathsWiresDemo,
  "retarget-velocity": buildRetargetDemo,
  "s1-card-rise": buildS1Demo,
  "s2-ripple-pill": buildS2Demo,
  "s3-hover-fill-card": buildS3Demo,
  "s4-jump-cut": buildS4Demo,
  "s5-cursor-click": buildS5Demo,
  "s6-ticker-list": buildS6Demo,
  "s7-collapse-to-orbs": buildS7Demo,
  "s8-wire-fan": buildS8Demo,
  "s9-pill-marquee": buildS9Demo,
  "s10-tilted-plane": buildS10Demo,
  "s11-slab-numeral": buildS11Demo,
  "s12-stroke-morph": buildS12Demo,
  "s13-curtain-wipe": buildS13Demo,
  "s14-smear-cut": buildS14Demo,
  "s15-ambient-glow": buildS15Demo,
  "s16-mascot": buildS16Demo,
  "t2-tail-typewriter": buildT2Demo,
  "transitions": buildTransitionsDemo,
  "t4-word-append": buildT4Demo,
  "t6-colour-sweep": buildT6Demo,
  "t10-echo-trail": buildT10Demo,
  "t11-tracking-contraction": buildT11Demo,
  "t13-logo-typewriter": buildT13Demo,
};
