export const kit = {
  manifest: { id: "mock-kit" },
  services: {
    describe: () => ({ id: "mock-kit" }),
    generate: ({ seed, params }) => ({ seed, params, marker: "generated" }),
    reroll: ({ seed, params }) => ({ seed: `${seed}:next`, artifact: { seed: `${seed}:next`, params } }),
    validate: (artifact) => ({ valid: artifact.marker === "generated" }),
    export: (_artifact, format) => format
  }
};
