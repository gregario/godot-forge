export function checkNodeVersion(): void {
  const major = parseInt(process.versions.node.split(".")[0], 10);
  if (major < 18) {
    console.error(
      `godot-forge requires Node.js 18 or later. Current version: ${process.versions.node}`
    );
    process.exit(1);
  }
}
