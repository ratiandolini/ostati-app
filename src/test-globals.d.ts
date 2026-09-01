declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const expect: <T>(actual: T) => {
  toBe: (expected: T) => void;
  toContain: (expected: string) => void;
  toHaveLength: (expected: number) => void;
};
