import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { SafeFormattedText } from './SafeFormattedText.tsx';

export const Footer: React.FC<{ isLoginPage?: boolean }> = ({ isLoginPage = false }) => {
  const { user, activeSchoolYear, footerConfig, logout } = useAuth();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  const defaultText = `**Department of Education Regional Office VIII (Eastern Visayas)**
Quality Assurance Division (QAD)
Government Center, Candahug, Palo, Leyte 6501
*Empowering Schools through Evidence-Based Quality Assurance and Self-Assessment.*`;

  const footerText = footerConfig?.footerText || defaultText;
  const supportEmail = footerConfig?.supportEmail || 'qad.region8@deped.gov.ph';
  const telephone = footerConfig?.telephone || '(053) 832-2997';
  const websiteUrl = footerConfig?.websiteUrl || 'https://region8.deped.gov.ph';
  const facebookUrl = footerConfig?.facebookUrl || 'https://www.facebook.com/DepEdROVIII';

  // Role display label
  const roleDisplay =
    user?.role === 'regional'
      ? 'Regional Administrator'
      : user?.role === 'division'
      ? 'Division Assessment Officer'
      : 'School Assessment Officer';

  // Scope display label
  const scopeDisplay =
    user?.role === 'regional'
      ? 'Regional Scope (All 13 Schools Divisions)'
      : user?.role === 'division'
      ? `Division of ${user.divisionName || 'Assigned Division'}`
      : `${user?.schoolName || 'School'} (${user?.schoolDepedId || 'DepEd ID'}) • ${user?.divisionName || ''}`;

  return (
    <footer className="mt-auto bg-dark text-white pt-4 pb-3 border-top border-secondary">
      {/* Context Tracker - Strictly logged in only */}
      {!isLoginPage && user && (
        <div className="container-fluid px-4 mb-4">
          <div
            className="p-3 rounded border border-secondary"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-primary text-uppercase px-2 py-1">
                  <i className="bi bi-shield-check me-1"></i> Logged In As
                </span>
                <span className="fw-bold fs-6 text-warning">{user.fullName}</span>
                <span className="text-secondary">({user.username})</span>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-3 small">
                <div>
                  <span className="text-secondary me-1">Role:</span>
                  <span className="fw-semibold text-white">{roleDisplay}</span>
                </div>
                <div className="vr bg-secondary d-none d-md-block"></div>
                <div>
                  <span className="text-secondary me-1">Organizational Scope:</span>
                  <span className="fw-semibold text-white">{scopeDisplay}</span>
                </div>
                <div className="vr bg-secondary d-none d-md-block"></div>
                <div>
                  <span className="text-secondary me-1">Active School Year:</span>
                  <span className="badge bg-success fw-bold">
                    {activeSchoolYear ? activeSchoolYear.name : 'No Active SY'}
                  </span>
                </div>
                <div className="vr bg-secondary d-none d-md-block"></div>
                <button
                  id="footer-logout-btn"
                  className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 py-1 px-2"
                  onClick={logout}
                  title="Logout of current session"
                >
                  <i className="bi bi-box-arrow-right"></i>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Footer Info */}
      <div className="container-fluid px-4">
        <div className="row g-4 align-items-center">
          {/* Logos Column */}
          <div className="col-12 col-md-4">
            <div className="d-flex flex-wrap align-items-center gap-3 overflow-hidden">
              {footerConfig?.firstWideLogo ? (
                <div className="overflow-hidden d-flex align-items-center rounded bg-white p-1">
                  <img
                    src={footerConfig.firstWideLogo}
                    alt="First Wide Logo"
                    className="img-fluid"
                    style={{ maxHeight: '55px', maxWidth: '200px', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div
                  className="bg-primary text-white d-flex align-items-center justify-content-center rounded p-2 fw-bold text-center"
                  style={{ minWidth: '120px', height: '48px', fontSize: '0.85rem' }}
                >
                  DepEd Region VIII
                </div>
              )}

              {footerConfig?.logo2 ? (
                <div className="overflow-hidden d-flex align-items-center rounded bg-white p-1">
                  <img
                    src={footerConfig.logo2}
                    alt="Logo 2"
                    className="img-fluid"
                    style={{ maxHeight: '50px', maxWidth: '100px', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div
                  className="bg-secondary text-white d-flex align-items-center justify-content-center rounded p-1 small text-center"
                  style={{ width: '48px', height: '48px' }}
                >
                  <i className="bi bi-award fs-4"></i>
                </div>
              )}

              {footerConfig?.logo3 ? (
                <div className="overflow-hidden d-flex align-items-center rounded bg-white p-1">
                  <img
                    src={footerConfig.logo3}
                    alt="Logo 3"
                    className="img-fluid"
                    style={{ maxHeight: '50px', maxWidth: '100px', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div
                  className="bg-danger text-white d-flex align-items-center justify-content-center rounded p-1 small text-center"
                  style={{ width: '48px', height: '48px' }}
                >
                  <i className="bi bi-star-fill fs-5"></i>
                </div>
              )}
            </div>
          </div>

          {/* Center Address & Custom Text */}
          <div className="col-12 col-md-5 text-light small">
            <SafeFormattedText text={footerText} />
            <div className="mt-2 text-secondary">
              <i className="bi bi-telephone me-1 text-primary"></i> {telephone} &nbsp;|&nbsp;
              <i className="bi bi-envelope me-1 text-danger"></i> {supportEmail}
            </div>
          </div>

          {/* Links & Compliance */}
          <div className="col-12 col-md-3 text-md-end">
            <div className="d-flex flex-column gap-1 small">
              <div>
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-decoration-none text-light hover-underline"
                >
                  <i className="bi bi-globe me-1 text-info"></i> DepEd RO8 Portal
                </a>
              </div>
              <div>
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-decoration-none text-light hover-underline"
                >
                  <i className="bi bi-facebook me-1 text-primary"></i> Official Facebook
                </a>
              </div>
              <div className="mt-2 pt-2 border-top border-secondary d-flex flex-wrap gap-2 justify-content-md-end">
                <button
                  className="btn btn-link btn-sm p-0 text-secondary text-decoration-none"
                  onClick={() => setShowPrivacyModal(true)}
                >
                  Data Privacy
                </button>
                <span className="text-secondary">•</span>
                <button
                  className="btn btn-link btn-sm p-0 text-secondary text-decoration-none"
                  onClick={() => setShowTermsModal(true)}
                >
                  Terms
                </button>
                <span className="text-secondary">•</span>
                <button
                  className="btn btn-link btn-sm p-0 text-secondary text-decoration-none"
                  onClick={() => setShowManualModal(true)}
                >
                  User Manual
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="border-top border-secondary mt-3 pt-2 d-flex flex-wrap justify-content-between align-items-center text-secondary small">
          <div>
            &copy; {new Date().getFullYear()} DepEd Regional Office VIII • Project SBM Online Version 2.4 (Enterprise Edition)
          </div>
          <div>Republic of the Philippines • Quality Assured Education Management</div>
        </div>
      </div>

      {/* Data Privacy Notice Modal */}
      {showPrivacyModal && (
        <div className="modal d-block text-dark" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-shield-lock me-2"></i> Data Privacy Notice (RA 10173)
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowPrivacyModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <h6 className="fw-bold">Department of Education Regional Office VIII</h6>
                <p className="small text-muted">
                  Project SBM Online is compliant with Republic Act No. 10173, also known as the Data Privacy Act of 2012.
                  All institutional assessment scores, Means of Verification (MOVs), remarks, school classifications, and personnel information collected through this platform are strictly used for official school-based management quality assurance, policy formulation, and educational technical assistance.
                </p>
                <h6 className="fw-bold mt-3">Security Controls & Authorization</h6>
                <p className="small text-muted">
                  User accounts are strictly role-segregated. Regional administrators, Division assessment coordinators, and School heads are authorized only within their designated administrative scopes. Passwords are encrypted using irreversible salted hashing algorithms, and all administrative actions are permanently logged to the system audit repository.
                </p>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPrivacyModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Use Modal */}
      {showTermsModal && (
        <div className="modal d-block text-dark" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-secondary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-journal-text me-2"></i> Terms of Use
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowTermsModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <h6 className="fw-bold">Official Government Portal Usage</h6>
                <p className="small text-muted">
                  By logging into Project SBM Online, users represent that they are duly authorized school personnel or DepEd education program supervisors. Users shall ensure the truthfulness and accuracy of all self-assessment scores and validate evidence prior to submission. Submissions become official records upon final submission.
                </p>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowTermsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Manual Modal */}
      {showManualModal && (
        <div className="modal d-block text-dark" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-book me-2"></i> User Manual & System Guide
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowManualModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <h6 className="fw-bold text-primary">1. School Users:</h6>
                <ul className="small text-muted">
                  <li>Navigate to <strong>SBM Assessment</strong> to rate indicators for the active school year.</li>
                  <li>Click <strong>Save Draft</strong> at any time to preserve current ratings.</li>
                  <li>When all required indicators and remarks are completed, click <strong>Submit Assessment</strong>.</li>
                  <li>Review previous school years in <strong>Assessment History</strong>.</li>
                </ul>
                <h6 className="fw-bold text-primary mt-3">2. Division Users:</h6>
                <ul className="small text-muted">
                  <li>Access <strong>Monitoring & Reports</strong> to track schools in your division.</li>
                  <li>Use <strong>School Accounts</strong> to add schools, reset passwords, or batch-import from CSV.</li>
                  <li>Export complete division assessment sheets via <strong>Excel Export</strong>.</li>
                </ul>
                <h6 className="fw-bold text-primary mt-3">3. Regional Administrators:</h6>
                <ul className="small text-muted">
                  <li>Manage school years, clone forms, and publish assessment frameworks in <strong>School Years</strong> and <strong>Form Builder</strong>.</li>
                  <li>Configure regional branding, login announcements, and custom footers in <strong>Customization</strong>.</li>
                  <li>Monitor all 13 divisions and consolidated regional indicators in real time.</li>
                </ul>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowManualModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
