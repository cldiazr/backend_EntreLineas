import { Router } from "express";
import {
  listCommissionPresets,
  createCommissionPreset,
  deleteCommissionPreset,
} from "../controllers/commissionPreset.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/", auth, listCommissionPresets);
router.post("/", auth, createCommissionPreset);
router.delete("/:id", auth, deleteCommissionPreset);

export default router;
