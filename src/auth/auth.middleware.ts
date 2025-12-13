import type { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";

import "dotenv/config";


export type JwtUserPayload = {
  id: string;
  email: string;
  name: string;
};

// ✅ Extend Express Request safely: user is OPTIONAL by default
export type AuthedRequest = Request & {
  user?: JwtUserPayload;
};

export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("missing authorisation")
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not set");
    return res.status(500).json({ error: "Server misconfigured (JWT_SECRET missing)" });
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtUserPayload;

    (req as AuthedRequest).user = decoded;

    return next();
  } catch (err) {
    console.error("JWT verify failed:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

