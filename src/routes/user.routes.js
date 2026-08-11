import { Router } from "express";
import { listUsers, updateUser } from "../controllers/user.controller.js";
import { auth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", auth, requireAdmin, listUsers);
router.put("/:id", auth, requireAdmin, updateUser);

export default router;
