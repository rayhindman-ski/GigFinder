import { Router, type IRouter } from "express";
import healthRouter from "./health";
import jobsRouter from "./jobs";
import cvRouter from "./cv";

const router: IRouter = Router();

router.use(healthRouter);
router.use(jobsRouter);
router.use(cvRouter);

export default router;
