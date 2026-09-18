import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ManageAccountModal } from '../profile/ManageAccountModal.tsx';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, activeSchoolYear, loginConfig, systemConfig, logout } = useAuth();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const primaryColor = systemConfig?.primaryColor || loginConfig?.primaryColor || '#0038a8';
  const siteTitle = systemConfig?.siteTitle || 'Project SBM Online';
  const regionTitle = systemConfig?.regionTitle || 'DepEd Regional Office VIII';
  const navbarLogo = systemConfig?.navbarLogo || loginConfig?.loginLogo;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleBadgeLabel =
    user?.role === 'regional'
      ? 'Regional Office'
      : user?.role === 'division'
      ? 'Division SDO'
      : 'School';

  const roleBadgeClass =
    user?.role === 'regional'
      ? 'bg-danger'
      : user?.role === 'division'
      ? 'bg-info text-dark'
      : 'bg-success';

  const handleLinkClick = (view: string) => {
    setIsNavOpen(false);
    setAccountDropdownOpen(false);
    onNavigate(view);
  };

  return (
    <>
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
            onClick={() => handleLinkClick('dashboard')}
          >
            {navbarLogo ? (
              <img
                src={navbarLogo}
                alt="Logo"
                style={{ maxHeight: '36px', maxWidth: '120px', objectFit: 'contain' }}
                className="rounded bg-white p-1 img-fluid"
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
              <div className="fw-bold fs-6 lh-1">{siteTitle}</div>
              <div className="text-white-50 small lh-1 mt-1" style={{ fontSize: '0.68rem' }}>
                {regionTitle}
              </div>
            </div>
          </button>

          {/* Mobile Right Controls: Quick Account & Hamburger Toggle */}
          <div className="d-flex align-items-center gap-2 d-lg-none">
            <button
              id="mobile-account-btn"
              className="btn btn-outline-light btn-sm d-flex align-items-center gap-1 py-1 px-2 rounded-pill"
              onClick={() => setShowAccountModal(true)}
              title="Manage Account"
            >
              {user?.logo ? (
                <img
                  src={user.logo}
                  alt="Avatar"
                  className="rounded-circle border bg-white"
                  style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                />
              ) : (
                <i className="bi bi-person-circle"></i>
              )}
              <span className="small text-truncate" style={{ maxWidth: '80px' }}>
                {user?.fullName?.split(' ')[0]}
              </span>
            </button>
            <button
              className="navbar-toggler border-0 p-1"
              type="button"
              onClick={() => setIsNavOpen(!isNavOpen)}
              aria-controls="navbarContent"
              aria-expanded={isNavOpen}
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>
          </div>

          <div className={`collapse navbar-collapse ${isNavOpen ? 'show' : ''}`} id="navbarContent">
            {/* Navigation Links according to role */}
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3">
              {/* Common Dashboard */}
              <li className="nav-item">
                <button
                  className={`nav-link btn btn-link text-decoration-none text-start ${
                    currentView === 'dashboard' ? 'active fw-bold text-white' : 'text-white-75'
                  }`}
                  onClick={() => handleLinkClick('dashboard')}
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
                      onClick={() => handleLinkClick('assessment')}
                    >
                      <i className="bi bi-pencil-square me-1"></i> SBM Assessment
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn btn-link text-decoration-none text-start ${
                        currentView === 'history' ? 'active fw-bold text-white' : 'text-white-75'
                      }`}
                      onClick={() => handleLinkClick('history')}
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
                    onClick={() => handleLinkClick('monitoring')}
                  >
                    <i className="bi bi-table me-1"></i> Monitoring & Reports
                  </button>
                </li>
              )}

              {/* Regional Exclusive: Division Accounts */}
              {user?.role === 'regional' && (
                <li className="nav-item">
                  <button
                    id="nav-divisions-link"
                    className={`nav-link btn btn-link text-decoration-none text-start ${
                      currentView === 'divisions' ? 'active fw-bold text-white' : 'text-white-75'
                    }`}
                    onClick={() => handleLinkClick('divisions')}
                  >
                    <i className="bi bi-building-gear me-1"></i> Division Accounts
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
                    onClick={() => handleLinkClick('schools')}
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
                      onClick={() => handleLinkClick('school-years')}
                    >
                      <i className="bi bi-calendar-range me-1"></i> School Years
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn btn-link text-decoration-none text-start ${
                        currentView === 'form-builder' ? 'active fw-bold text-white' : 'text-white-75'
                      }`}
                      onClick={() => handleLinkClick('form-builder')}
                    >
                      <i className="bi bi-sliders me-1"></i> Form Builder
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn btn-link text-decoration-none text-start ${
                        currentView === 'customization' ? 'active fw-bold text-white' : 'text-white-75'
                      }`}
                      onClick={() => handleLinkClick('customization')}
                    >
                      <i className="bi bi-palette me-1"></i> Customization
                    </button>
                  </li>
                </>
              )}
            </ul>

            {/* Right User & Active Year Status */}
            <div className="d-flex flex-wrap align-items-center gap-3">
              {/* Active SY Indicator */}
              <div className="d-flex align-items-center gap-1 text-white-75 small">
                <span>Active SY:</span>
                <span className="badge bg-warning text-dark fw-bold">
                  {activeSchoolYear ? activeSchoolYear.name : 'None'}
                </span>
              </div>

              {/* Unified Account Dropdown replacing separate role badge and logout button */}
              <div className="position-relative" ref={dropdownRef}>
                <button
                  id="account-dropdown-toggle"
                  className="btn btn-outline-light d-flex align-items-center gap-2 py-1 px-2 px-md-3 rounded-pill shadow-sm"
                  type="button"
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  aria-expanded={accountDropdownOpen}
                >
                  {user?.logo ? (
                    <img
                      src={user.logo}
                      alt="Logo"
                      className="rounded-circle border bg-white"
                      style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div
                      className="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center fw-bold"
                      style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}
                    >
                      {user?.fullName?.charAt(0) || 'U'}
                    </div>
                  )}

                  <div className="text-start d-none d-sm-block pe-1">
                    <div
                      className="fw-semibold text-white small lh-1 text-truncate"
                      style={{ maxWidth: '140px' }}
                    >
                      {user?.fullName}
                    </div>
                    <div className="text-white-50 mt-1 lh-1" style={{ fontSize: '0.65rem' }}>
                      {roleBadgeLabel}
                    </div>
                  </div>

                  <i className="bi bi-chevron-down text-white-75 small"></i>
                </button>

                {accountDropdownOpen && (
                  <div
                    className="dropdown-menu dropdown-menu-end show position-absolute shadow-lg border-0 rounded-3 mt-2 py-2"
                    style={{
                      right: 0,
                      minWidth: '240px',
                      zIndex: 1050,
                    }}
                  >
                    {/* User Header */}
                    <div className="px-3 py-2 border-bottom">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        {user?.logo ? (
                          <img
                            src={user.logo}
                            alt="Logo"
                            className="rounded border bg-light"
                            style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                          />
                        ) : (
                          <div
                            className="rounded bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold"
                            style={{ width: '36px', height: '36px' }}
                          >
                            {user?.fullName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div className="text-truncate">
                          <div className="fw-bold text-dark small text-truncate">{user?.fullName}</div>
                          <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                            @{user?.username}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className={`badge ${roleBadgeClass} text-uppercase px-2 py-1`}>
                          {roleBadgeLabel}
                        </span>
                        <span className="text-muted small ms-2" style={{ fontSize: '0.72rem' }}>
                          {user?.role === 'school'
                            ? user.schoolName
                            : user?.role === 'division'
                            ? user.divisionName
                            : 'DepEd Region VIII'}
                        </span>
                      </div>
                    </div>

                    {/* Account Options */}
                    <button
                      id="account-profile-btn"
                      className="dropdown-item py-2 d-flex align-items-center gap-2 text-dark"
                      type="button"
                      onClick={() => {
                        setAccountDropdownOpen(false);
                        setShowAccountModal(true);
                      }}
                    >
                      <i className="bi bi-person-gear text-primary fs-6"></i>
                      <span>Profile & Account Settings</span>
                    </button>

                    <div className="dropdown-divider my-1"></div>

                    <button
                      id="account-logout-btn"
                      className="dropdown-item py-2 d-flex align-items-center gap-2 text-danger"
                      type="button"
                      onClick={() => {
                        setAccountDropdownOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                    >
                      <i className="bi bi-box-arrow-right fs-6"></i>
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Drawer Logout Action */}
            <div className="d-lg-none mt-3 pt-3 border-top border-white-25 w-100">
              <div className="d-flex align-items-center justify-content-between mb-2 text-white small">
                <span>Signed in as: <strong>{user?.fullName}</strong></span>
                <span className={`badge ${roleBadgeClass} text-uppercase`}>{roleBadgeLabel}</span>
              </div>
              <div className="d-grid gap-2">
                <button
                  className="btn btn-outline-light btn-sm d-flex align-items-center justify-content-center gap-2"
                  onClick={() => {
                    setIsNavOpen(false);
                    setShowAccountModal(true);
                  }}
                >
                  <i className="bi bi-person-gear"></i> Manage Account
                </button>
                <button
                  id="mobile-drawer-logout-btn"
                  className="btn btn-danger btn-sm d-flex align-items-center justify-content-center gap-2 shadow-sm py-2"
                  onClick={() => {
                    setIsNavOpen(false);
                    setShowLogoutConfirm(true);
                  }}
                >
                  <i className="bi bi-box-arrow-right"></i>
                  <span className="fw-bold">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Profile & Account Management Modal */}
      <ManageAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
      />

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '420px' }}>
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-light border-bottom">
                <h5 className="modal-title fs-6 fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-box-arrow-right text-danger"></i> Confirm Sign Out
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowLogoutConfirm(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="bg-danger bg-opacity-10 text-danger rounded-circle d-inline-flex p-3 mb-3">
                  <i className="bi bi-person-x-fill fs-2"></i>
                </div>
                <h6 className="fw-bold text-dark mb-2">Are you sure you want to sign out?</h6>
                <p className="text-muted small mb-0">
                  You will be signed out of your account (<strong>{user?.username}</strong> - {user?.fullName}). You can sign back in anytime.
                </p>
              </div>
              <div className="modal-footer bg-light border-top d-flex justify-content-end gap-2 p-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-3"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  id="confirm-logout-btn"
                  type="button"
                  className="btn btn-danger btn-sm px-3 d-flex align-items-center gap-1 shadow-sm fw-semibold"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    logout();
                  }}
                >
                  <i className="bi bi-box-arrow-right"></i> Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

