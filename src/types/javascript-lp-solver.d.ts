declare module "javascript-lp-solver" {
  interface Model {
    optimize: string;
    opType: "min" | "max";
    constraints: Record<string, { min?: number; max?: number; equal?: number }>;
    variables: Record<string, Record<string, number>>;
    ints?: Record<string, 1>;
    binaries?: Record<string, 1>;
    options?: { timeout?: number; tolerance?: number };
  }
  const solver: { Solve(model: Model): { feasible: boolean; result: number; bounded?: boolean; isIntegral?: boolean } & Record<string, number | boolean> };
  export default solver;
}
