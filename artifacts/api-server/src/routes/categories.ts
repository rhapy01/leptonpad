import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";

const router = Router();

router.get("/", async (_req, res): Promise<void> => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.id);
  res.json(cats);
});

export default router;
