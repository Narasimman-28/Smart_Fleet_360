import React, { useState, useEffect } from 'react';
import {
  Zap, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle,
  ArrowRight, CheckCircle2, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginPageProps {
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login, isLoading, logoutMessage, clearLogoutMessage } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-dismiss logout toast after 5 seconds
  useEffect(() => {
    if (logoutMessage) {
      const timer = setTimeout(() => {
        clearLogoutMessage();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [logoutMessage, clearLogoutMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    clearLogoutMessage();

    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter both your email/username and password.');
      return;
    }

    try {
      await login(identifier.trim(), password);
      setPassword('');
      setIdentifier('');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid username or password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-[#E53935] selection:text-[#F5F5F5]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo & Brand Header */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#B71C1C] via-[#E53935] to-[#FF1744] flex items-center justify-center shadow-lg shadow-[#E53935]/30 mb-4 border border-[#FF1744]/30">
            <Zap className="w-8 h-8 text-[#F5F5F5]" />
          </div>
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-[#F5F5F5] tracking-tight">
            SmartFleet <span className="text-[#E53935]">360</span>
          </h2>
          <p className="mt-1 text-center text-xs font-medium text-[#A1A1AA]">
            Enterprise Transport & Intelligent Fleet Management System
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Main Card */}
        <div className="bg-[#18181B] py-8 px-6 shadow-2xl border border-[#3F3F46] rounded-2xl sm:px-10">
          <div className="mb-6">
            <h3 className="text-base font-bold text-[#F5F5F5]">Account Sign In</h3>
            <p className="text-xs text-[#A1A1AA]">Enter your enterprise credentials to access your dashboard</p>
          </div>

          {logoutMessage && (
            <div className="mb-5 p-3.5 bg-[#0F2A1A] border border-[#22C55E] rounded-xl text-[#F5F5F5] text-xs flex items-center justify-between animate-fadeIn shadow-md">
              <div className="flex items-center space-x-2.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#22C55E]" />
                <span className="font-semibold text-[#F5F5F5]">{logoutMessage}</span>
              </div>
              <button
                type="button"
                onClick={clearLogoutMessage}
                className="text-[#A1A1AA] hover:text-[#F5F5F5] ml-2 p-1 rounded-md hover:bg-[#18181B] transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-[#FF6B6B] text-xs flex items-start space-x-2.5 animate-fadeIn shadow-md">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744] mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-[#F5F5F5] mb-1.5">
                Email or Username
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your email or username"
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#18181B] hover:bg-[#202024] focus:bg-[#18181B] border border-[#3F3F46] focus:border-[#E53935] rounded-xl text-xs text-[#F5F5F5] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#E53935]/20 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#F5F5F5]">
                  Password
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Please contact your System Administrator or Super Admin to reset your credentials.');
                  }}
                  className="text-[11px] font-medium text-[#FF1744] hover:text-[#FF6B6B]"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-10 pr-10 py-2.5 bg-[#18181B] hover:bg-[#202024] focus:bg-[#18181B] border border-[#3F3F46] focus:border-[#E53935] rounded-xl text-xs text-[#F5F5F5] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#E53935]/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#71717A] hover:text-[#F5F5F5] transition cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center text-xs text-[#A1A1AA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#3F3F46] bg-[#18181B] text-[#E53935] focus:ring-[#E53935] w-3.5 h-3.5 mr-2 accent-[#E53935]"
                />
                <span>Remember this device</span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] text-xs font-semibold rounded-xl shadow-lg shadow-[#E53935]/25 transition disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer border border-[#FF1744]/30"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5">
                    <span>Sign In to SmartFleet</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer Security Notice */}
        <div className="mt-6 text-center text-[11px] text-[#A1A1AA] flex items-center justify-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
          <span>Protected with Role-Based Access Control & Encrypted Session Tokens</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
