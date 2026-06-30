// CI test harness for the Civic Bryn Pixel GTM template.
//
// Google Tag Manager runs the editor-native `___TESTS___` scenarios only inside
// the Template Editor — there is no official CLI runner. So this file does two
// CI-runnable things with zero dependencies (node:test):
//
//   1. Structural validation — the .tpl JSON sections parse and declare exactly
//      the fields and permissions the sandboxed code relies on, and metadata.yaml
//      references a real commit.
//   2. Behavioural execution — it runs the actual ___SANDBOXED_JS_FOR_WEB_TEMPLATE___
//      block with mocked GTM APIs and asserts the right calls happen.
//
// Caveat: (2) approximates GTM's sandbox by running the code as plain JS with a
// shimmed `require`. It is faithful for this template's simple surface (const,
// arrow fns, require, if/else) but is NOT a full reimplementation of GTM's
// sandbox semantics. The editor-native scenarios remain the source of truth for
// sandbox behaviour; this harness guards against drift on every push.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_URL = "https://bryn.civic.com/pixel/pixel.js";
const CONFIG_GLOBAL = "__brynPixel";

/** Split a .tpl file into its `___SECTION___` blocks, keyed by section name. */
const parseSections = (src) => {
  const parts = src.split(/^___([A-Z_]+)___$/m);
  const out = {};
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = parts[i + 1];
  return out;
};

const tpl = readFileSync(join(ROOT, "template.tpl"), "utf8");
const sections = parseSections(tpl);
const info = JSON.parse(sections.INFO);
const params = JSON.parse(sections.TEMPLATE_PARAMETERS);
const permissions = JSON.parse(sections.WEB_PERMISSIONS);
const sandboxedJs = sections.SANDBOXED_JS_FOR_WEB_TEMPLATE;

/** Find a permission instance by its publicId. */
const permission = (publicId) =>
  permissions.find((p) => p.instance?.key?.publicId === publicId);

/**
 * Execute the template's sandboxed JS with mocked GTM APIs and capture calls.
 * `opts.permission === false` denies all permissions; `opts.injectSucceeds === false`
 * makes injectScript invoke its failure callback.
 */
const runSandbox = (data, opts = {}) => {
  const calls = { injectScript: [], setInWindow: [], gtmOnSuccess: 0, gtmOnFailure: 0 };
  const apis = {
    injectScript: (url, onSuccess, onFailure, cacheToken) => {
      calls.injectScript.push({ url, cacheToken });
      if (opts.injectSucceeds === false) onFailure?.();
      else onSuccess?.();
    },
    setInWindow: (key, value, overrideExisting) => {
      calls.setInWindow.push({ key, value, overrideExisting });
      return true;
    },
    queryPermission: () => opts.permission !== false,
    makeString: (value) => String(value),
  };
  const require = (name) => {
    if (!(name in apis)) throw new Error(`unmocked require('${name}')`);
    return apis[name];
  };
  const env = {
    gtmOnSuccess: () => {
      calls.gtmOnSuccess += 1;
    },
    gtmOnFailure: () => {
      calls.gtmOnFailure += 1;
    },
    ...data,
  };
  // eslint-disable-next-line no-new-func
  new Function("require", "data", sandboxedJs)(require, env);
  return calls;
};

test("INFO declares a WEB tag named Civic Bryn Pixel", () => {
  assert.equal(info.type, "TAG");
  assert.equal(info.displayName, "Civic Bryn Pixel");
  assert.deepEqual(info.containerContexts, ["WEB"]);
});

test("pixelRef is a required, non-empty text field", () => {
  const pixelRef = params.find((p) => p.name === "pixelRef");
  assert.ok(pixelRef, "pixelRef parameter is present");
  assert.equal(pixelRef.type, "TEXT");
  assert.ok(
    pixelRef.valueValidators?.some((v) => v.type === "NON_EMPTY"),
    "pixelRef has a NON_EMPTY validator",
  );
});

test("inject_script permission is scoped to the Civic Bryn origin", () => {
  const inject = permission("inject_script");
  assert.ok(inject, "inject_script permission is declared");
  const urls = inject.instance.param
    .find((p) => p.key === "urls")
    .value.listItem.map((i) => i.string);
  assert.ok(
    urls.includes("https://bryn.civic.com/*"),
    `expected bryn.civic.com origin, got ${JSON.stringify(urls)}`,
  );
});

test("access_globals grants read+write on the config global", () => {
  const globals = permission("access_globals");
  assert.ok(globals, "access_globals permission is declared");
  const keys = globals.instance.param.find((p) => p.key === "keys").value.listItem;
  // Map order is [key, read, write, execute] for both mapKey and mapValue.
  const entry = keys.find((k) => k.mapValue?.[0]?.string === CONFIG_GLOBAL);
  assert.ok(entry, `${CONFIG_GLOBAL} is in the access_globals keys`);
  // setInWindow requires readwrite on the global (GTM rejects write-only).
  assert.equal(entry.mapValue[1].boolean, true, "read is granted");
  assert.equal(entry.mapValue[2].boolean, true, "write is granted");
  assert.equal(entry.mapValue[3].boolean, false, "execute is not granted");
});

test("publishes the ref to the config global and injects the pixel", () => {
  const calls = runSandbox({ pixelRef: "abc123" });
  assert.deepEqual(calls.setInWindow, [
    { key: CONFIG_GLOBAL, value: { ref: "abc123" }, overrideExisting: true },
  ]);
  assert.equal(calls.injectScript.length, 1);
  assert.equal(calls.injectScript[0].url, SCRIPT_URL);
  assert.equal(calls.injectScript[0].cacheToken, SCRIPT_URL);
  assert.equal(calls.gtmOnSuccess, 1);
  assert.equal(calls.gtmOnFailure, 0);
});

test("includes the endpoint override when provided", () => {
  const calls = runSandbox({ pixelRef: "abc123", endpoint: "https://bryn.civic.com/pixel" });
  assert.deepEqual(calls.setInWindow[0].value, {
    ref: "abc123",
    endpoint: "https://bryn.civic.com/pixel",
  });
});

test("does not inject and fails gracefully when permissions are denied", () => {
  const calls = runSandbox({ pixelRef: "abc123" }, { permission: false });
  assert.equal(calls.injectScript.length, 0);
  assert.equal(calls.setInWindow.length, 0);
  assert.equal(calls.gtmOnFailure, 1);
  assert.equal(calls.gtmOnSuccess, 0);
});

test("fails when the pixel script fails to load", () => {
  const calls = runSandbox({ pixelRef: "abc123" }, { injectSucceeds: false });
  assert.equal(calls.injectScript.length, 1);
  assert.equal(calls.gtmOnFailure, 1);
  assert.equal(calls.gtmOnSuccess, 0);
});

test("metadata.yaml references a real commit", () => {
  const meta = readFileSync(join(ROOT, "metadata.yaml"), "utf8");
  const sha = meta.match(/sha:\s*([0-9a-f]{40})/)?.[1];
  assert.ok(sha, "metadata.yaml has a 40-char commit sha");
  // Throws if the commit is not present in the repo (requires full checkout).
  execSync(`git cat-file -e ${sha}^{commit}`, { cwd: ROOT, stdio: "ignore" });
});
