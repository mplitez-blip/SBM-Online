import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  const { user, activeSchoolYear, systemConfig, logout, refreshProfile, apiFetch } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // Profile state
  const [profileName, setProfileName] = useState(user?.fullName || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [schoolHead, setSchoolHead] = useState(user?.schoolHead || '');
  const [classification, setClassification] = useState(user?.schoolClassification || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const siteTitle = systemConfig?.siteTitle || 'Project SBM Online';
  const regionTitle = systemConfig?.regionTitle || 'Department of Education Regional Office VIII';
  const primaryColor = systemConfig?.primaryColor || '#0038a8';
  const accentColor = systemConfig?.accentColor || '#ce1126';

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters long.');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwdError(data.error || 'Failed to change password.');
      } else {
        setPwdSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setShowPasswordModal(false), 1500);
      }
    } catch (err: any) {
      setPwdError('Network error. Please try again.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

    try {
      const payload: any = { fullName: profileName, email: profileEmail };
      if (user?.role === 'school') {
        payload.schoolHead = schoolHead;
        payload.classification = classification;
      }

      const res = await apiFetch('/api/auth/update-profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || 'Failed to update profile.');
      } else {
        setProfileSuccess('Profile updated successfully.');
        await refreshProfile();
        setTimeout(() => setShowProfileModal(false), 1500);
      }
    } catch (err: any) {
      setProfileError('Failed to save profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <header className="border-bottom shadow-sm bg-white sticky-top">
      {/* Top Republic & Department bar */}
      <div style={{ backgroundColor: primaryColor }} className="text-white py-1 px-3">
        <div className="container-fluid d-flex justify-content-between align-items-center small">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-semibold">Republic of the Philippines</span>
            <span className="opacity-50">|</span>
            <span>Department of Education • Regional Office VIII</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            {activeSchoolYear && (
              <span className="badge bg-warning text-dark px-2 py-1 fw-bold">
                <i className="bi bi-calendar3 me-1"></i>
                Active SY: {activeSchoolYear.name}
              </span>
            )}
            <span className="text-white-50">DepEd RO8 Quality Assurance Division</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white py-2 px-3">
        <div className="container-fluid">
          {/* Brand & Logo */}
          <div
            className="navbar-brand d-flex align-items-center gap-2 text-decoration-none cursor-pointer"
            onClick={() => onNavigate('dashboard')}
            style={{ cursor: 'pointer' }}
          >
            {systemConfig?.navbarLogo ? (
              <img
                src={systemConfig.navbarLogo}
                alt="Logo"
                style={{ height: '42px', maxWidth: '140px', objectFit: 'contain' }}
              />
            ) : (
              <div
                className="d-flex align-items-center justify-content-center rounded text-white fw-bold"
                style={{ width: '42px', height: '42px', backgroundColor: primaryColor }}
              >
                RO8
              </div>
            )}
            <div>
              <div className="fw-bold text-dark lh-1" style={{ fontSize: '1.15rem' }}>
                {siteTitle}
              </div>
              <div className="text-muted small" style={{ fontSize: '0.78rem' }}>
                {regionTitle}
              </div>
            </div>
          </div>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarContent"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navbarContent">
            {/* Nav Links based on Role */}
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3 gap-1">
              <li className="nav-item">
                <button
                  className={`nav-link btn btn-link text-decoration-none px-3 py-1 rounded ${
                    currentView === 'dashboard' ? 'active fw-bold text-primary bg-light' : 'text-secondary'
                  }`}
                  onClick={() => onNavigate('dashboard')}
                >
                  <i className="bi bi-speedometer2 me-1"></i> Dashboard
                </button>
              </li>

              {/* School user views */}
              {user?.role === 'school' && (
                <>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn btn-link text-decoration-none px-3 py-1 rounded ${
                        currentView === 'assessment' ? 'active fw-bold text-primary bg-light' : 'text-secondary'
                      }`}
                      onClick={() => onNavigate('assessment')}
                    >
                      <i className="bi bi-ui-checks me-1"></i> SBM Assessment
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn btn-link text-decoration-none px-3 py-1 rounded ${
                        currentView === 'history' ? 'active fw-bold text-primary bg-light' : 'text-secondary'
                      }`}
                      onClick={() => onNavigate('history')}
                    >
                      <i className="bi bi-clock-history me-1"></i> Assessment History
                    </button>
                  </li>
                </>
              )}

              {/* Division & Regional views */}
              {(user?.role === 'regional' || user?.role === 'division') && (
                <li className="nav-item">
                  <button
                    className={`nav-link btn btn-link text-decoration-none px-3 py-1 rounded ${
                      currentView === 'monitoring' ? 'active fw-bold text-primary bg-light' : 'text-secondary'
                    }`}
                    onClick={() => onNavigate('monitoring')}
                  >
                    <i className="bi bi-table me-1"></i> Monitoring & Reports
                  </button>
                </li>
              )}

              {user?.role === 'division' && (
                <li className="nav-item">
                  <button
                    className={`nav-link btn btn-link text-decoration-none px-3 py-1 rounded ${
                      currentView === 'schools' ? 'active fw-bold text-primary bg-light' : 'text-secondary'
                    }`}
                    onClick={() => onNavigate('schools')}
                  >
                    <i className="bi bi-buildings me-1"></i> School Accounts
                  </button>
                </li>
              )}

              {/* Regional only views */}
              {user?.role === 'regional' && (
                <>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn btn-link text-decoration-none px-3 py-1 rounded ${
                        currentView === 'school-years' ? 'active fw-bold text-primary bg-light' : 'text-secondary'
                      }`}
                      onClick={() => onNavigate('school-years')}
                    >
                      <i className="bi bi-calendar-range me-1"></i> School Years
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn btn-link text-decoration-none px-3 py-1 rounded ${
                        currentView === 'form-builder' ? 'active fw-bold text-primary bg-light' : 'text-secondary'
                      }`}
                      onClick={() => onNavigate('form-builder')}
                    >
                      <i className="bi bi-sliders me-1"></i> Form Builder
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn btn-link text-decoration-none px-3 py-1 rounded ${
                        currentView === 'schools' ? 'active fw-bold text-primary bg-light' : 'text-secondary'
                      }`}
                      onClick={() => onNavigate('schools')}
                    >
                      <i className="bi bi-people me-1"></i> Accounts & Data
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link btn btn-link text-decoration-none px-3 py-1 rounded ${
                        currentView === 'customization' ? 'active fw-bold text-primary bg-light' : 'text-secondary'
                      }`}
                      onClick={() => onNavigate('customization')}
                    >
                      <i className="bi bi-palette me-1"></i> Customization
                    </button>
                  </li>
                </>
              )}
            </ul>

            {/* User Profile & Actions */}
            <div className="d-flex align-items-center gap-2">
              <div className="text-end me-2 d-none d-md-block">
                <div className="fw-semibold text-dark small">{user?.fullName}</div>
                <div className="text-muted text-uppercase" style={{ fontSize: '0.72rem' }}>
                  <span
                    className={`badge ${
                      user?.role === 'regional'
                        ? 'bg-danger'
                        : user?.role === 'division'
                        ? 'bg-primary'
                        : 'bg-success'
                    }`}
                  >
                    {user?.role === 'regional' ? 'Regional Office Admin' : user?.role === 'division' ? 'Division Admin' : 'School Portal'}
                  </span>{' '}
                  {user?.divisionName && <span>• {user.divisionName}</span>}
                </div>
              </div>

              <div className="dropdown">
                <button
                  className="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-1"
                  type="button"
                  id="userDropdown"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <i className="bi bi-person-circle fs-5"></i>
                </button>
                <ul className="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="userDropdown">
                  <li className="px-3 py-2 border-bottom">
                    <div className="fw-bold">{user?.fullName}</div>
                    <div className="text-muted small">{user?.username}</div>
                    {user?.schoolDepedId && (
                      <div className="text-muted small">School ID: {user.schoolDepedId}</div>
                    )}
                  </li>
                  <li>
                    <button
                      className="dropdown-item py-2"
                      onClick={() => {
                        setProfileName(user?.fullName || '');
                        setProfileEmail(user?.email || '');
                        setSchoolHead(user?.schoolHead || '');
                        setClassification(user?.schoolClassification || '');
                        setShowProfileModal(true);
                      }}
                    >
                      <i className="bi bi-person-gear me-2"></i> Account Profile
                    </button>
                  </li>
                  <li>
                    <button
                      className="dropdown-item py-2"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      <i className="bi bi-key me-2"></i> Change Password
                    </button>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item py-2 text-danger" onClick={logout}>
                      <i className="bi bi-box-arrow-right me-2"></i> Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-light">
                <h5 className="modal-title">
                  <i className="bi bi-key me-2 text-primary"></i> Change Password
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPasswordModal(false)}
                ></button>
              </div>
              <form onSubmit={handlePasswordSubmit}>
                <div className="modal-body">
                  {pwdError && <div className="alert alert-danger py-2 small">{pwdError}</div>}
                  {pwdSuccess && <div className="alert alert-success py-2 small">{pwdSuccess}</div>}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Current Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">New Password (min. 8 characters)</label>
                    <input
                      type="password"
                      className="form-control"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Confirm New Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPasswordModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={pwdLoading}
                  >
                    {pwdLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Account Profile Modal */}
      {showProfileModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-light">
                <h5 className="modal-title">
                  <i className="bi bi-person-circle me-2 text-primary"></i> Account Profile
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowProfileModal(false)}
                ></button>
              </div>
              <form onSubmit={handleProfileSubmit}>
                <div className="modal-body">
                  {profileError && <div className="alert alert-danger py-2 small">{profileError}</div>}
                  {profileSuccess && <div className="alert alert-success py-2 small">{profileSuccess}</div>}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Username</label>
                    <input type="text" className="form-control bg-light" value={user?.username} disabled />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Full Name / Account Officer</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                    />
                  </div>

                  {user?.role === 'school' && (
                    <>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">School ID</label>
                        <input type="text" className="form-control bg-light" value={user.schoolDepedId || ''} disabled />
                        <span className="text-muted small">School ID is permanently assigned by DepEd.</span>
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">School Name</label>
                        <input type="text" className="form-control bg-light" value={user.schoolName || ''} disabled />
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">District</label>
                        <input type="text" className="form-control bg-light" value={user.schoolDistrict || ''} disabled />
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">School Head Name (Editable)</label>
                        <input
                          type="text"
                          className="form-control"
                          value={schoolHead}
                          onChange={(e) => setSchoolHead(e.target.value)}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Classification (Editable)</label>
                        <select
                          className="form-select"
                          value={classification}
                          onChange={(e) => setClassification(e.target.value)}
                        >
                          <option value="Elementary">Elementary</option>
                          <option value="Integrated School">Integrated School</option>
                          <option value="Secondary (JHS with SHS)">Secondary (JHS with SHS)</option>
                          <option value="Junior High School">Junior High School</option>
                          <option value="Senior High School">Senior High School</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowProfileModal(false)}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={profileLoading}
                  >
                    {profileLoading ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
