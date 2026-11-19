import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { connectedDriveEmail } from "../lib/cv-drive";
import { CvError } from "../lib/cv-errors";

export async function isDriveOwner(req: Request): Promise<boolean> {
  const userId = getAuth(req).userId;
  if (!userId) return false;
  const [user, email] = await Promise.all([
    clerkClient.users.getUser(userId),
    connectedDriveEmail(),
  ]);
  // There is no "first user wins" bootstrap. Only provider-verified addresses
  // matching the currently connected Drive identity confer private access.
  return user.emailAddresses.some(address =>
    address.verification?.status === "verified" &&
    address.emailAddress.trim().toLowerCase() === email,
  );
}

export async function requireCvOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!getAuth(req).userId) {
      res.status(401).json({ error: "Sign in to use your private CV workspace." });
      return;
    }
    if (!await isDriveOwner(req)) {
      res.status(403).json({ error: "Use a verified sign-in email matching the connected Google Drive account." });
      return;
    }
    // Cookie-authenticated mutations must be same-origin. No arbitrary remote
    // document URLs or browser-supplied identities are ever accepted.
    if (req.method === "POST") {
      const origin = req.get("origin");
      const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() ?? req.get("host");
      if ((origin && new URL(origin).host !== host) || !req.is("application/json")) {
        res.status(403).json({ error: "Use the GigFinder website to submit this request." });
        return;
      }
    }
    next();
  } catch (error) {
    res.status(error instanceof CvError ? error.status : 502).json({
      error: error instanceof CvError ? error.message : "Owner access could not be verified. Please retry.",
    });
  }
}
