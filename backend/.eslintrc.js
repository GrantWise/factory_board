module.exports = {
  env: {
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    // Enforce consistent indentation
    'indent': ['error', 2],
    
    // Enforce consistent line endings
    'linebreak-style': ['error', 'unix'],
    
    // Enforce consistent quote style
    'quotes': ['error', 'single'],
    
    // Require semicolons
    'semi': ['error', 'always'],
    
    // Warn about unused variables but allow them in function parameters
    'no-unused-vars': ['warn', { 'args': 'none' }],
    
    // Warn about console.log statements
    'no-console': 'warn',
    
    // Enforce consistent spacing
    'space-before-blocks': 'error',
    'keyword-spacing': 'error',
    
    // Disallow trailing whitespace
    'no-trailing-spaces': 'error',
    
    // Require const for variables that are never reassigned
    'prefer-const': 'error',
    
    // Disallow variable declarations from shadowing variables declared in the outer scope
    'no-shadow': 'error',
    
    // Require braces around arrow function bodies when needed
    'arrow-body-style': ['error', 'as-needed'],
    
    // Enforce consistent brace style
    'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
    
    // Enforce consistent comma style
    'comma-dangle': ['error', 'never'],
    
    // Enforce dot notation when possible
    'dot-notation': 'error',
    
    // Disallow unnecessary parentheses
    'no-extra-parens': ['error', 'all', { 'ignoreJSX': 'all' }]
  }
};