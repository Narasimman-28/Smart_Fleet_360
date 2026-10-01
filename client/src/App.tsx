import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { VehiclesPage } from './pages/VehiclesPage';
import { VehicleDetail360Page } from './pages/VehicleDetail360Page';
import { ComplianceHubPage } from './pages/ComplianceHubPage';
import { FASTagHubPage } from './pages/FASTagHubPage';
import { ChallansHubPage } from './pages/ChallansHubPage';
import { FuelHubPage } from './pages/FuelHubPage';
import { MaintenanceHubPage } from './pages/MaintenanceHubPage';
import { BookingsHubPage } from './pages/BookingsHubPage';
import { DriversHubPage } from './pages/DriversHubPage';
import { ExpensesHubPage } from './pages/ExpensesHubPage';
import { CustomersPage } from './pages/CustomersPage';
import { ReportsPage } from './pages/ReportsPage';
import { NotificationCenterPage } from './pages/NotificationCenterPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { UserManagementPage } from './pages/UserManagementPage';
import { DriverPortalPage } from './pages/DriverPortalPage';
import { MobileDriverTrackPage } from './pages/MobileDriverTrackPage';
import { DriverLocationWatch } from './components/DriverLocationWatch';
import { RegisterVehicleModal } from './components/RegisterVehicleModal';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import {
  QuickBookingModal,
  QuickFuelModal,
  QuickServiceModal,
  QuickFASTagRechargeModal,
  QuickInsuranceModal,
  QuickPUCModal,
  QuickChallanModal
} from './components/AddRecordModals';

export const App: React.FC = () => {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  // Global modals state
  const [isRegisterVehicleOpen, setIsRegisterVehicleOpen] = useState(false);
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState(false);
  const [isQuickFuelOpen, setIsQuickFuelOpen] = useState(false);
  const [isQuickServiceOpen, setIsQuickServiceOpen] = useState(false);
  const [isQuickFASTagOpen, setIsQuickFASTagOpen] = useState(false);
  const [isQuickInsuranceOpen, setIsQuickInsuranceOpen] = useState(false);
  const [isQuickPUCOpen, setIsQuickPUCOpen] = useState(false);
  const [isQuickChallanOpen, setIsQuickChallanOpen] = useState(false);

  // Synchronize browser history and guard against back-button access
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/';
      const savedToken = localStorage.getItem('smartfleet_token');
      // If unauthenticated and trying to access a protected route
      if (!savedToken && path !== '/login' && !path.startsWith('/driver-track/')) {
        window.history.replaceState(null, '', '/login');
        setCurrentPath('/login');
        return;
      }
      setCurrentPath(path);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync route and guard protected pages whenever auth status updates
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (currentPath !== '/login' && !currentPath.startsWith('/driver-track/')) {
        window.history.replaceState(null, '', '/login');
        setCurrentPath('/login');
      }
    } else if (!isLoading && isAuthenticated) {
      if (currentPath === '/login') {
        window.history.replaceState(null, '', '/');
        setCurrentPath('/');
      }
    }
  }, [isLoading, isAuthenticated, currentPath]);

  const navigate = (path: string, replace = false) => {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenQuickAdd = (type: string) => {
    switch (type) {
      case 'vehicle':
        setIsRegisterVehicleOpen(true);
        break;
      case 'booking':
        setIsQuickBookingOpen(true);
        break;
      case 'fuel':
        setIsQuickFuelOpen(true);
        break;
      case 'service':
        setIsQuickServiceOpen(true);
        break;
      case 'fastag':
        setIsQuickFASTagOpen(true);
        break;
      case 'insurance':
        setIsQuickInsuranceOpen(true);
        break;
      case 'puc':
        setIsQuickPUCOpen(true);
        break;
      case 'challan':
        setIsQuickChallanOpen(true);
        break;
      case 'expense':
        navigate('/expenses');
        break;
      default:
        setIsRegisterVehicleOpen(true);
        break;
    }
  };

  // Dedicated Mobile Driver GPS Tracking Route (Bypasses admin login modal)
  if (currentPath.startsWith('/driver-track/')) {
    const token = currentPath.replace('/driver-track/', '').split('?')[0].split('#')[0];
    return <MobileDriverTrackPage token={token} onNavigate={navigate} />;
  }

  // Render Loading Splash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-3 border-[#E53935] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-[#F5F5F5] uppercase tracking-wider">Authenticating SmartFleet 360 Session...</p>
      </div>
    );
  }

  // Render Login Page if Unauthenticated
  if (!isAuthenticated || !user) {
    return <LoginPage onSuccess={() => navigate('/', true)} />;
  }

  // Permission Guard Helper
  const renderRestrictedPage = (element: React.ReactNode, allowedRoles: string[]) => {
    if (hasPermission(allowedRoles)) {
      return element;
    }

    return (
      <div className="bg-[#18181B] rounded-2xl p-10 border border-[#3F3F46] shadow-xl text-center max-w-lg mx-auto my-12">
        <div className="w-14 h-14 rounded-2xl bg-[#3F1111] text-[#FF1744] flex items-center justify-center mx-auto mb-4 border border-[#7F1D1D]">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#F5F5F5] mb-2">Access Denied</h2>
        <p className="text-xs text-[#A1A1AA] mb-6 leading-relaxed">
          Your current active role (<strong className="text-[#F5F5F5]">{user.role}</strong>) does not have sufficient permissions to access this feature. Please contact your system administrator if you believe this is an error.
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] text-xs font-semibold rounded-xl shadow-md transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  };

  // Determine current route component
  const renderPage = () => {
    if (currentPath.startsWith('/vehicles/') && currentPath.length > '/vehicles/'.length) {
      const vehicleId = currentPath.replace('/vehicles/', '');
      return <VehicleDetail360Page vehicleId={vehicleId} onBack={() => navigate('/vehicles')} onNavigate={navigate} />;
    }

    switch (currentPath) {
      case '/':
        return <Dashboard onNavigate={navigate} onOpenQuickAdd={handleOpenQuickAdd} />;
      case '/vehicles':
        return renderRestrictedPage(
          <VehiclesPage onNavigate={navigate} onOpenRegister={() => setIsRegisterVehicleOpen(true)} />,
          ['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Mechanic', 'Driver']
        );
      case '/compliance':
        return renderRestrictedPage(<ComplianceHubPage onNavigate={navigate} />, ['Super Admin', 'Compliance Manager']);
      case '/insurance':
        return renderRestrictedPage(<ComplianceHubPage onNavigate={navigate} />, ['Super Admin', 'Compliance Manager', 'Accountant']);
      case '/puc':
        return renderRestrictedPage(<ComplianceHubPage onNavigate={navigate} />, ['Super Admin', 'Compliance Manager']);
      case '/fitness':
        return renderRestrictedPage(<ComplianceHubPage onNavigate={navigate} />, ['Super Admin', 'Compliance Manager']);
      case '/permits-tax':
        return renderRestrictedPage(<ComplianceHubPage onNavigate={navigate} />, ['Super Admin', 'Compliance Manager', 'Accountant']);
      case '/fastag':
        return renderRestrictedPage(<FASTagHubPage onNavigate={navigate} />, ['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Accountant']);
      case '/challans':
        return renderRestrictedPage(<ChallansHubPage onNavigate={navigate} />, ['Super Admin', 'Compliance Manager', 'Accountant']);
      case '/fuel':
        return renderRestrictedPage(<FuelHubPage onNavigate={navigate} />, ['Super Admin', 'Fleet Manager', 'Accountant', 'Mechanic', 'Driver']);
      case '/maintenance':
      case '/tyres-batteries':
        return renderRestrictedPage(<MaintenanceHubPage onNavigate={navigate} />, ['Super Admin', 'Fleet Manager', 'Mechanic', 'Accountant']);
      case '/bookings':
        return renderRestrictedPage(<BookingsHubPage onNavigate={navigate} />, ['Super Admin', 'Fleet Manager', 'Driver', 'Accountant']);
      case '/drivers':
        return renderRestrictedPage(<DriversHubPage onNavigate={navigate} />, ['Super Admin', 'Fleet Manager']);
      case '/tracking':
      case '/driver-location-watch':
        return renderRestrictedPage(
          <div className="space-y-6 pb-12">
            <div>
              <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">Fleet Location Watch & GPS Telemetry</h1>
              <p className="text-xs text-[#A1A1AA] mt-0.5">Real-time driver GPS streaming, manual checkpoint coordinates & interactive command map</p>
            </div>
            <DriverLocationWatch onNavigate={navigate} />
          </div>,
          ['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Driver']
        );
      case '/driver-portal':
        return <DriverPortalPage />;
      case '/expenses':
        return renderRestrictedPage(<ExpensesHubPage />, ['Super Admin', 'Fleet Manager', 'Accountant']);
      case '/customers':
        return renderRestrictedPage(<CustomersPage />, ['Super Admin', 'Fleet Manager', 'Accountant']);
      case '/reports':
        return renderRestrictedPage(<ReportsPage />, ['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Accountant']);
      case '/notifications':
        return <NotificationCenterPage onNavigate={navigate} />;
      case '/users':
        return renderRestrictedPage(<UserManagementPage />, ['Super Admin']);
      case '/audit-logs':
        return renderRestrictedPage(<AuditLogsPage />, ['Super Admin']);
      case '/settings':
        return renderRestrictedPage(<SettingsPage />, ['Super Admin']);
      case '/profile':
      case '/my-profile':
        return <ProfilePage onNavigate={navigate} />;
      default:
        return <Dashboard onNavigate={navigate} onOpenQuickAdd={handleOpenQuickAdd} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F5F5F5] flex flex-col selection:bg-[#E53935] selection:text-[#F5F5F5] font-sans antialiased">
      {/* Top Universal Navbar */}
      <Navbar onNavigate={navigate} onOpenQuickAdd={handleOpenQuickAdd} />

      {/* Main Layout Area */}
      <div className="flex-1 flex max-w-[1720px] w-full mx-auto">
        {/* Left Navigation Sidebar */}
        <Sidebar currentPath={currentPath} onNavigate={navigate} />

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {renderPage()}
        </main>
      </div>

      {/* Quick Action Modals */}
      <RegisterVehicleModal
        isOpen={isRegisterVehicleOpen}
        onClose={() => setIsRegisterVehicleOpen(false)}
        onSuccess={() => {
          setIsRegisterVehicleOpen(false);
          navigate('/vehicles');
          window.dispatchEvent(new CustomEvent('smartfleet:refresh'));
        }}
      />

      <QuickBookingModal
        isOpen={isQuickBookingOpen}
        onClose={() => setIsQuickBookingOpen(false)}
        onSuccess={() => {
          setIsQuickBookingOpen(false);
          window.dispatchEvent(new CustomEvent('smartfleet:refresh'));
        }}
      />

      <QuickFuelModal
        isOpen={isQuickFuelOpen}
        onClose={() => setIsQuickFuelOpen(false)}
        onSuccess={() => {
          setIsQuickFuelOpen(false);
          window.dispatchEvent(new CustomEvent('smartfleet:refresh'));
        }}
      />

      <QuickServiceModal
        isOpen={isQuickServiceOpen}
        onClose={() => setIsQuickServiceOpen(false)}
        onSuccess={() => {
          setIsQuickServiceOpen(false);
          window.dispatchEvent(new CustomEvent('smartfleet:refresh'));
        }}
      />

      <QuickFASTagRechargeModal
        isOpen={isQuickFASTagOpen}
        onClose={() => setIsQuickFASTagOpen(false)}
        onSuccess={() => {
          setIsQuickFASTagOpen(false);
          window.dispatchEvent(new CustomEvent('smartfleet:refresh'));
        }}
      />

      <QuickInsuranceModal
        isOpen={isQuickInsuranceOpen}
        onClose={() => setIsQuickInsuranceOpen(false)}
        onSuccess={() => {
          setIsQuickInsuranceOpen(false);
          window.dispatchEvent(new CustomEvent('smartfleet:refresh'));
        }}
      />

      <QuickPUCModal
        isOpen={isQuickPUCOpen}
        onClose={() => setIsQuickPUCOpen(false)}
        onSuccess={() => {
          setIsQuickPUCOpen(false);
          window.dispatchEvent(new CustomEvent('smartfleet:refresh'));
        }}
      />

      <QuickChallanModal
        isOpen={isQuickChallanOpen}
        onClose={() => setIsQuickChallanOpen(false)}
        onSuccess={() => {
          setIsQuickChallanOpen(false);
          window.dispatchEvent(new CustomEvent('smartfleet:refresh'));
        }}
      />
    </div>
  );
};

export default App;
