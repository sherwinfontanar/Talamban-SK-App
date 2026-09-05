import jwt from 'jsonwebtoken';

// Attaches req.user if a valid token is present. Does NOT reject the request
// if there's no token — guest flows are allowed. Use requireAuth() below
// for routes that must have a logged-in user, and requireRole() for staff-only routes.
export function attachUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role }
  } catch (err) {
    // invalid/expired token — treat as unauthenticated rather than erroring,
    // so guest-accessible routes still work
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
