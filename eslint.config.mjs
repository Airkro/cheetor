import config from '@nice-move/all-in-base/eslint';

export default [
  ...config,
  {
    files: ['src/**/*.mts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
