# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.4 — 2026-04-26

### Fixed

- **Bundle Godot 4 API docs index in npm package.** The `godot_search_docs` tool returned no results for installed users because the docs index (`dist/data/godot-docs.json`) was never shipped: the `build:docs` script was not wired into `npm run build`, and `package.json` `files` did not include `dist/data/`. The build now copies the prebuilt index into `dist/data/` and the `files` field publishes it. As a result the npm tarball grows by ~4.3 MB (the size of the docs index), but `godot_search_docs` now returns real content for installed users instead of an empty payload.
