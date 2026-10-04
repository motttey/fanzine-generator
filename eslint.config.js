import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import prettier from 'eslint-config-prettier/flat'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { ignores: ['dist/**', '.vscode/**'] },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['src/**/*.vue'],
    languageOptions: { parserOptions: { parser: tsParser } },
  },
  {
    files: ['src/lib/**/*.ts'],
    languageOptions: { parser: tsParser, globals: globals.browser },
  },
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
  prettier,
]
