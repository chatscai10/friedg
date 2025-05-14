import { Request } from "express";
import { UserContext as StoresUserContext } from '../stores/stores.types';
import { UserContext as AttendanceUserContext } from '../attendance/attendance.types';

declare global {
  namespace Express {
    interface Request {
      user?: StoresUserContext | AttendanceUserContext | any;
      tenantId?: string;
    }
  }
}