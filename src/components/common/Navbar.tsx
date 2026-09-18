import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, activeSchoolYear, loginConfig, logout } = useAuth();

  const primaryColor = loginConfig?.primaryColor || '#0038a8';

  const roleBadge =
    user?.role === 'regional' ? (
      <span className="badge bg-danger text-uppercase px-2 py-1">Regional Office</span>
    ) : user?.role === 'division' ? (
      <span className="badge bg-info text-dark text-uppercase px-2 py-1">Division SDO</span>
    ) : (
      <span className="badge bg-success text-uppercase px-2 py-1">School</span>
    );

  return (
    <nav
      className="navbar navbar-expand-lg navbar-dark shadow-sm sticky-top"
      style={{
        backgroundColor: primaryColor,
        backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, #001a4e 100%)`,
      }}
    >
      <div className="container-fluid px-3 px-md-4">
        {/* Brand */}
        <button
          className="navbar-brand d-flex align-items-center gap-2 btn btn-link text-decoration-none text-white p-0"
          onClick={() => onNavigate('dashboard')}
        >
          {loginConfig?.loginLogo ? (
            <img
              src={loginConfig.loginLogo}
              alt="Logo"
              style={{ maxHeight: '36px', maxWidth: '100px', objectFit: 'contain' }}
              className="rounded bg-white p-1"
            />
          ) : (
            <div
              className="rounded bg-white text-primary d-flex align-items-center justify-content-center fw-bold"
              style={{ width: '36px', height: '36px' }}
            >
              <i className="bi bi-mortarboard-fill fs-5"></i>
            </div>
          )}
          <div className="text-start">
            <div className="fw-bold fs-6 lh-1">Project SBM Online</div>
            <div className="text-white-50 small lh-1" style={{ fontSize: '0.68rem' }}>
              DepEd Regional Office VIII
            </div>
          </div>
        </button>

        {/* Mobile Toggle */}
        <button
          className="navbar-toggler border-0"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarContent"
          aria-controls="navbarContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarContent">
          {/* Navigation Links according to role */}
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3">
            {/* Common Dashboard */}
            <li className="nav-item">
              <button
                className={`nav-link btn btn-link text-decoration-none text-start ${
                  currentView === 'dashboard' ? 'active fw-bold text-white' : 'text-white-75'
                }`}
                onClick={() => onNavigate('dashboard')}
              >
                <i className="bi bi-speedometer2 me-1"></i> Dashboard
              </button>
            </li>

            {/* School Role Links */}
            {user?.role === 'school' && (
              <>
                <li className="nav-item">
                  <button
                    className={`nav-link btn btn-link text-decoration-none text-start ${
                      currentView === 'assessment' ? 'active fw-bold text-white' : 'text-white-75'
                    }`}
                    onClick={() => onNavigate('assessment')}
                  >
                    <i className="bi bi-pencil-square me-1"></i> SBM Assessment
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link btn btn-link text-decoration-none text-start ${
                      currentView === 'history' ? 'active fw-bold text-white' : 'text-white-75'
                    }`}
                    onClick={() => onNavigate('history')}
                  >
                    <i className="bi bi-clock-history me-1"></i> Assessment History
                  </button>
                </li>
              </>
            )}

            {/* Division & Regional Monitoring */}
            {(user?.role === 'division' || user?.role === 'regional') && (
              <li className="nav-item">
                <button
                  className={`nav-link btn btn-link text-decoration-none text-start ${
                    currentView === 'monitoring' ? 'active fw-bold text-white' : 'text-white-75'
                  }`}
                  onClick={() => onNavigate('monitoring')}
                >
                  <i className="bi bi-table me-1"></i> Monitoring & Reports
                </button>
              </li>
            )}

            {/* Division & Regional School Accounts */}
            {(user?.role === 'division' || user?.role === 'regional') && (
              <li className="nav-item">
                <button
                  className={`nav-link btn btn-link text-decoration-none text-start ${
                    currentView === 'schools' ? 'active fw-bold text-white' : 'text-white-75'
                  }`}
                  onClick={() => onNavigate('schools')}
                >
                  <i className="bi bi-buildings me-1"></i> School Accounts
                </button>
              </li>
            )}

            {/* Regional Exclusive Modules */}
            {user?.role === 'regional' && (
              <>
                <li className="nav-item">
                  <button
                    className={`nav-link btn btn-link text-decoration-none text-start ${
                      currentView === 'school-years' ? 'active fw-bold text-white' : 'text-white-75'
                    }`}
                    onClick={() => onNavigate('school-years')}
                  >
                    <i className="bi bi-calendar-range me-1"></i> School Years
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link btn btn-link text-decoration-none text-start ${
                      currentView === 'form-builder' ? 'active fw-bold text-white' : 'text-white-75'
                    }`}
                    onClick={() => onNavigate('form-builder')}
                  >
                    <i className="bi bi-sliders me-1"></i> Form Builder
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link btn btn-link text-decoration-none text-start ${
                      currentView === 'customization' ? 'active fw-bold text-white' : 'text-white-75'
                    }`}
                    onClick={() => onNavigate('customization')}
                  >
                    <i className="bi bi-palette me-1"></i> Customization
                  </button>
                </li>
              </>
            )}
          </ul>

          {/* Right User & Active Year Status */}
          <div className="d-flex flex-wrap align-items-center gap-3">
            {/* Active SY Badge */}
            <div className="d-flex align-items-center gap-1 text-white-75 small">
              <span>Active SY:</span>
              <span className="badge bg-warning text-dark fw-bold">
                {activeSchoolYear ? activeSchoolYear.name : 'None'}
              </span>
            </div>

            {/* User Profile info */}
            <div className="d-flex align-items-center gap-2 border-start border-white-25 ps-3">
              <div className="text-end d-none d-sm-block">
                <div className="fw-semibold text-white small lh-1">{user?.fullName}</div>
                <div className="text-white-50 mt-1 lh-1" style={{ fontSize: '0.68rem' }}>
                  {user?.role === 'school'
                    ? user.schoolName
                    : user?.role === 'division'
                    ? user.divisionName
                    : 'Regional Quality Assurance'}
                </div>
              </div>

              {roleBadge}

              {/* Logout button */}
              <button
                className="btn btn-outline-light btn-sm ms-2 d-flex align-items-center gap-1"
                onClick={logout}
                title="Sign out of Project SBM Online"
              >
                <i className="bi bi-box-arrow-right"></i>
                <span className="d-none d-md-inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
