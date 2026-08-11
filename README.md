# SafrodAppList

Community dApp directory for the Safrochain ecosystem. Each listing lives in this repo as JSON + a logo; [registry.json](registry.json) aggregates every entry for apps and websites to consume.

## Using the data

Fetch the merged registry (replace `ORG`, `REPO`, and `REF` with your fork or `SAFROCHAIN/SafrodAppList` and `main`):

```text
https://raw.githubusercontent.com/ORG/REPO/REF/registry.json
```

Each item includes manifest fields plus `manifestPath` and `logoPath` (paths inside the repo). Build logo URLs by prefixing the same raw base, for example:

```text
https://raw.githubusercontent.com/ORG/REPO/REF/apps/<slug>/img/logo.png
```

The JSON schema for each manifest is [schemas/app.manifest.schema.json](schemas/app.manifest.schema.json).

### Per-network deployments

Optional `deployments` lets a dApp be live on testnet, mainnet, both, or neither, with a separate entry URL per network:

```json
"deployments": {
  "mainnet": { "live": true, "url": "https://example.com" },
  "testnet": { "live": false }
}
```

Consumers (for example Safrochain Hub) should pick the entry for the user’s active network. Keep top-level `url` as a fallback.

## Repository layout

```text
apps/
  <slug>/
    json/app.json    # manifest (slug must match folder name)
    img/logo.png     # 512×512 PNG
schemas/
  app.manifest.schema.json
scripts/
  validate.mjs       # local + CI checks
  build-registry.mjs   # regenerate registry.json
registry.json        # generated; commit with app changes
```

Folder `<slug>`: **2–64 characters**, **lowercase letters and digits only** (no spaces or hyphens).

## Scripts

| Command | Purpose |
|--------|---------|
| `npm ci` | Install dependencies (use in CI and locally). |
| `npm run validate` | Schema check, slug rules, logo size/format, duplicate slugs, registry sync. |
| `npm run build:registry` | Rebuild `registry.json` from all `apps/*/json/app.json`. |
| `npm run listcategories` | Print allowed `category` values (one per line). |
| `npm run listenums` | Print allowed values for category, status, and chains. |

Requires **Node.js 20+**.

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full checklist. In short: run **`npm run validate`** until it passes, then **`npm run build:registry`** and commit **`registry.json`** in the same pull request.

Issue and PR templates live under [.github](.github).

## License

[MIT](LICENSE)
