// Stage 1 via Claude: one structured-output request that segments the script into grammar beats. Used only by the
// CLI (which records the response to fixtures/plans/<brief>.plan.json); tests replay recordings, never the network.
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type { Brief } from "@engine/graph";
import { normalizeBeats, type Segmenter } from "./segment";
import { BEAT_TYPES } from "./types";

const SCHEMA = {
  type: "object",
  properties: {
    beats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: [...BEAT_TYPES] },
          text: { type: "string" },
          emphasis: { type: "array", items: { type: "string" } },
          featureRef: { type: "string" },
          assetRef: { type: "string" },
          durationHint: { type: "number" },
        },
        required: ["id", "type", "text", "emphasis"],
        additionalProperties: false,
      },
    },
  },
  required: ["beats"],
  additionalProperties: false,
} as const;

const SYSTEM = `You segment a SaaS explainer video script into beats for a motion-graphics engine.
Beat grammar, in order: hook -> problem -> reveal -> feature (one per product capability, repeatable) -> proof -> cta -> tag.
- hook: the opening question or claim. problem: the pain before the product. reveal: the product is named or introduced.
- feature: one capability per beat; set featureRef to the exact name of the product feature it shows.
- proof: a number, metric or comparison. cta: the call to action. tag: the closing tagline.
Rules: one idea per beat — a sentence with two claims becomes two beats; keep the script's own words (light trimming
only); beats follow the grammar order; emphasis lists the words from the beat's text to highlight (names, numbers,
the key noun), copied verbatim; assetRef names a provided asset id when a beat should show it; durationHint (seconds)
only when the script implies a pause or a long moment. Ids are b1, b2, ...`;

export function llmSegmenter(opts: { apiKey: string; model: string; workspaceId?: string }): Segmenter {
  const client = new Anthropic({ apiKey: opts.apiKey, ...(opts.workspaceId ? { defaultHeaders: { "anthropic-workspace-id": opts.workspaceId } } : {}) });
  return {
    name: `llm:${opts.model}`,
    async segment(brief: Brief) {
      const content = JSON.stringify({
        script: brief.script,
        product: { name: brief.product.name, tagline: brief.product.tagline, features: brief.product.features.map((f) => ({ name: f.name, blurb: f.blurb, kind: f.kind })) },
        assets: brief.assets,
      }, null, 2);
      const response = await client.beta.messages.parse({
        model: opts.model,
        max_tokens: 16000,
        // refusal fallback: let the API retry a declined request on its recommended model
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        messages: [{ role: "user", content: `Segment this brief into beats:\n\n${content}` }],
        output_config: { format: jsonSchemaOutputFormat(SCHEMA) },
      });
      if (response.stop_reason === "refusal") throw new Error(`segmentation refused (${response.stop_details?.category ?? "no category"})`);
      if (response.stop_reason === "max_tokens") throw new Error("segmentation hit max_tokens");
      const parsed = response.parsed_output;
      if (!parsed) throw new Error("segmentation returned no parsable output");
      return normalizeBeats(parsed.beats, brief);
    },
  };
}
