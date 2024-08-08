'use strict'

const globals = require('globals')
const js = require('@eslint/js')
const prettier = require('eslint-plugin-prettier/recommended')

module.exports = [
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  js.configs.recommended,
  prettier,
]
