# Windows pnpm Symlink EBUSY Locks: Cause and Resolution

A common issue when working with `pnpm` on Windows is encountering persistent `ERR_PNPM_EBUSY` or `EPERM` errors during `pnpm install`, specifically when trying to create symbolic links (symlinks) or directory junctions inside `node_modules/.pnpm`. 

This guide details the cause of these file-locking errors on Windows and provides robust solutions to resolve them.

---

## 1. The EBUSY Symlink Locking Phenomenon on Windows

By default, `pnpm` uses a highly optimized **isolated** `node-linker` architecture. Rather than copying dependencies into a flat structure (like standard `npm` or `yarn`), it places them into a local virtual store (`node_modules/.pnpm`) and links them to their respective packages using symlinks or directory junctions.

### The Issue
On Windows filesystems (NTFS), file locking is extremely strict. 
1. As `pnpm` downloads and writes thousands of dependency files into `node_modules/.pnpm`, **Windows Defender (or another real-time antivirus scanner) immediately locks those files to scan them**.
2. At the exact same millisecond, `pnpm` attempts to create a symlink or junction pointing to those newly created folders/files.
3. Because the antivirus has placed a temporary lock on the target file/folder to inspect it, the operating system throws an `EBUSY: resource busy or locked` error.

Since the lock is triggered on-demand by the real-time scanning of *newly written* files, typical workarounds like restarting the editor, pruning the store, or restarting the PC do not solve the root issue, as the next installation attempt simply triggers the real-time scanner again.

---

## 2. The Primary Resolution: The Hoisted Linker (`node-linker=hoisted`)

For Windows-based environments where real-time protection cannot easily be modified, or where strict symlinks consistently lock up, the most robust solution is to bypass symbolic links entirely.

### The Pattern
You can force `pnpm` to use a flat `node_modules` structure—exactly like `npm` or `yarn`—which eliminates all symlink/junction creation and prevents EBUSY conflicts.

Add a `.npmrc` file to the root of the project with the following configuration:

```ini
# .npmrc
node-linker=hoisted
```

### Steps to Apply:
1. Create or open the root `.npmrc` file.
2. Add `node-linker=hoisted`.
3. Safely delete the existing `node_modules` folder to clean up any partially-written locks:
   ```powershell
   Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules
   ```
4. Run `pnpm install`. `pnpm` will resolve, download, and copy all packages cleanly into a flat `node_modules` structure without using symlinks.

---

## 3. The Alternative Resolution: Antivirus Exclusions

If you must preserve the default isolated symlinking structure of `pnpm` (e.g., for disk space savings or strict dependency guarding), you must configure your real-time scanner to ignore the folders `pnpm` is modifying.

### The Pattern
Add exclusions for both the global/local `pnpm` store and the project workspace. Run the following commands in an **Administrator PowerShell** terminal:

```powershell
# 1. Exclude the pnpm store path (default Windows location)
Add-MpPreference -ExclusionPath "C:\Users\Administrator\AppData\Local\pnpm\store\v10"

# 2. Exclude your project workspace directory
Add-MpPreference -ExclusionPath "C:\Users\Administrator\Desktop\GoRola"
```

*Note: This approach keeps the standard isolated structure but requires elevated permissions on the machine to add Windows Defender exclusions.*

---

## Summary of Learnings

1. **Antivirus Lockups:** `EBUSY` during `pnpm install` on Windows is almost always caused by real-time scanners briefly holding locks on new files during symlink generation.
2. **Hoisted Linker for Windows Stability:** Using `node-linker=hoisted` in `.npmrc` is the most reliable, configuration-free way to make `pnpm` rock-solid on Windows platforms by bypassing symlinks entirely.
3. **Always Clean Up first:** When resolving locker conflicts, always delete `node_modules` before running `pnpm install` again to avoid trying to modify locked files from a previous crashed run.
