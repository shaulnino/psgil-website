// Resolves the project's TypeScript path alias `@/*` -> `<root>/*` (mirrors
// tsconfig "paths") for the Node test runner. Node's ESM resolver does not do
// extensionless resolution, so we append the correct extension for aliased
// TypeScript targets. Loaded via `node --import ./tests/support/register-alias.mjs`.
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      let target = path.join(root, specifier.slice(2));
      if (!path.extname(target)) {
        if (fs.existsSync(`${target}.ts`)) target += ".ts";
        else if (fs.existsSync(`${target}.tsx`)) target += ".tsx";
        else if (fs.existsSync(path.join(target, "index.ts"))) {
          target = path.join(target, "index.ts");
        }
      }
      return nextResolve(pathToFileURL(target).href, context);
    }
    return nextResolve(specifier, context);
  },
});
