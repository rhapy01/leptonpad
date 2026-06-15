import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import contentRouter from "./content";
import paymentsRouter from "./payments";
import earningsRouter from "./earnings";
import aiRouter from "./ai";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/categories", categoriesRouter);
router.use("/content", contentRouter);
router.use("/payments", paymentsRouter);
router.use("/earnings", earningsRouter);
router.use("/ai", aiRouter);
router.use("/stats", statsRouter);

export default router;
