import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import {
  GetCvAccessResponse, ListCvFilesQueryParams, ListCvFilesResponse,
  SelectCvBody, SelectCvResponse, GetCvSessionParams, GetCvSessionResponse,
  AssessRoleBody, AssessRoleResponse,
} from "@workspace/api-zod";
import { isDriveOwner, requireCvOwner } from "../middlewares/cv-owner";
import { listCvDocuments } from "../lib/cv-drive";
import { selectCv, getCvSession, assessRole } from "../lib/cv-analysis";
import { CvError } from "../lib/cv-errors";

const router: IRouter = Router();
router.use("/cv", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  res.vary("Cookie");
  next();
});
const fail = (res: Response, error: unknown) => {
  const status = error instanceof CvError ? error.status : 502;
  if (status === 429) res.setHeader("Retry-After", "60");
  res.status(status).json({ error: error instanceof CvError ? error.message : "The private CV service is unavailable. Please retry." });
};
const owner = (req: Request) => getAuth(req).userId!;

router.get("/cv/access", async (req, res): Promise<void> => {
  try {
    const signedIn = !!getAuth(req).userId;
    const allowed = signedIn && await isDriveOwner(req);
    res.json(GetCvAccessResponse.parse({
      signedIn, allowed,
      message: allowed ? "Private CV workspace unlocked."
        : signedIn ? "Sign in using a verified email matching the connected Google Drive account."
          : "Sign in with the connected Drive owner's account to use private CV tools.",
    }));
  } catch (error) { fail(res, error); }
});
router.use("/cv", requireCvOwner);

router.get("/cv/files", async (req, res): Promise<void> => {
  const query = ListCvFilesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid document search." }); return; }
  try {
    res.json(ListCvFilesResponse.parse(await listCvDocuments(query.data.search, query.data.pageToken)));
  } catch (error) { fail(res, error); }
});
router.post("/cv/select", async (req, res): Promise<void> => {
  const input = SelectCvBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Choose a valid CV document." }); return; }
  try {
    res.json(SelectCvResponse.parse(await selectCv(owner(req), input.data.fileId)));
  } catch (error) { fail(res, error); }
});
router.get("/cv/sessions/:sessionId", async (req, res): Promise<void> => {
  const input = GetCvSessionParams.safeParse(req.params);
  if (!input.success) { res.status(400).json({ error: "Invalid CV session." }); return; }
  try {
    res.json(GetCvSessionResponse.parse(getCvSession(owner(req), input.data.sessionId)));
  } catch (error) { fail(res, error); }
});
router.post("/cv/assessments", async (req, res): Promise<void> => {
  const input = AssessRoleBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Choose a CV and role." }); return; }
  try {
    res.json(AssessRoleResponse.parse(await assessRole(owner(req), input.data.cvSessionId, input.data.jobId)));
  } catch (error) { fail(res, error); }
});

export default router;
