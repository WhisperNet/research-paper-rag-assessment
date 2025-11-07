module.exports = {
  root: true,
  ignorePatterns: ['dist', 'node_modules'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: { es2022: true, node: true },
  overrides: [
    {
      files: ['src/api/**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
      rules: {},
    },
  ],
};
