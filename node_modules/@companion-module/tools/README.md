# @companion-module/tools

This is a collection of tools used for developing and verifying Companion modules.

## Scripts

### companion-module-build

When used, this will build a module ready for distribution.

More information on this command is available [on the wiki](https://github.com/bitfocus/companion-module-base/wiki/Module-packaging).

### companion-generate-manifest

Generate the new format manifest from an old `package.json`.


## Upgrading from v1.x to v2.0

v2.0 of this library includes some breaking changes to how eslint and prettier handled. Instead of it being installed as a dependency and being directly usable by modules, it has to be explicitly installed by modules.

This change was done for two reasons:

1) Very few modules use eslint, making this extra weight for them for no gain.
2) Recent versions of yarn do not expose these binaries in a way which is easily callable by modules, requiring tricks to be able to execute them.

To resolve this, you will need to do a `yarn add --dev eslint prettier` in your modules to install the dependencies, and update any scripts to remove the invocation hacks.

This also allows for eslint to be updated to v9, which requires a new config format. This unfortunately means that your config file needs to be replaced.

A new basic config should be called `eslint.config.mjs` (remove any existing `.eslintrc.json` or `.eslintrc.cjs`) and could contain:

```js
import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default generateEslintConfig({})
```

If using TypeScript, you should specify a `typescriptRoot`:

```js
import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default generateEslintConfig({
    enableTypescript: true,
})
```

You can easily override rules in this setup with:

```js
import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
})

const customConfig = [
	...baseConfig,

	{
		rules: {
			'n/no-missing-import': 'off',
			'node/no-unpublished-import': 'off',
		},
	},
]

export default customConfig
```

More options are available for the `generateEslintConfig` function, check the wiki or the method signature to see what is available.
