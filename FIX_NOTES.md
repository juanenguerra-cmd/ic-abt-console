# Fix Notes

## Changes made
- Updated `package.json` to use `vite-plugin-pwa` `^1.2.0` so it matches `vite` `^6.4.1`.
- Updated the corresponding `package-lock.json` entry for `vite-plugin-pwa` to version `1.2.0` with Vite 6-compatible peer dependency metadata.

## Why this was necessary
The build logs showed `npm clean-install` failing with `ERESOLVE` because `vite-plugin-pwa@0.19.8` only declared support for Vite 3/4/5, while the project uses Vite 6.4.1.

## Remaining caveat
I was not able to fully re-run `npm install`/`npm build` in this environment because registry/network access was unreliable during package resolution. The code-level dependency mismatch is fixed in the project files, but the final runtime/database flow should still be validated in Firebase Studio after importing the zip.
