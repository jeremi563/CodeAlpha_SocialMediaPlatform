import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { registerValidator, loginValidator } from "../validators/auth.validator.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", registerValidator, authController.register);
router.post("/login", loginValidator, authController.login);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);

export default router;