import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Footer } from '../common/Footer.tsx';
import { SafeFormattedText } from '../common/SafeFormattedText.tsx';

export const LoginPage: React.FC = () => {
  const { login, loginConfig, systemConfig } = useAuth();
  // Select School by default when the page first loads; preserved on validation failure
  const [accountType, setAccountType] = useState<'regional' | 'division' | 'school'>('school');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Appearance values
  const primaryColor = loginConfig?.primaryColor || '#0038a8';
  const gradientColor = loginConfig?.gradientColor || '#001a4e';
  const accentColor = loginConfig?.accentColor || '#ce1126';
  const loginPanelColor = loginConfig?.loginPanelColor || '#ffffff';
  const showFooter = loginConfig?.showFullFooter !== undefined ? loginConfig.showFullFooter : true;

  const eyebrow = loginConfig?.eyebrowText || 'DEPARTMENT OF EDUCATION • REGIONAL OFFICE VIII';
  const heading = loginConfig?.mainHeading || 'Project SBM Online';
  const description =
    loginConfig?.description ||
    'Role-based School-Based Management self-assessment, monitoring, administration, and reporting platform for DepEd Eastern Visayas.';
  const formTitle = loginConfig?.loginFormTitle || 'Sign In to Portal';
  const formDescription =
    loginConfig?.loginFormDescription || 'Select your account type and enter your DepEd assigned credentials.';
  const announcement = loginConfig?.publicAnnouncement;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType, username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please check your credentials.');
      } else {
        await login(data.token);
      }
    } catch (err: any) {
      setError('Network connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <div className="flex-grow-1 d-flex align-items-center py-4 py-md-5">
        <div className="container">
          <div className="row g-0 rounded-4 shadow-lg overflow-hidden border border-light-subtle">
            {/* Left Brand Panel */}
            <div
              className="col-lg-7 p-4 p-md-5 text-white d-flex flex-column justify-content-between position-relative"
              style={{
                background: loginConfig?.brandPanelBg
                  ? `linear-gradient(135deg, ${primaryColor}ee 0%, ${gradientColor}ee 100%), url(${loginConfig.brandPanelBg}) center/cover no-repeat`
                  : `linear-gradient(135deg, ${primaryColor} 0%, ${gradientColor} 100%)`,
                minHeight: '480px',
              }}
            >
              {/* Subtle government emblem watermark overlay */}
              <div
                className="position-absolute end-0 bottom-0 opacity-10 pointer-events-none p-4"
                style={{ fontSize: '18rem', lineHeight: 0, transform: 'translate(15%, 15%)' }}
              >
                <i className="bi bi-shield-shaded"></i>
              </div>

              {/* Brand Top */}
              <div className="position-relative z-1">
                <div className="d-flex align-items-center gap-3 mb-4">
                  {loginConfig?.loginLogo ? (
                    <div className="overflow-hidden rounded bg-white p-1 d-flex align-items-center">
                      <img
                        src={loginConfig.loginLogo}
                        alt="Portal Logo"
                        className="img-fluid"
                        style={{ maxHeight: '60px', maxWidth: '140px', objectFit: 'contain' }}
                      />
                    </div>
                  ) : (
                    <div
                      className="rounded bg-white text-primary d-flex align-items-center justify-content-center shadow-sm"
                      style={{ width: '56px', height: '56px' }}
                    >
                      <i className="bi bi-mortarboard-fill fs-2"></i>
                    </div>
                  )}
                  <div>
                    <span className="badge bg-warning text-dark fw-bold text-uppercase px-2 py-1">
                      Official Portal
                    </span>
                    <div className="text-white-50 small mt-1">Republic of the Philippines</div>
                  </div>
                </div>

                <div className="text-warning small text-uppercase tracking-wider fw-bold mb-2">
                  {eyebrow}
                </div>
                <h1 className="display-6 fw-bold mb-3 text-white">{heading}</h1>
                <div className="lead fs-6 text-white-75 mb-4" style={{ maxWidth: '540px' }}>
                  <SafeFormattedText text={description} />
                </div>

                {/* Public announcement if present */}
                {announcement && (
                  <div
                    className="p-3 rounded-3 mb-4 border border-warning-subtle"
                    style={{ backgroundColor: 'rgba(255, 193, 7, 0.15)' }}
                  >
                    <div className="d-flex align-items-center gap-2 text-warning fw-semibold small mb-1">
                      <i className="bi bi-megaphone-fill"></i> Public Advisory / Announcement
                    </div>
                    <div className="small text-white">
                      <SafeFormattedText text={announcement} />
                    </div>
                  </div>
                )}
              </div>


            </div>

            {/* Right Login Form Card */}
            <div
              className="col-lg-5 p-4 p-md-5 d-flex flex-column justify-content-center"
              style={{ backgroundColor: loginPanelColor }}
            >
              <div className="mb-4">
                <h2 className="h4 fw-bold text-dark mb-1">{formTitle}</h2>
                <p className="text-muted small mb-0">{formDescription}</p>
              </div>

              {error && (
                <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-exclamation-triangle-fill fs-6 flex-shrink-0"></i>
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleLogin}>
                {/* Account Type Selector */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">
                    Account Type <span className="text-danger">*</span>
                  </label>
                  <div className="btn-group w-full" role="group" aria-label="Account Type">
                    <button
                      type="button"
                      className={`btn btn-sm ${accountType === 'regional' ? 'btn-primary active' : 'btn-outline-secondary'}`}
                      onClick={() => setAccountType('regional')}
                    >
                      <i className="bi bi-building me-1"></i> Regional
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${accountType === 'division' ? 'btn-primary active' : 'btn-outline-secondary'}`}
                      onClick={() => setAccountType('division')}
                    >
                      <i className="bi bi-diagram-3 me-1"></i> Division
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${accountType === 'school' ? 'btn-primary active' : 'btn-outline-secondary'}`}
                      onClick={() => setAccountType('school')}
                    >
                      <i className="bi bi-mortarboard me-1"></i> School
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">
                    {accountType === 'school' ? 'DepEd School ID or Username' : 'Username'}{' '}
                    <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-person text-muted"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder={
                        accountType === 'school'
                          ? 'Enter 6-digit School ID or username'
                          : accountType === 'division'
                          ? 'Enter Division username'
                          : 'Enter Regional username'
                      }
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-semibold text-secondary">
                    Password <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-lock text-muted"></i>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control border-start-0 border-end-0 ps-0"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="input-group-text bg-light border-start-0 text-muted"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full py-2 fw-semibold shadow-sm d-flex align-items-center justify-content-center gap-2"
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Signing In...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-box-arrow-in-right"></i> Sign In to SBM Portal
                    </>
                  )}
                </button>
              </form>

              {/* Security notice (No passwords exposed) */}
              <div className="mt-4 pt-3 border-top">
                <div className="d-flex align-items-start gap-2 text-muted" style={{ fontSize: '0.75rem' }}>
                  <i className="bi bi-shield-lock-fill text-primary mt-1"></i>
                  <div>
                    <strong>Official DepEd SBM System:</strong> Public registration is disabled. Accounts are provisioned and managed by Regional and Division Administrators. All login attempts and operations are audited.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Show full customized footer if enabled */}
      {showFooter && <Footer isLoginPage={true} />}
    </div>
  );
};
