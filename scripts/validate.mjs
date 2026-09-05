import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import sharp from "sharp";
import { buildRegistryString } from "./build-registry.mjs";
import { sortKeysDeep } from "./lib/stable-json.mjs";
import {
  manifestPath,
  logoPath,
  jsonDirPath,
  imgDirPath,
} from "./lib/app-paths.mjs";
import { formatAjvErrorMessage } from "./lib/ajv-error-format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APPS_DIR = join(ROOT, "apps");
const SCHEMA_PATH = join(ROOT, "schemas", "app.manifest.schema.json");
const REGISTRY_PATH = join(ROOT, "registry.json");

const SLUG_PATTERN = /^[a-z0-9]{2,64}$/;
const LOGO_SIZE = 512;

/**
 * @returns {string[]}
 */
function listAppDirectories() {
  if (!existsSync(APPS_DIR)) return [];
  return readdirSync(APPS_DIR).filter((name) => {
    if (name.startsWith(".")) return false;
    const p = join(APPS_DIR, name);
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  });
}

function fail(messages) {
  for (const m of messages) console.error(m);
  process.exit(1);
}

const schemaJson = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateManifest = ajv.compile(schemaJson);

const errors = [];
const slugsSeen = new Set();

const dirs = listAppDirectories().sort();

for (const folderSlug of dirs) {
  const prefix = `apps/${folderSlug}`;

  if (!SLUG_PATTERN.test(folderSlug)) {
    errors.push(
      `${prefix}: folder name must be 2–64 chars, lowercase letters and digits only (no spaces or hyphens).`,
    );
    continue;
  }

  const jsonDir = jsonDirPath(APPS_DIR, folderSlug);
  const imgDir = imgDirPath(APPS_DIR, folderSlug);

  if (!existsSync(jsonDir)) {
    errors.push(`${prefix}: missing json/ folder (expected ${prefix}/json/app.json)`);
    continue;
  }
  if (!statSync(jsonDir).isDirectory()) {
    errors.push(`${prefix}/json: must be a directory`);
    continue;
  }

  if (!existsSync(imgDir)) {
    errors.push(`${prefix}: missing img/ folder (expected ${prefix}/img/logo.png)`);
    continue;
  }
  if (!statSync(imgDir).isDirectory()) {
    errors.push(`${prefix}/img: must be a directory`);
    continue;
  }

  const manifestFile = manifestPath(APPS_DIR, folderSlug);
  const relManifest = `${prefix}/json/app.json`;
  if (!existsSync(manifestFile)) {
    errors.push(`${relManifest}: missing`);
    continue;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  } catch (e) {
    errors.push(`${relManifest}: invalid JSON (${e.message})`);
    continue;
  }

  if (manifest.slug !== folderSlug) {
    errors.push(
      `${relManifest}: "slug" must equal project folder name (expected "${folderSlug}", got ${JSON.stringify(manifest.slug)}).`,
    );
  }

  if (!validateManifest(manifest)) {
    for (const err of validateManifest.errors ?? []) {
      errors.push(`${relManifest}: ${formatAjvErrorMessage(err)}`);
    }
  }

  const deployments = manifest.deployments;
  if (deployments && typeof deployments === "object") {
    for (const network of ["mainnet", "testnet"]) {
      const entry = deployments[network];
      if (!entry || typeof entry !== "object") continue;
      if (entry.live === true) {
        if (typeof entry.url !== "string" || !/^https:\/\//.test(entry.url)) {
          errors.push(
            `${relManifest}: deployments.${network}.url is required (https) when live is true.`,
          );
        }
      }
    }
  }

  if (typeof manifest.slug === "string" && slugsSeen.has(manifest.slug)) {
    errors.push(`Duplicate slug ${JSON.stringify(manifest.slug)} in ${relManifest}`);
  }
  if (typeof manifest.slug === "string") slugsSeen.add(manifest.slug);

  const logoFile = logoPath(APPS_DIR, folderSlug);
  const relLogo = `${prefix}/img/logo.png`;
  if (!existsSync(logoFile)) {
    errors.push(`${relLogo}: missing (required PNG, ${LOGO_SIZE}×${LOGO_SIZE})`);
    continue;
  }

  try {
    const meta = await sharp(logoFile).metadata();
    if (meta.format !== "png") {
      errors.push(`${relLogo}: must be PNG (got ${meta.format ?? "unknown"})`);
    }
    if (meta.width !== LOGO_SIZE || meta.height !== LOGO_SIZE) {
      errors.push(
        `${relLogo}: must be ${LOGO_SIZE}×${LOGO_SIZE} (got ${meta.width}×${meta.height})`,
      );
    }
  } catch (e) {
    errors.push(`${relLogo}: could not read image (${e.message})`);
  }
}

if (errors.length) fail(errors);

const built = buildRegistryString();

if (!existsSync(REGISTRY_PATH)) {
  fail(["registry.json is missing. Run: npm run build:registry"]);
}

const onDisk = readFileSync(REGISTRY_PATH, "utf8");
if (built !== onDisk) {
  try {
    const expected = JSON.parse(built);
    const actual = JSON.parse(onDisk);
    if (JSON.stringify(sortKeysDeep(expected)) !== JSON.stringify(sortKeysDeep(actual))) {
      fail([
        "registry.json is out of date or differs from apps/* manifests.",
        "Run: npm run build:registry",
        "Then commit the updated registry.json.",
      ]);
    }
  } catch {
    fail([
      "registry.json does not match the build output.",
      "Run: npm run build:registry",
      "Then commit the updated registry.json.",
    ]);
  }
}

console.error("Validation OK.");
