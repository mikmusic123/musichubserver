import type { Request, RequestHandler } from "express";
import "dotenv/config";
export type JwtUserPayload = {
    id: string;
    email: string;
    name: string;
};
export type AuthedRequest = Request & {
    user?: JwtUserPayload;
};
export declare const requireAuth: RequestHandler;
//# sourceMappingURL=auth.middleware.d.ts.map