'use strict';

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        Intl: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-empty': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'complexity': ['error', 10],
      'max-lines-per-function': ['error', 50],
      'max-params': ['error', 4]
    }
  },
  {
    files: ['core.js'],
    rules: {
      'max-lines-per-function': 'off',
      'no-unused-vars': 'error',
      'prefer-const': 'error',
      'max-len': ['error', { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true }],
      curly: ['error', 'all'],
      'max-statements-per-line': ['error', { max: 1 }],
      complexity: ['error', 12],
      'no-else-return': 'error'
    },
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        globalThis: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        Intl: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    }
  },
  {
    files: ['app.js'],
    rules: {
      'max-lines-per-function': 'off',
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'max-len': ['error', { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true }],
      curly: ['error', 'all'],
      'max-statements-per-line': ['error', { max: 1 }],
      complexity: ['error', 12],
      'no-else-return': 'error',
      'prefer-const': 'error'
    },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        history: 'readonly',
        HTMLDialogElement: 'readonly',
        Intl: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        globalThis: 'readonly'
      }
    }
  },
  {
    files: ['test/**', 'server.js'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
        globalThis: 'readonly'
      }
    }
  },
  {
    files: ['server.js'],
    rules: {
      'max-len': ['error', { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true }],
      curly: ['error', 'all'],
      'max-statements-per-line': ['error', { max: 1 }],
      complexity: ['error', 12],
      'no-else-return': 'error',
      'prefer-const': 'error'
    }
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly'
      }
    }
  }
];
