// functions/.eslintrc.js
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    // point to the TS config used to build functions
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript"
  ],
  ignorePatterns: [
    "node_modules/",
    "lib/",
    "generated/",
  ],
  rules: {
    // ergonomic defaults for a functions project
    "quotes": ["error", "double"],
    "indent": ["error", 2],
    "no-console": "off",
    "import/no-unresolved": "off", // TS handles resolution
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-shadow": "off"
  },
  settings: {
    "import/resolver": {
      node: { extensions: [".js", ".ts"] }
    }
  }
};
