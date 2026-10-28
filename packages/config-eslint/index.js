/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  env: { es2022: true, node: true },
  ignorePatterns: ['dist/', '.next/', 'node_modules/', 'coverage/'],
  rules: {},
};
