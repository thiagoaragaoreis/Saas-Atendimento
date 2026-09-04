export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: string;
  companyId: number;
  queueIds: number[];
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser;
    }
  }
}

export {};
