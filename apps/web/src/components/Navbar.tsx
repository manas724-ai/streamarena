import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, balance, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#0b0b0f]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-400" />
          <span className="text-lg font-bold tracking-tight text-white">StreamArena</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-5 text-sm text-zinc-400">
          <Link to="/" className="hover:text-white transition-colors">
            Discover
          </Link>
          <Link to="/arena" className="hover:text-white transition-colors flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            The Arena
          </Link>
          {user && (
            <Link to="/dashboard" className="hover:text-white transition-colors">
              Creator dashboard
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/wallet"
                className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-amber-300 hover:border-amber-400/50 transition-colors"
              >
                ✨ {balance.toLocaleString()}
              </Link>
              <Link
                to={`/watch/${user.username}`}
                className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-zinc-900 transition-colors"
              >
                <span
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-black"
                  style={{ background: user.avatarColor }}
                >
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-sm text-zinc-200 hidden md:inline">{user.displayName}</span>
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-zinc-300 hover:text-white">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-1.5 text-sm font-semibold text-white"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
