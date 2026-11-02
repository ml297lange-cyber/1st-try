# Vendored libraries

`anthropic-sdk-0.135.0-safari14.mjs` – `@anthropic-ai/sdk@0.135.0`, bundled with esbuild
(`--bundle --format=esm --platform=browser --minify --target=safari14`) so it also runs on
older iPads. One regular expression with a lookbehind (not supported before Safari 16.4) was
replaced by an equivalent without lookbehind; it only guards against `..` in URL paths.
