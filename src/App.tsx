import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/common/Navbar.tsx';
import { Footer } from './components/common/Footer.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';

// Dashboards
import { RegionalDashboard } from './components/dashboard/RegionalDashboard.tsx';
import { DivisionDashboard } from './components/dashboard/DivisionDashboard.tsx';
import { SchoolDashboard } from './components/dashboard/SchoolDashboard.tsx';

// Functional Views
import { SchoolAssessment } from './components/assessment/SchoolAssessment.tsx';
import { AssessmentHistory } from './components/assessment/AssessmentHistory.tsx';
import { MonitoringView } from './components/monitoring/MonitoringView.tsx';
import { SchoolYearManagement } from './components/school-years/SchoolYearManagement.tsx';
import { FormBuilder } from './components/form-builder/FormBuilder.tsx';
import { SchoolManagement } from './components/schools/SchoolManagement.tsx';
import { RegionalCustomization } from './components/customization/RegionalCustomization.tsx';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [viewParams, setViewParams] = useState<any>(null);

  if (loading) {
    return (
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-light">
        <div className="spinner-grow text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading Project SBM Online...</span>
        </div>
        <div className="h5 fw-bold text-dark">Project SBM Online</div>
        <div className="text-muted small">Department of Education • Regional Office VIII</div>
      </div>
    );
  }

  // Not logged in -> Show responsive, branded LoginPage
  if (!user) {
    return <LoginPage />;
  }

  // Helper to switch view with optional params
  const handleNavigate = (view: string, params?: any) => {
    setCurrentView(view);
    setViewParams(params || null);
  };

  const handleInspectSchool = (schoolId: number) => {
    setViewParams({ targetSchoolId: schoolId });
    setCurrentView('inspect-assessment');
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <Navbar currentView={currentView} onNavigate={handleNavigate} />

      <main className="flex-grow-1">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <>
            {user.role === 'regional' && <RegionalDashboard onNavigate={handleNavigate} />}
            {user.role === 'division' && <DivisionDashboard onNavigate={handleNavigate} />}
            {user.role === 'school' && <SchoolDashboard onNavigate={handleNavigate} />}
          </>
        )}

        {/* School Assessment View */}
        {currentView === 'assessment' && (
          <SchoolAssessment onBack={() => handleNavigate('dashboard')} />
        )}

        {/* Assessment Inspection View (for Regional/Division monitoring) */}
        {currentView === 'inspect-assessment' && (
          <SchoolAssessment
            targetSchoolId={viewParams?.targetSchoolId}
            onBack={() => handleNavigate('monitoring')}
          />
        )}

        {/* Assessment History View */}
        {currentView === 'history' && (
          <AssessmentHistory
            targetSchoolId={viewParams?.targetSchoolId}
            onBack={() => handleNavigate(viewParams?.targetSchoolId ? 'monitoring' : 'dashboard')}
          />
        )}

        {/* Monitoring & Reporting View */}
        {currentView === 'monitoring' && (
          <MonitoringView
            initialDivisionId={viewParams?.divisionId}
            onInspectSchool={handleInspectSchool}
          />
        )}

        {/* School Year Lifecycle View */}
        {currentView === 'school-years' && user.role === 'regional' && (
          <SchoolYearManagement />
        )}

        {/* Form Builder View */}
        {currentView === 'form-builder' && user.role === 'regional' && (
          <FormBuilder />
        )}

        {/* School Accounts Management View */}
        {currentView === 'schools' && (user.role === 'regional' || user.role === 'division') && (
          <SchoolManagement />
        )}

        {/* Regional Customization View */}
        {currentView === 'customization' && user.role === 'regional' && (
          <RegionalCustomization />
        )}
      </main>

      <Footer isLoginPage={false} />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
