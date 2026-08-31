import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import SupportWidget from './components/SupportWidget';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Watch from './pages/Watch';
import Play from './pages/Play';
import Dashboard from './pages/Dashboard';
import WalletPage from './pages/Wallet';
import AdminSupport from './pages/AdminSupport';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0b0b0f] text-zinc-100 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/watch/:slug" element={<Watch />} />
          <Route path="/arena" element={<Play />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/admin/support" element={<AdminSupport />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <SupportWidget />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-zinc-400">
      <p className="text-2xl font-semibold text-zinc-200">Nothing here.</p>
      <p className="mt-2">The stream — or the page — ended.</p>
    </div>
  );
}
