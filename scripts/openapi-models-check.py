#!/usr/bin/env python3
"""T50: writes openapi/models-check.ts, a TypeScript file that fails to compile when a hand-written model of
src/app/core/models/outputs differs from the schema of the same name in the Hestia OpenAPI document
(src/app/core/models/generated/hestia-api.ts, made from openapi/hestia.json). For each pair:
  - the model must fit the schema (every field that the server sends is there, with a type that fits);
  - the model must have no field that the server does not send.
Run by `npm run openapi:check`."""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
generated = (root / "src/app/core/models/generated/hestia-api.ts").read_text()
# The schemas block, whatever the indentation (the file is formatted with Prettier).
block = re.search(r"^( *)schemas: \{\n(.*?)^\1\};", generated, re.M | re.S)
indent = len(block.group(1)) + 2
schemas = set(re.findall(rf"^ {{{indent}}}(\w+): ", block.group(2), re.M))

pairs = []
for file in sorted((root / "src/app/core/models/outputs").glob("*.ts")):
    for name in re.findall(r"^export interface (\w+)", file.read_text(), re.M):
        if name in schemas:
            pairs.append((name, file.stem))

lines = [
    "// Written by scripts/openapi-models-check.py (T50). Do not edit: run `npm run openapi:check`.",
    "import type { components } from '../src/app/core/models/generated/hestia-api';",
]
for name, stem in pairs:
    lines.append(f"import type {{ {name} }} from '../src/app/core/models/outputs/{stem}';")
lines += [
    "",
    "type Schemas = components['schemas'];",
    "/** True when the hand-written model has every field of the schema, with types that fit. */",
    "type Fits<Model, Schema> = [Model] extends [Schema] ? true : false;",
    "/** True when the hand-written model has no field that the schema lacks. */",
    "type NoExtra<Model, Schema> = [Exclude<keyof Model, keyof Schema>] extends [never] ? true : false;",
    "function check<_ extends true>(): void {}",
    "",
]
for name, _ in pairs:
    lines.append(f"check<Fits<{name}, Schemas['{name}']>>();")
    lines.append(f"check<NoExtra<{name}, Schemas['{name}']>>();")
(root / "openapi/models-check.ts").write_text("\n".join(lines) + "\n")
print(f"{len(pairs)} models checked against the Hestia OpenAPI document.")
