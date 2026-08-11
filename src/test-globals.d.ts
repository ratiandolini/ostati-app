declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: <T>(actual: T) => {
  toBe: (expected: T) => void;
  toContain: (expected: string) => void;
};
