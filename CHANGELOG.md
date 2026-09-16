# Changelog

## [1.0.0](https://github.com/mattcdrake/LeetSRS/compare/v0.6.0...v1.0.0) (2026-09-16)


### ⚠ BREAKING CHANGES

* use catalog metadata and frontend card IDs ([#504](https://github.com/mattcdrake/LeetSRS/issues/504))

### Features

* initialize and query bundled catalog ([#500](https://github.com/mattcdrake/LeetSRS/issues/500)) ([116595a](https://github.com/mattcdrake/LeetSRS/commit/116595a3988bd1dfcf8c0d3ee89a32f2c7676a78))
* link cards to LeetCode problems ([#185](https://github.com/mattcdrake/LeetSRS/issues/185)) ([a6a3c39](https://github.com/mattcdrake/LeetSRS/commit/a6a3c397b946c6b423fdc2533795948e9f9d3832))
* localize catalog topic labels ([#534](https://github.com/mattcdrake/LeetSRS/issues/534)) ([dbd60b6](https://github.com/mattcdrake/LeetSRS/commit/dbd60b6eda820f56332cf5e245e64b8e9117dadb)), closes [#501](https://github.com/mattcdrake/LeetSRS/issues/501)
* redesign settings and unify popup styling ([#567](https://github.com/mattcdrake/LeetSRS/issues/567)) ([54b7026](https://github.com/mattcdrake/LeetSRS/commit/54b70261df9b1fc8373e590d8c2941d433dec9dc))
* remove browser badge setting ([#531](https://github.com/mattcdrake/LeetSRS/issues/531)) ([f84d126](https://github.com/mattcdrake/LeetSRS/commit/f84d12679498cf2e1462b22b40d266abcf629835))
* replace PAT sync with GitHub sign-in ([#564](https://github.com/mattcdrake/LeetSRS/issues/564)) ([389c61e](https://github.com/mattcdrake/LeetSRS/commit/389c61e12d411c5d8e86062af1d14443b0e9216f))
* request GitHub host permissions at sign-in ([#568](https://github.com/mattcdrake/LeetSRS/issues/568)) ([fde875e](https://github.com/mattcdrake/LeetSRS/commit/fde875e4137c0773bb8983e81686e2940487fbeb))
* reset editor from review queue ([#463](https://github.com/mattcdrake/LeetSRS/issues/463)) ([1e90a2e](https://github.com/mattcdrake/LeetSRS/commit/1e90a2e973bd633c088d012632a5d74cd466ef7d))
* retain only English and Chinese localization ([#533](https://github.com/mattcdrake/LeetSRS/issues/533)) ([f78846e](https://github.com/mattcdrake/LeetSRS/commit/f78846ed88e0e6e96984f5492906b34224e38240))
* use catalog metadata and frontend card IDs ([#504](https://github.com/mattcdrake/LeetSRS/issues/504)) ([a982eaf](https://github.com/mattcdrake/LeetSRS/commit/a982eaf32d5c1c4d8e0d397606b6de30ba032725))
* use exact due times and remove configurable day start ([#334](https://github.com/mattcdrake/LeetSRS/issues/334)) ([8408b0b](https://github.com/mattcdrake/LeetSRS/commit/8408b0b898a0dcc0099c60587a653a61b441a8e9))


### Bug Fixes

* align card dates with JSON messaging ([#317](https://github.com/mattcdrake/LeetSRS/issues/317)) ([896abfb](https://github.com/mattcdrake/LeetSRS/commit/896abfb4ea8d37df6f1cf4602ddf40d63b4c8128))
* exclude automation and virtual environments from formatting ([#496](https://github.com/mattcdrake/LeetSRS/issues/496)) ([ab47712](https://github.com/mattcdrake/LeetSRS/commit/ab47712bc09e105c2d33577e05f7bd45ae6f1819))
* exclude profiler artifacts from Biome ([#444](https://github.com/mattcdrake/LeetSRS/issues/444)) ([be0e471](https://github.com/mattcdrake/LeetSRS/commit/be0e4718eb94ff8cc40a8e51c84767a6c553c9ba))
* fit rating buttons to translated labels ([#405](https://github.com/mattcdrake/LeetSRS/issues/405)) ([b07725f](https://github.com/mattcdrake/LeetSRS/commit/b07725fda45eb7492c6984c51329d3b45f3df5a8))
* migrate raw backups before validation ([#354](https://github.com/mattcdrake/LeetSRS/issues/354)) ([f0e3952](https://github.com/mattcdrake/LeetSRS/commit/f0e3952b6cd62de79f65692d5a3170020f30ef25))
* prune unused settings translations ([#530](https://github.com/mattcdrake/LeetSRS/issues/530)) ([408b172](https://github.com/mattcdrake/LeetSRS/commit/408b172d42fdf882f4f3ec431b240184080033f4)), closes [#529](https://github.com/mattcdrake/LeetSRS/issues/529)
* refresh LeetCode catalog ([#498](https://github.com/mattcdrake/LeetSRS/issues/498)) ([15ecc28](https://github.com/mattcdrake/LeetSRS/commit/15ecc28232b7475fae957c0318c388c77bee2b6a))
* refresh LeetCode catalog ([#499](https://github.com/mattcdrake/LeetSRS/issues/499)) ([aa5b9c5](https://github.com/mattcdrake/LeetSRS/commit/aa5b9c5b3f6c781acab5a3143890ee9a2af6d3c1))
* rename legacy editor setting in migration 3 ([#362](https://github.com/mattcdrake/LeetSRS/issues/362)) ([dd18303](https://github.com/mattcdrake/LeetSRS/commit/dd18303f7f51a1727def7ebfa9957e6552956df6))
* simplify review status counts ([#495](https://github.com/mattcdrake/LeetSRS/issues/495)) ([2effdbc](https://github.com/mattcdrake/LeetSRS/commit/2effdbcfa7d4d282dafecc685dcdcee0fe6115d3))
* validate imports and share schema migrations ([#310](https://github.com/mattcdrake/LeetSRS/issues/310)) ([7066c05](https://github.com/mattcdrake/LeetSRS/commit/7066c057471dba4b991cd0287423e78b17152fe4))


### Performance Improvements

* batch catalog queries for saved cards ([#513](https://github.com/mattcdrake/LeetSRS/issues/513)) ([7a287f3](https://github.com/mattcdrake/LeetSRS/commit/7a287f3e1667a715fed58e63187c0e230c4ab86b))

## [0.6.0](https://github.com/mattcdrake/LeetSRS/compare/v0.5.0...v0.6.0) (2026-09-03)


### Features

* reset editor for due cards ([9255b40](https://github.com/mattcdrake/LeetSRS/commit/9255b4034f63e209ca52f91c59d8d177bc74f907))
* support German ([#156](https://github.com/mattcdrake/LeetSRS/issues/156)) ([fdc0d2a](https://github.com/mattcdrake/LeetSRS/commit/fdc0d2a3772ce3cee50b21dc5ca2363348ee9c3d))
* use system theme ([#171](https://github.com/mattcdrake/LeetSRS/issues/171)) ([0a7ed00](https://github.com/mattcdrake/LeetSRS/commit/0a7ed00909b89f542ff94e75bdbd102a94125838))
