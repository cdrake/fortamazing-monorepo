// scripts/install-google-plist.js
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const ROOT = process.cwd();
const SRC_PLIST = path.join(ROOT, 'GoogleService-Info.plist');

if (!fs.existsSync(SRC_PLIST)) {
  console.error(`ERROR: ${SRC_PLIST} not found. Place GoogleService-Info.plist in the project root.`);
  process.exit(1);
}

// 1) ensure ios exists
const IOS_DIR = path.join(ROOT, 'ios');
if (!fs.existsSync(IOS_DIR)) {
  console.error('ERROR: ios/ directory does not exist. Run `npx expo prebuild` first.');
  process.exit(1);
}

// Try to discover Xcode project name inside ios/
const iosChildren = fs.readdirSync(IOS_DIR);
let projectName = null;
for (const c of iosChildren) {
  if (c.endsWith('.xcodeproj')) {
    projectName = c.replace('.xcodeproj', '');
    break;
  }
}

// Fallback: if there is a directory with the app name, use that
if (!projectName) {
  // try to find a directory with an Info.plist or similar
  for (const c of iosChildren) {
    const candidate = path.join(IOS_DIR, c);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      // heuristic: an app folder usually contains Info.plist
      if (fs.existsSync(path.join(candidate, 'Info.plist'))) {
        projectName = c;
        break;
      }
    }
  }
}

if (!projectName) {
  console.error('ERROR: Could not discover Xcode project name in ios/.');
  process.exit(1);
}

console.log('Detected iOS project:', projectName);

// Destination app folder (where we copy the plist)
const destAppDir = path.join(IOS_DIR, projectName);
const destPlistPath = path.join(destAppDir, 'GoogleService-Info.plist');

try {
  fs.mkdirSync(destAppDir, { recursive: true });
  fs.copyFileSync(SRC_PLIST, destPlistPath);
  console.log(`Copied ${SRC_PLIST} -> ${destPlistPath}`);
} catch (err) {
  console.error('Failed copying plist:', err);
  process.exit(1);
}

// 2) modify Xcode project to include the file in the target resources
const projectPbxprojPath = path.join(IOS_DIR, `${projectName}.xcodeproj`, 'project.pbxproj');
if (!fs.existsSync(projectPbxprojPath)) {
  console.error(`ERROR: ${projectPbxprojPath} not found.`);
  process.exit(1);
}

console.log('Loading Xcode project:', projectPbxprojPath);
const proj = xcode.project(projectPbxprojPath);
proj.parseSync();

// try to find a valid target UUID
let targetUuid = null;

// preferred: use helper if available
if (typeof proj.getFirstTarget === 'function') {
  const t = proj.getFirstTarget();
  if (t && t.uuid) targetUuid = t.uuid;
}

// fallback: iterate native targets (pick the first real one)
if (!targetUuid) {
  const nativeTargets = proj.pbxNativeTargetSection() || {};
  for (const k of Object.keys(nativeTargets)) {
    if (k.endsWith('_comment')) continue;
    targetUuid = k;
    break;
  }
}

if (!targetUuid) {
  console.error('ERROR: Could not find a native target in the Xcode project.');
  process.exit(1);
}

console.log('Using target UUID:', targetUuid);

// compute the relative path used in the project (relative to the project root)
const relativePlistPath = path.relative(path.join(IOS_DIR, `${projectName}.xcodeproj`, '..'), destPlistPath);

if(relativePlistPath) {
  // Add the resource file to the project (this will create file reference and add to resources)
  const fileRef = proj.addResourceFile(relativePlistPath, { target: targetUuid });

  if (!fileRef) {
    console.log('Note: file may already be present in the project; continuing.');
  } else {
    console.log('Added resource to project:', JSON.stringify(fileRef));
  }
}
// Save project changes
fs.writeFileSync(projectPbxprojPath, proj.writeSync());
console.log('Updated project.pbxproj');

console.log('Done: GoogleService-Info.plist installed and added to target resources.');
