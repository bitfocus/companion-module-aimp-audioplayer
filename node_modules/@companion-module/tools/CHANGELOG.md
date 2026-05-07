# Changelog

## [3.0.1](https://github.com/bitfocus/companion-module-tools/compare/v3.0.0...v3.0.1) (2026-04-06)


### Bug Fixes

* ts6 support ([f465aac](https://github.com/bitfocus/companion-module-tools/commit/f465aac35e79d8cdee0f846a7d005c23d2aaf3e1))

## [3.0.0](https://github.com/bitfocus/companion-module-tools/compare/v2.7.1...v3.0.0) (2026-03-03)


### ⚠ BREAKING CHANGES

* simplify and remove support for module api v1
* require node22 and module-base 2.0

### Features

* Add type declarations for `@companion-module/tools/eslint/config.mjs` by converting the repository code to TypeScript. ([f4220e8](https://github.com/bitfocus/companion-module-tools/commit/f4220e8c0ec8a3418d68483fbd562bfb2d767a12))
* replace webpack with esbuild ([395d28d](https://github.com/bitfocus/companion-module-tools/commit/395d28d39c7b31e4ca28cc8e0468c14e4733952e))
* require node22 and module-base 2.0 ([bb3fadc](https://github.com/bitfocus/companion-module-tools/commit/bb3fadc9474cdbd77e4ade34e4f8964de1e17db3))
* simplify and remove support for module api v1 ([6648b13](https://github.com/bitfocus/companion-module-tools/commit/6648b132a1af12e0fe0d0e300b5bc4bfee201f45))

## [2.7.1](https://github.com/bitfocus/companion-module-tools/compare/v2.7.0...v2.7.1) (2026-02-22)


### Bug Fixes

* allow prerelease versions ([1edc0f6](https://github.com/bitfocus/companion-module-tools/commit/1edc0f6a12c3db1aaf0fc00919dc9ae0fed7a914))

## [2.7.0](https://github.com/bitfocus/companion-module-tools/compare/v2.6.1...v2.7.0) (2026-02-22)


### Features

* support module-api 2.0 ([034bbf2](https://github.com/bitfocus/companion-module-tools/commit/034bbf2da1ce34c6499819146d7be71b5233d230))


### Bug Fixes

* refuse to run if yarn pnp is enabled ([91593ba](https://github.com/bitfocus/companion-module-tools/commit/91593bad3e6464e658748a67af2d5caf94b2e405))
* restrict the allowed versions of api libraries this will build ([bcbeb87](https://github.com/bitfocus/companion-module-tools/commit/bcbeb87b9018146cff0deb9a4411050d63402ec4))

## [2.6.1](https://github.com/bitfocus/companion-module-tools/compare/v2.6.0...v2.6.1) (2026-01-29)


### Bug Fixes

* downgrade find-up for nodejs 18 suppport ([2c35333](https://github.com/bitfocus/companion-module-tools/commit/2c35333b067c30b80e54c9c91e4d3a497dad67b5))

## [2.6.0](https://github.com/bitfocus/companion-module-tools/compare/v2.5.0...v2.6.0) (2026-01-28)


### Features

* add `@companion-module/tools/tsconfig/node22/recommended-esm` tsconfig ([3fec18c](https://github.com/bitfocus/companion-module-tools/commit/3fec18c8db8c38c9246b36d458aa59d56f49c108))

## [2.5.0](https://github.com/bitfocus/companion-module-tools/compare/v2.4.2...v2.5.0) (2025-12-15)


### Features

* add support for building surface modules ([55721fe](https://github.com/bitfocus/companion-module-tools/commit/55721fe9282128485021385065b17d32439167d8))


### Bug Fixes

* surface module build ([36bfae9](https://github.com/bitfocus/companion-module-tools/commit/36bfae9cfbbafc00ed81dd6f1082bedbe02e2e89))

## [2.4.2](https://github.com/bitfocus/companion-module-tools/compare/v2.4.1...v2.4.2) (2025-10-18)


### Bug Fixes

* prune some unnecessary native prebuilt binaries from packages ([f943056](https://github.com/bitfocus/companion-module-tools/commit/f943056f8175c6a8f1619725d5f55e32991064f5))

## [2.4.1](https://github.com/bitfocus/companion-module-tools/compare/v2.4.0...v2.4.1) (2025-09-28)


### Bug Fixes

* update release-please and provenance generation ([15a5393](https://github.com/bitfocus/companion-module-tools/commit/15a539300373fd0e26a0eb7c3b2b500e5c90a4b4))

## [2.4.0](https://github.com/bitfocus/companion-module-tools/compare/v2.3.0...v2.4.0) (2025-09-04)


### Features

* update dependencies ([676e87b](https://github.com/bitfocus/companion-module-tools/commit/676e87ba08140c19c0e344ed13f50e07c347f0c3))

## [2.3.0](https://github.com/bitfocus/companion-module-tools/compare/v2.2.3...v2.3.0) (2025-04-12)


### Features

* Allow additional rules to be provided to the eslint config generator ([#48](https://github.com/bitfocus/companion-module-tools/issues/48)) ([6fb9125](https://github.com/bitfocus/companion-module-tools/commit/6fb9125b1097b598d4b1ba552890034a44c45235))

## [2.2.3](https://github.com/bitfocus/companion-module-tools/compare/v2.2.2...v2.2.3) (2025-04-12)


### Bug Fixes

* sanitise output filename ([cb07027](https://github.com/bitfocus/companion-module-tools/commit/cb0702738632da68ccd651f96f72ff038c30f3a1))

## [2.2.2](https://github.com/bitfocus/companion-module-tools/compare/v2.2.1...v2.2.2) (2025-03-09)


### Bug Fixes

* package always being created with old filename ([412014c](https://github.com/bitfocus/companion-module-tools/commit/412014c4c34d591b42ba49ddadbec8a2ef2dab80))

## [2.2.1](https://github.com/bitfocus/companion-module-tools/compare/v2.2.0...v2.2.1) (2025-03-06)


### Bug Fixes

* incorrect isPrerelease capitalisation ([b3399d3](https://github.com/bitfocus/companion-module-tools/commit/b3399d36ea04d65e65774e019d7f03af152f6107))

## [2.2.0](https://github.com/bitfocus/companion-module-tools/compare/v2.1.1...v2.2.0) (2025-03-06)


### Features

* add --prerelease flag ([de5cf7d](https://github.com/bitfocus/companion-module-tools/commit/de5cf7d29c81fd8695773b38dcb560a814d311af))
* changed default output of build script to ${package}-${version}.tgz. Added flag -l keeping the legacy behaviour with fileoutput pkg.tgz ([#57](https://github.com/bitfocus/companion-module-tools/issues/57)) ([260a0ff](https://github.com/bitfocus/companion-module-tools/commit/260a0ff61c66611821fc66a5dfbd45c44ec08de6))
* user definable build filename ([199a9bd](https://github.com/bitfocus/companion-module-tools/commit/199a9bd11c01d0b0e6c8007ca951cc00591b9fad))

## [2.1.1](https://github.com/bitfocus/companion-module-tools/compare/v2.1.0...v2.1.1) (2024-12-17)


### Bug Fixes

* add tsconfig for node22 ([8e0a7b1](https://github.com/bitfocus/companion-module-tools/commit/8e0a7b1d29e5f17d7df18d20f487c452797b7d38))

## [2.1.0](https://github.com/bitfocus/companion-module-tools/compare/v2.0.4...v2.1.0) (2024-09-23)


### Features

* allow using node22 ([a9bbbaf](https://github.com/bitfocus/companion-module-tools/commit/a9bbbaf84dcf518c5a69ca44f33ca76f63b64a35))

## [2.0.4](https://github.com/bitfocus/companion-module-tools/compare/v2.0.3...v2.0.4) (2024-09-16)


### Bug Fixes

* ensure mjs files are interpreted as esm ([bf0fceb](https://github.com/bitfocus/companion-module-tools/commit/bf0fceb569bd1e193ebe23f95fb27110fb0d3391))

## [2.0.3](https://github.com/bitfocus/companion-module-tools/compare/v2.0.2...v2.0.3) (2024-09-11)


### Bug Fixes

* update `zx` and another try at `webpack` invocation on windows ([8973b61](https://github.com/bitfocus/companion-module-tools/commit/8973b613f4ae1fd07eaae88a8c9b3e963fd7f62b))

## [2.0.2](https://github.com/bitfocus/companion-module-tools/compare/v2.0.1...v2.0.2) (2024-09-08)


### Bug Fixes

* build script bad webpack path for some projects ([a35529b](https://github.com/bitfocus/companion-module-tools/commit/a35529b042ff0a93dc281da2a85ef77ff002b503))

## [2.0.1](https://github.com/bitfocus/companion-module-tools/compare/v2.0.0...v2.0.1) (2024-09-08)


### Bug Fixes

* avoid `yarn` calls inside build script ([d8086c0](https://github.com/bitfocus/companion-module-tools/commit/d8086c0dda9907a387a3eb57690077f0af4459da))

## [2.0.0](https://github.com/bitfocus/companion-module-tools/compare/v1.5.1...v2.0.0) (2024-08-25)


### ⚠ BREAKING CHANGES

* remove eslint and prettier as dependencies, modules should install these directly ([#43](https://github.com/bitfocus/companion-module-tools/issues/43))

### Features

* remove eslint and prettier as dependencies, modules should install these directly ([#43](https://github.com/bitfocus/companion-module-tools/issues/43)) ([45615fc](https://github.com/bitfocus/companion-module-tools/commit/45615fc3d5448d32ea37b9023e9476ca4893c407))

## [1.5.1](https://github.com/bitfocus/companion-module-tools/compare/v1.5.0...v1.5.1) (2024-06-20)


### Bug Fixes

* don't expand `extraFiles` directories when copying ([6ad1d43](https://github.com/bitfocus/companion-module-tools/commit/6ad1d43f6a83fa44ea2014fbe357f0ab1687ea0f))

## [1.5.0](https://github.com/bitfocus/companion-module-tools/compare/v1.4.4...v1.5.0) (2024-02-08)


### Features

* add option to force node-gyp to not be included in the build package ([838bb52](https://github.com/bitfocus/companion-module-tools/commit/838bb52c7c885adec12d8cf240a2b0e6955c6280))

## [1.4.4](https://github.com/bitfocus/companion-module-tools/compare/v1.4.3...v1.4.4) (2024-02-08)


### Bug Fixes

* yarn install failing due to `CI=1` ([076bc54](https://github.com/bitfocus/companion-module-tools/commit/076bc54a2031dfce414941007f60d6d100a129ec))

## [1.4.3](https://github.com/bitfocus/companion-module-tools/compare/v1.4.2...v1.4.3) (2024-02-08)


### Bug Fixes

* touch lockfile before running `yarn install` in package. ([c502dd7](https://github.com/bitfocus/companion-module-tools/commit/c502dd7a4bc2e2156ebd6a339554fbfbb1ded83c))

## [1.4.2](https://github.com/bitfocus/companion-module-tools/compare/v1.4.1...v1.4.2) (2023-12-27)


### Bug Fixes

* use name from package.json when building externals dependencies object ([339d2ac](https://github.com/bitfocus/companion-module-tools/commit/339d2acd6cd5d8a770766214d0687a7c9fd05196))

## [1.4.1](https://github.com/bitfocus/companion-module-tools/compare/v1.4.0...v1.4.1) (2023-09-11)


### Bug Fixes

* support for yarn3 ([6ab2458](https://github.com/bitfocus/companion-module-tools/commit/6ab2458c6148da0b1a305e377408b4cb64399dce))

## [1.4.0](https://github.com/bitfocus/companion-module-tools/compare/v1.3.2...v1.4.0) (2023-08-22)


### Features

* add option to disable minification. ([9f626f6](https://github.com/bitfocus/companion-module-tools/commit/9f626f69b82b9dc10b195ed076e01f794246f85b))

## [1.3.2](https://github.com/bitfocus/companion-module-tools/compare/v1.3.1...v1.3.2) (2023-06-20)


### Bug Fixes

* `companion-module-check` script ([45fa276](https://github.com/bitfocus/companion-module-tools/commit/45fa2766fdaab7991c7554c40b09792d3eb8bda2))

## [1.3.1](https://github.com/bitfocus/companion-module-tools/compare/v1.3.0...v1.3.1) (2023-06-08)


### Bug Fixes

* update readme ([def7f19](https://github.com/bitfocus/companion-module-tools/commit/def7f19ff41412d1b85e13beee277b48247a2c6c))

## [1.3.0](https://github.com/bitfocus/companion-module-tools/compare/v1.2.1...v1.3.0) (2023-06-08)


### Features

* add option to build with support for node-gyp-build ([#24](https://github.com/bitfocus/companion-module-tools/issues/24)) ([2a4e311](https://github.com/bitfocus/companion-module-tools/commit/2a4e3115ca26c695d409080d07ef8ad5e6dd840a))
* rework eslint config to be generated to allow further customisation ([e30ae2b](https://github.com/bitfocus/companion-module-tools/commit/e30ae2b23714e858eb333c9be9396d03f187dbee))

## [1.2.1](https://github.com/bitfocus/companion-module-tools/compare/v1.2.0...v1.2.1) (2023-05-12)


### Bug Fixes

* use name from package.json when building externals dependencies object ([6563d0e](https://github.com/bitfocus/companion-module-tools/commit/6563d0e1b23123a056146576e7721c3e2f9e4cfd))

## [1.2.0](https://github.com/bitfocus/companion-module-tools/compare/v1.1.0...v1.2.0) (2023-03-06)


### Features

* flatten directory structure for extra files ([edfff7d](https://github.com/bitfocus/companion-module-tools/commit/edfff7dc2d41d8215cde2b9d9158a08cbecb62e3))

## [1.1.0](https://github.com/bitfocus/companion-module-tools/compare/v1.0.2...v1.1.0) (2023-02-22)


### Features

* add `--dev` parameter to produce a `development` webpack build ([ffb36bc](https://github.com/bitfocus/companion-module-tools/commit/ffb36bcd9cb5109eed0bbb05da22b4ea00745b34))
* allow modules to specify additional webpack plugins ([3dc1f5f](https://github.com/bitfocus/companion-module-tools/commit/3dc1f5f0da879c31dab0395ac6d012ad810ad4ad))

## [1.0.2](https://github.com/bitfocus/companion-module-tools/compare/v1.0.1...v1.0.2) (2023-02-19)


### Bug Fixes

* paths on windows in bash ([85f5438](https://github.com/bitfocus/companion-module-tools/commit/85f5438a57caf0328beb26b18ef55fcab2115665))

## [1.0.1](https://github.com/bitfocus/companion-module-tools/compare/v1.0.0...v1.0.1) (2023-02-17)


### Bug Fixes

* missing prebuilds in built packages ([acd76e8](https://github.com/bitfocus/companion-module-tools/commit/acd76e84ed98916f31d251ddddc0a601514c91c0))

## [1.0.0](https://github.com/bitfocus/companion-module-tools/compare/v0.5.2...v1.0.0) (2023-02-05)


### ⚠ BREAKING CHANGES

* rename webpack-ext.cjs to build-config.cjs

### Features

* rename webpack-ext.cjs to build-config.cjs ([c8864cd](https://github.com/bitfocus/companion-module-tools/commit/c8864cd55306a4ae60c6602cf7c73bf81eb585be))
* support including 'extraFiles' in the built pkg ([b130f57](https://github.com/bitfocus/companion-module-tools/commit/b130f572a13ddef49596ba0a4103d18d22b8a231))

## [0.5.2](https://github.com/bitfocus/companion-module-tools/compare/v0.5.1...v0.5.2) (2023-01-10)


### Bug Fixes

* scripts unable to resolve dependencies ([312caf3](https://github.com/bitfocus/companion-module-tools/commit/312caf36f42bb17965fc010e80bd2184c4bf8a62))

## [0.5.1](https://github.com/bitfocus/companion-module-tools/compare/v0.5.0...v0.5.1) (2022-12-01)


### Bug Fixes

* update minimum @companion-module/base ([5897c0a](https://github.com/bitfocus/companion-module-tools/commit/5897c0a8e4fde6bb0599fb336437193702143b78))

## [0.5.0](https://github.com/bitfocus/companion-module-tools/compare/v0.4.1...v0.5.0) (2022-11-27)


### Features

* support copying native module prebuilt binaries ([3e5610a](https://github.com/bitfocus/companion-module-tools/commit/3e5610a809cbbb8d7ad9844824489ed7f5dedb3a))

## [0.4.1](https://github.com/bitfocus/companion-module-tools/compare/v0.4.0...v0.4.1) (2022-11-26)


### Bug Fixes

* updated tsconfig ([6dd1a05](https://github.com/bitfocus/companion-module-tools/commit/6dd1a0544e5d9f784f276485cb9254b35195f3c1))

## [0.4.0](https://github.com/bitfocus/companion-module-tools/compare/v0.3.3...v0.4.0) (2022-11-26)


### Features

* require node 18 ([f4dfdd2](https://github.com/bitfocus/companion-module-tools/commit/f4dfdd2f510642ca99937100139a65f2903affe9))


### Bug Fixes

* add missing dependency ([eacc0f4](https://github.com/bitfocus/companion-module-tools/commit/eacc0f4e9c4af028905d9a096570ce5f34212733))

## [0.3.3](https://github.com/bitfocus/companion-module-tools/compare/v0.3.2...v0.3.3) (2022-11-22)


### Bug Fixes

* tsconfig recommends commonjs ([1851276](https://github.com/bitfocus/companion-module-tools/commit/1851276f725254ba1338a9d30d8cd32e7dea31b9))

## [0.3.2](https://github.com/bitfocus/companion-module-tools/compare/v0.3.1...v0.3.2) (2022-10-11)


### Bug Fixes

* preserve json files ([6d464b5](https://github.com/bitfocus/companion-module-tools/commit/6d464b5dc30f961e053de71d64ec07e005c542a5))

## [0.3.1](https://github.com/bitfocus/companion-module-tools/compare/v0.3.0...v0.3.1) (2022-10-01)


### Bug Fixes

* errors ([26af195](https://github.com/bitfocus/companion-module-tools/commit/26af195288010c759dd354fc3d9e9d1946a1a16d))

## [0.3.0](https://github.com/bitfocus/companion-module-tools/compare/v0.2.0...v0.3.0) (2022-10-01)


### Features

* validateManifest before building module ([0166c7d](https://github.com/bitfocus/companion-module-tools/commit/0166c7da0ed725de77e3c71bc7992f8fd9deba94))


### Bug Fixes

* generating of manifest incorrectly processing 'products' field ([5f5ad9e](https://github.com/bitfocus/companion-module-tools/commit/5f5ad9e802249e4c9fe60ad8eb2278c715fa0a15))
* update runtime.api in conversion script ([ce95e96](https://github.com/bitfocus/companion-module-tools/commit/ce95e96626023e11ec7fe460278a3418dc6f0eaf))

## [0.2.0](https://github.com/bitfocus/companion-module-tools/compare/v0.1.1...v0.2.0) (2022-09-04)


### Features

* update @companion-module/base ([97742a5](https://github.com/bitfocus/companion-module-tools/commit/97742a58a71e09a93988f0288e661bd5171f14ba))

## [0.1.1](https://github.com/bitfocus/companion-module-tools/compare/v0.1.0...v0.1.1) (2022-07-21)


### Bug Fixes

* don't rename modules ([0d35f51](https://github.com/bitfocus/companion-module-tools/commit/0d35f510cf24333b753d8b34a5c4af27623fcaed))

## [0.1.0](https://github.com/bitfocus/companion-module-tools/compare/v0.0.2...v0.1.0) (2022-07-12)


### Features

* add runtime.apiVersion to manifest ([b42703b](https://github.com/bitfocus/companion-module-tools/commit/b42703b5bac6e2cb6addc8e71239c24e26c43b90))
* remove husky & lint-staged ([7b71d84](https://github.com/bitfocus/companion-module-tools/commit/7b71d84cb8850242846d5118f651fd7ae129615c))


### Bug Fixes

* set `importHelpers: false` for recommended tsconfig ([1b04d89](https://github.com/bitfocus/companion-module-tools/commit/1b04d89bc50922466dffb416b4ed3b4acf63be71))
* set version field in manifest when generating pkg.tgz ([b42703b](https://github.com/bitfocus/companion-module-tools/commit/b42703b5bac6e2cb6addc8e71239c24e26c43b90))
* update @companion-module/base ([33df2a6](https://github.com/bitfocus/companion-module-tools/commit/33df2a61796954c30c01e25a5f08a2a1bd874e64))

## [0.0.2](https://github.com/bitfocus/companion-module-tools/compare/v0.0.1...v0.0.2) (2022-07-10)


### Bug Fixes

* missing webpack config ([a039dee](https://github.com/bitfocus/companion-module-tools/commit/a039deeb7c1736ce87f3bba8759c230de7ad883d))

## 0.0.1 (2022-07-10)


### Features

* initial commit ([c07d9af](https://github.com/bitfocus/companion-module-tools/commit/c07d9af14b2f950ac93095ed1b6e37d0a206ef99))


### Miscellaneous Chores

* update readme ([8a240c5](https://github.com/bitfocus/companion-module-tools/commit/8a240c5bd6ebc14d9f978fd0e14dba41986626da))
