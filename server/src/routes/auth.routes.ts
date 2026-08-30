import { Router } from "express";
import {
  changePasswordHandler,
  forgotPassword,
  loginHandler,
  logout,
  me,
  register,
  resendVerificationHandler,
  resetPasswordHandler,
  verifyEmailHandler,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authActionRateLimiter, loginRateLimiter } from "../middleware/rateLimit.middleware.js";

export const authRouter = Router();

authRouter.post("/register", authActionRateLimiter, register);
authRouter.post("/login", loginRateLimiter, loginHandler);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAuth, me);
authRouter.post("/forgot-password", authActionRateLimiter, forgotPassword);
authRouter.post("/reset-password", authActionRateLimiter, resetPasswordHandler);
authRouter.post("/verify-email", authActionRateLimiter, verifyEmailHandler);
authRouter.post("/resend-verification", requireAuth, authActionRateLimiter, resendVerificationHandler);
authRouter.post("/change-password", requireAuth, authActionRateLimiter, changePasswordHandler);
