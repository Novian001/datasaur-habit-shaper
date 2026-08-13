import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Small inline SVG icons (no icon dependency — design system: icons
// supplement text, never replace it). 24x24 viewBox, currentColor stroke.
type IconProps = { size?: number; className?: string };

function Icon({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-mark" aria-hidden="true" style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.55)}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 13.5 10.5 16 16 9.5" />
      </Icon>
    </span>
  );
}

function LayoutIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

function TargetIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </Icon>
  );
}
export { TargetIcon };

export function LogoutIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  );
}

export function UserIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  );
}

export function FlameIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Icon>
  );
}

export function CheckIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <polyline points="20 6 9 17 4 12" />
    </Icon>
  );
}

export function AlertIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </Icon>
  );
}

export function EditIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Icon>
  );
}

export function TrashIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Icon>
  );
}

export function ArrowLeftIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </Icon>
  );
}

// Shared authenticated shell header: brand, primary nav (Dashboard/Goals),
// account context (email), and a quiet Log out action.
export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="shell-header">
      <Link to="/" className="shell-brand" aria-label="Habit Shaper home">
        <BrandMark />
        <span>Habit Shaper</span>
      </Link>
      <nav className="shell-nav" aria-label="Primary">
        <NavLink to="/" end className="shell-nav-link" aria-current="page">
          <LayoutIcon /> Dashboard
        </NavLink>
        <NavLink to="/goals" className="shell-nav-link" aria-current="page">
          <TargetIcon /> Goals
        </NavLink>
      </nav>
      <span className="shell-spacer" />
      {user && (
        <span className="shell-user" title={user.email}>
          <UserIcon />
          <span className="user-email">{user.email}</span>
        </span>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
        <LogoutIcon /> Log out
      </button>
    </header>
  );
}
