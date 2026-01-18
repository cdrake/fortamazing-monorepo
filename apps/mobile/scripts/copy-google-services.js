// scripts/copy-google-services.js
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SRC = path.join(ROOT, "GoogleService-Info.plist"); // file in project root

if (!fs.existsSync(SRC)) {
  console.error(`Error: ${SRC} not found. Put GoogleService-Info.plist in the project root.`);
  process.exit(1);
}

const IOS_DIR = path.join(ROOT, "ios");
if (!fs.existsSync(IOS_DIR)) {
  console.error(`Warning: ios/ directory not found. Did you run 'expo prebuild'?`);
  // still continue: copy to ios/ will be created by prebuild in next step
}

// helper to copy file
function copyTo(destDir) {
  try {
    const dest = path.join(destDir, "GoogleService-Info.plist");
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(SRC, dest);
    console.log(`Copied: ${SRC} -> ${dest}`);
  } catch (err) {
    console.error(`Failed to copy to ${destDir}:`, err);
  }
}

// Strategy:
// 1. Copy to ios/ (top-level) — some workflows read it there.
// 2. Inspect ios/* for an Xcode project folder (<name>.xcodeproj) and copy to that project folder.
// 3. If found an ios/<ProjectName>/ folder (common with expo prebuild), copy there as well.

copyTo(path.join(ROOT, "ios")); // always copy to ios/ top level

// scan ios children
if (fs.existsSync(IOS_DIR)) {
  const children = fs.readdirSync(IOS_DIR);
  for (const child of children) {
    const childPath = path.join(IOS_DIR, child);

    // skip Pods & hidden files
    if (child.startsWith(".") || child === "Pods") continue;

    try {
      const stat = fs.statSync(childPath);
      if (stat.isDirectory()) {
        // look for .xcodeproj inside this child dir (or child.xcodeproj at root)
        const files = fs.readdirSync(childPath);
        const hasXcodeproj = files.some(f => f.endsWith(".xcodeproj"));
        if (hasXcodeproj) {
          // copy into the project folder
          copyTo(childPath);
          continue;
        }
      }

      // also check for xcodeproj at ios root like ios/MyApp.xcodeproj
      if (child.endsWith(".xcodeproj")) {
        // derive project name
        const projectName = child.replace(/\.xcodeproj$/, "");
        const likelyAppDir = path.join(IOS_DIR, projectName);
        if (fs.existsSync(likelyAppDir) && fs.statSync(likelyAppDir).isDirectory()) {
          copyTo(likelyAppDir);
        } else {
          // fallback: copy next to xcodeproj
          copyTo(IOS_DIR);
        }
      }
    } catch (err) {
      // keep going
    }
  }
}

console.log("Done.");
