import { Request } from "express";
import { UserContext } from '../stores/stores.types';

declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
} 