# GCWG-RDA maDMP schema v3.0

`GCWG-RDA-maDMP-schema_v3.0.json` is an unmodified copy of
`JSON/GCWG-RDA-maDMP-schema.json` from
https://github.com/FAIRERdata/maDMP-Standard at commit
`a001481c50071d7ac7617dcfaaebefde7247bbab` (7 May 2026), which the repository
keeps as its newest schema (`schema_version` const `"v3.0"`).

It is used only by tests, to validate what `mapFormToMadmp` exports. App code
must not import it: it is ~2 MB, mostly ISO language and currency lists.

To update: replace the file, bump the pinned commit above, and run
`npx vitest run src/schemas/madmp`.
