module.exports = {
  root: true,
  extends: ['@metamask/eslint-config'],

  overrides: [
    {
      files: ['*.d.ts'],
      rules: {
        'import/unambiguous': 'off',
      },
    },
    {
      files: ['*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
        '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      },
    },
  ],
  ignorePatterns: ['.eslintrc.js', '.prettierrc.js', 'build.js', 'dist/'],
};
