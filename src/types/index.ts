export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  maxWeeklyHours: number;
  preferences: string[];
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  color: string;
  department: string;
}

export interface Assignment {
  id: string;
  userId: string;
  shiftId: string;
  date: string;
  status: 'assigned' | 'swapped';
  notes?: string;
}

export interface SwapRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  assignmentId: string;
  reason: string;
  status: 'pending' | 'peer_accepted' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}