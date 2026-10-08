// Yalnızca Node/tsc ile tür denetimi için: Deno.serve bildirimi.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
}
declare module "node:test" {
  export function test(name: string, fn: () => unknown): void;
}
declare module "node:assert/strict" {
  const assert: {
    (value: unknown, message?: string): asserts value;
    equal(a: unknown, b: unknown, message?: string): void;
    deepEqual(a: unknown, b: unknown, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
    match(value: string, re: RegExp, message?: string): void;
  };
  export default assert;
}
