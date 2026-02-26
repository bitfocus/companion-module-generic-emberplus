import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
})

const customConfig = [
	...baseConfig,

	{
		rules: {
			'@typescript-eslint/no-unsafe-enum-comparison': 'off',
			// misconfiguration of ts or something?
			'n/no-missing-import': 'off',
			'n/no-unpublished-import': 'off',
		},
	},
	{
		files: ['vitest.config.ts', '**/*.test.ts', '**/*.spec.ts'],
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.json', './tsconfig.node.json'],
			},
		},
		rules: {
			'n/no-unpublished-import': 'off',
			'@typescript-eslint/unbound-method': 'off',
		},
	},
]

export default customConfig
