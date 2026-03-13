/**
 * Strip ANSI escape codes and terminal colour sequences from text.
 * GUT and GdUnit4 output may contain these.
 */
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b\(B/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}
