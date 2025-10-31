## Project Publishing Decisions and Steps

This document captures decisions and steps taken to publish the project via GitHub Pages.

### Goals
- Host the existing static site so others can access it via a public URL.

### Approach
- Use GitHub Pages (project site) deployed from the `main` branch, root directory.

### Steps Executed
1. Initialized local Git repository and committed all files.
   - Command: `git init && git add . && git commit -m "Initial commit: publish to GitHub Pages"`

### Next Steps (Operator Actions)
1. Create a new public repository on GitHub (e.g., `espresso-website`).
2. Add the remote and push the `main` branch.
3. Enable GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `/ (root)`.
4. Verify the site loads at `https://<username>.github.io/<repo>/`.

### Notes
- The site uses relative asset paths, which are compatible with GitHub Pages project sites.
- If any path issues occur after deployment, double-check for absolute paths and change them to relative paths.


