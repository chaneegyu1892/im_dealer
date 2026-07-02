import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const coreWebVitalsWithHookRules = nextCoreWebVitals.map((config) => {
  if (!config.plugins?.["react-hooks"]) return config;
  return {
    ...config,
    rules: {
      ...config.rules,
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
    },
  };
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "output/**",
      "playwright-report/**",
      ".omo/**",
      "build/**",
      "next-env.d.ts",
      "scratch/**",
      "src/app/(admin)/admin/inventory/generate-mock.ts",
    ],
  },
  ...coreWebVitalsWithHookRules,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
