import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory "Database"
let users = [
  { id: '1', name: 'Sarah Miller', email: 'sarah@shiftmaster.io', password: bcrypt.hashSync('password123', 10), role: 'admin', department: 'Operations', maxWeeklyHours: 40, preferences: ['Morning', 'Afternoon', 'Night'] },
  { id: '2', name: 'Marcus Chen', email: 'marcus@shiftmaster.io', password: bcrypt.hashSync('password123', 10), role: 'employee', department: 'Operations', maxWeeklyHours: 35, preferences: ['Morning', 'Afternoon', 'Night'] },
];

let assignments: any[] = [];
let swaps: any[] = [];
let rejectedSwapAudit: any[] = [];
let shiftRotationCounter: Record<string, number> = {};

const indianHolidays = [
  "2026-01-26",
  "2026-05-01",
  "2026-08-15",
  "2026-10-02",
  "2026-12-25",
  "2026-05-25",
];

let shiftTemplates = [
  { id: 't1', name: 'Morning', startTime: '08:00', endTime: '16:00', breakDuration: 30, color: '#6366F1', department: 'Operations' },
  { id: 't2', name: 'Afternoon', startTime: '16:00', endTime: '00:00', breakDuration: 30, color: '#10B981', department: 'Operations' },
  { id: 't3', name: 'Night', startTime: '00:00', endTime: '08:00', breakDuration: 30, color: '#F43F5E', department: 'Operations' }
];

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Auth endpoints
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password, role, department, preferences } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required identity fields" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid identity email format" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Access key too short (min 6 chars)" });
  }

  const emailLower = email.toLowerCase();
  if (users.find(u => u.email === emailLower)) {
    return res.status(400).json({ error: "Identity already registered in system" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email: emailLower,
      password: hashedPassword,
      role: role || 'employee',
      department: department || 'Operations',
      maxWeeklyHours: 40,
      preferences: preferences || ['Morning', 'Afternoon', 'Night']
    };
    users.push(user);

    const { password: _, ...userWithoutPassword } = user;
    const token = `sm_${Math.random().toString(36).substr(2, 20)}`;
    res.json({
      message: "Identity established successfully",
      user: userWithoutPassword,
      token
    });
  } catch (e) {
    res.status(500).json({ error: "Storage or encryption subsystem failure" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: "Identity not found in database" });
  }

  try {
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (isValidPassword) {
      const { password: _, ...userWithoutPassword } = user;
      const token = `sm_${Math.random().toString(36).substr(2, 20)}`;
      res.json({ token, user: userWithoutPassword });
    } else {
      res.status(401).json({ error: "Validation failed: Invalid credentials" });
    }
  } catch (e) {
    res.status(500).json({ error: "Authentication subsystem failure" });
  }
});

// Data endpoints
app.get("/api/users", (req, res) => {
  const { department } = req.query;
  if (department) {
    return res.json(users.filter(u => u.department === department));
  }
  res.json(users);
});

app.get("/api/templates", (req, res) => res.json(shiftTemplates));

app.get("/api/assignments", (req, res) => {
  const { department } = req.query;
  if (department) {
    const deptUserIds = users.filter(u => u.department === department).map(u => u.id);
    return res.json(assignments.filter(a => deptUserIds.includes(a.userId)));
  }
  res.json(assignments);
});

app.post("/api/assignments", (req, res) => {
  const newAssignment = { id: Math.random().toString(36).substr(2, 9), ...req.body, status: 'assigned' };
  assignments.push(newAssignment);
  res.json(newAssignment);
});

app.delete("/api/assignments/:id", (req, res) => {
  assignments = assignments.filter(a => a.id !== req.params.id);
  res.sendStatus(204);
});

// Swap endpoints
app.get("/api/swaps", (req, res) => {
  const { department } = req.query;
  if (department) {
    const deptUserIds = users.filter(u => u.department === department).map(u => u.id);
    return res.json(swaps.filter(s => deptUserIds.includes(s.fromUserId)));
  }
  res.json(swaps);
});

// Audit log endpoint for rejected swap attempts
app.post("/api/swaps/rejected-audit", (req, res) => {
  const entry = {
    id: Math.random().toString(36).substr(2, 9),
    ...req.body,
    loggedAt: new Date().toISOString()
  };
  rejectedSwapAudit.push(entry);
  console.warn(`[SWAP REJECTED] fromUser=${entry.fromUserId} toUser=${entry.toUserId} date=${entry.date} shift=${entry.shiftId} reason=${entry.reason}`);
  res.json({ logged: true });
});

app.post("/api/swaps", (req, res) => {
  const { fromUserId, toUserId, assignmentId, reason } = req.body;

  // --- Backend validation ---

  // 1. Verify the assignment exists and belongs to the requester
  const requesterAssignment = assignments.find(
    a => a.id === assignmentId && String(a.userId) === String(fromUserId)
  );
  if (!requesterAssignment) {
    return res.status(400).json({ error: 'Invalid assignment: does not belong to requesting user.' });
  }

  // 2. Strict conflict check: Reject if target is busy with ANY assignment on this calendar date
  const timelineConflict = assignments.find(a =>
    String(a.userId) === String(toUserId) &&
    a.date === requesterAssignment.date
  );

  if (timelineConflict) {
    const conflictShift = shiftTemplates.find(t => t.id === timelineConflict.shiftId);
    const conflictShiftName = conflictShift ? conflictShift.name : 'another';

    const auditEntry = {
      id: Math.random().toString(36).substr(2, 9),
      fromUserId,
      toUserId,
      assignmentId,
      date: requesterAssignment.date,
      shiftId: requesterAssignment.shiftId,
      reason: `Backend: schedule conflict (Target already assigned to ${conflictShiftName} shift)`,
      rejectedAt: new Date().toISOString()
    };
    rejectedSwapAudit.push(auditEntry);
    console.warn(`[SWAP REJECTED - BACKEND] Conflict on date=${requesterAssignment.date}. fromUser=${fromUserId} targeting toUser=${toUserId} (working ${conflictShiftName} shift)`);
    
    return res.status(409).json({ 
      error: `Swap rejected: Selected employee is already working the ${conflictShiftName} shift on this date.` 
    });
  }

  // --- End validation ---

  const swap = {
    id: Math.random().toString(36).substr(2, 9),
    fromUserId,
    toUserId,
    assignmentId,
    reason,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  swaps.push(swap);
  res.json(swap);
});

app.patch("/api/swaps/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const swapIndex = swaps.findIndex(s => s.id === id);
  if (swapIndex !== -1) {
    swaps[swapIndex].status = status;

    if (status === 'approved') {
      const swap = swaps[swapIndex];
      const assignIdx = assignments.findIndex(a => a.id === swap.assignmentId);
      if (assignIdx !== -1) {
        const originalAssignment = assignments[assignIdx];
        const fromUserId = swap.fromUserId;
        const toUserId = swap.toUserId;
        const date = originalAssignment.date;

        const recipientAssignIdx = assignments.findIndex(a => a.userId === toUserId && a.date === date);

        if (recipientAssignIdx !== -1) {
          assignments[assignIdx].userId = toUserId;
          assignments[recipientAssignIdx].userId = fromUserId;
          assignments[assignIdx].status = 'swapped';
          assignments[recipientAssignIdx].status = 'swapped';
        } else {
          assignments[assignIdx].userId = toUserId;
          assignments[assignIdx].status = 'swapped';
        }
      }
    }
    res.json(swaps[swapIndex]);
  } else {
    res.status(404).json({ error: "Swap not found" });
  }
});

app.post("/api/seed", (req, res) => {
  assignments = [];
  swaps = [];
  rejectedSwapAudit = [];
  users = [
    { id: '1', name: 'Sarah Miller', email: 'sarah@shiftmaster.io', password: bcrypt.hashSync('password123', 10), role: 'admin', department: 'Operations', maxWeeklyHours: 40, preferences: ['Morning', 'Afternoon', 'Night'] },
    { id: '2', name: 'Marcus Chen', email: 'marcus@shiftmaster.io', password: bcrypt.hashSync('password123', 10), role: 'employee', department: 'Operations', maxWeeklyHours: 35, preferences: ['Morning', 'Afternoon', 'Night'] },
  ];
  shiftRotationCounter = {};
  console.log("System Purge & Re-initialization executed");
  res.json({ message: "System reset to clean baseline" });
});

app.post("/api/generate-roster", (req, res) => {
  try {
    const { startDate, department } = req.body;
    let rosterEmployees = users.filter(u => u.role === 'employee');

    if (department) {
      rosterEmployees = rosterEmployees.filter(u => u.department === department);
    }

    if (rosterEmployees.length === 0) return res.json([]);

    const startObj = new Date(startDate);
    const endObj = new Date(startObj);
    endObj.setDate(startObj.getDate() + 14);
    const startDateStr = startObj.toISOString().split('T')[0];
    const endDateStr = endObj.toISOString().split('T')[0];
    const employeeIds = rosterEmployees.map(e => e.id);

    assignments = assignments.filter(a => {
      const isDateInRange = a.date >= startDateStr && a.date < endDateStr;
      const isEmployeeIncluded = employeeIds.includes(a.userId);
      return !(isDateInRange && isEmployeeIncluded);
    });

    const start = new Date(startDate);
    const generated: any[] = [];
    const weeklyHoursTrack: Record<string, number> = {};

    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();
      const weekIndex = Math.floor(i / 7);

      if (indianHolidays.includes(dateStr) || dayOfWeek === 0 || dayOfWeek === 6) continue;

      const targetPerShift = Math.floor(rosterEmployees.length / shiftTemplates.length);
      const remainder = rosterEmployees.length % shiftTemplates.length;
      const shiftAssignments: Record<string, string[]> = {};
      shiftTemplates.forEach(t => shiftAssignments[t.id] = []);

      const unassignedEmployees = [...rosterEmployees];

      shiftTemplates.forEach(template => {
        const interestedEmps = unassignedEmployees.filter(e => e.preferences && e.preferences[0] === template.name);
        while (interestedEmps.length > 0 && shiftAssignments[template.id].length < targetPerShift) {
          const emp = interestedEmps.shift()!;
          const rotationKey = `${emp.id}_${weekIndex}`;
          const currentHours = weeklyHoursTrack[rotationKey] || 0;

          if (currentHours + 8 <= (emp.maxWeeklyHours || 40)) {
            shiftAssignments[template.id].push(emp.id);
            weeklyHoursTrack[rotationKey] = currentHours + 8;
            const idx = unassignedEmployees.findIndex(u => u.id === emp.id);
            if (idx !== -1) unassignedEmployees.splice(idx, 1);
          }
        }
      });

      shiftTemplates.forEach((template, tIdx) => {
        const currentTarget = targetPerShift + (tIdx < remainder ? 1 : 0);
        let attempts = 0;
        const maxAttempts = unassignedEmployees.length;

        while (shiftAssignments[template.id].length < currentTarget && unassignedEmployees.length > 0 && attempts < maxAttempts) {
          const rotationKeyGlobal = `${department || 'all'}_rotation_${template.id}`;
          const currentCounter = shiftRotationCounter[rotationKeyGlobal] || 0;
          const empIndex = currentCounter % unassignedEmployees.length;
          const emp = unassignedEmployees[empIndex];

          const weekKey = `${emp.id}_${weekIndex}`;
          const currentHours = weeklyHoursTrack[weekKey] || 0;

          if (currentHours + 8 <= (emp.maxWeeklyHours || 40)) {
            shiftAssignments[template.id].push(emp.id);
            weeklyHoursTrack[weekKey] = currentHours + 8;
            unassignedEmployees.splice(empIndex, 1);
          } else {
            attempts++;
          }
          shiftRotationCounter[rotationKeyGlobal] = currentCounter + 1;
        }
      });

      Object.entries(shiftAssignments).forEach(([shiftId, empIds]) => {
        empIds.forEach(userId => {
          generated.push({
            id: Math.random().toString(36).substr(2, 9),
            userId,
            shiftId,
            date: dateStr,
            status: 'assigned',
            notes: 'Intelligent Rotation & Preference Allocation'
          });
        });
      });
    }

    assignments = [...assignments, ...generated];
    res.json(generated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware setup
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();