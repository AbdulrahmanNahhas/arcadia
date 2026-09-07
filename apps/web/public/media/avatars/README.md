# Profile avatar catalog

Every image in this directory and its subdirectories is an option in the profile and administrator
avatar pickers. The file path itself is stored in the account, for example:

```text
cars-1.png
square-aspect/trollhunter-3.png
```

To add an avatar later, add a `.png`, `.webp`, `.jpg`, `.jpeg`, or `.avif` file under this
directory, then rebuild the web app. Vite regenerates the picker catalog during the build; no
TypeScript, translation, API, or database change is needed. Filenames must use lowercase letters,
numbers, and hyphens, and subdirectory names follow the same rule.

Images render as centered, cover-fitted circles. Square images work best; keep the face or subject
near the center so it remains visible at small sizes.
