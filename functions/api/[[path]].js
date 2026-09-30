import { serve } from '../../src/server/content-services.mjs';

// GitHub OAuth for the editor and the optional R2 image library. Static pages never reach this.
export const onRequest = ({ request, env }) => serve(request, env);
