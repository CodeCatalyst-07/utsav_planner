import { z } from 'zod';

// Configure Zod for jitless execution to eliminate dynamic code generation (eval/new Function)
// under strict Content-Security-Policy (CSP) headers without unsafe-eval.
z.config({ jitless: true });

export { z };
export default z;
