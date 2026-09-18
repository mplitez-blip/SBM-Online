import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { SafeFormattedText } from '../common/SafeFormattedText.tsx';

interface UploadMetadata {
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
}

export const RegionalCustomization: React.FC = () => {
  const { apiFetch, refreshProfile, refreshCustomization, systemConfig, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null);

  // Active Tab: system | login | footer
  const [activeTab, setActiveTab] = useState<'system' | 'login' | 'footer'>('system');

  // System Config State
  const [systemForm, setSystemForm] = useState({
    siteTitle: 'Project SBM Online',
    regionTitle: 'Department of Education Regional Office VIII',
    navbarLogo: '',
    favicon: '',
    baseFontSize: 15,
    primaryColor: '#0038a8',
    secondaryColor: '#495057',
    accentColor: '#ce1126',
    backgroundColor: '#f8f9fa',
  });

  // Login Config State
  const [loginForm, setLoginForm] = useState({
    eyebrowText: 'DEPARTMENT OF EDUCATION • REGIONAL OFFICE VIII',
    mainHeading: 'Project SBM Online',
    description:
      'A centralized School-Based Management Self-Assessment, Monitoring, Administration, and Reporting System for Eastern Visayas.',
    loginFormTitle: 'Sign In to SBM Portal',
    loginFormDescription: 'Enter your DepEd regional, division, or school credentials to access the system.',
    publicAnnouncement:
      'Official SBM self-assessment portal for Regional Office VIII. Validated data serves as the basis for school technical assistance and quality assurance.',
    loginLogo: '',
    brandPanelBg: '',
    primaryColor: '#0038a8',
    gradientColor: '#001a4e',
    accentColor: '#ce1126',
    loginPanelColor: '#ffffff',
    showFullFooter: true,
  });

  // Footer Config State
  const [footerForm, setFooterForm] = useState({
    firstWideLogo: '',
    logo2: '',
    logo3: '',
    footerText: `**Department of Education Regional Office VIII (Eastern Visayas)**
Quality Assurance Division (QAD)
Government Center, Candahug, Palo, Leyte 6501
*Empowering Schools through Evidence-Based Quality Assurance and Self-Assessment.*`,
    supportEmail: 'qad.region8@deped.gov.ph',
    telephone: '(053) 832-2997',
    dataPrivacyUrl: '#',
    termsUrl: '#',
    userManualUrl: '#',
    facebookUrl: 'https://www.facebook.com/DepEdROVIII',
    websiteUrl: 'https://region8.deped.gov.ph',
  });

  // Upload progress / active upload target
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    loadAllCustomizations();
  }, []);

  const loadAllCustomizations = async () => {
    setLoading(true);
    try {
      const [sysRes, loginRes, footerRes] = await Promise.all([
        apiFetch('/api/customization/system'),
        apiFetch('/api/customization/login'),
        apiFetch('/api/customization/footer'),
      ]);

      if (sysRes.ok) {
        const s = await sysRes.json();
        if (s) {
          setSystemForm({
            siteTitle: s.siteTitle || 'Project SBM Online',
            regionTitle: s.regionTitle || 'Department of Education Regional Office VIII',
            navbarLogo: s.navbarLogo || '',
            favicon: s.favicon || '',
            baseFontSize: s.baseFontSize || 15,
            primaryColor: s.primaryColor || '#0038a8',
            secondaryColor: s.secondaryColor || '#495057',
            accentColor: s.accentColor || '#ce1126',
            backgroundColor: s.backgroundColor || '#f8f9fa',
          });
        }
      }

      if (loginRes.ok) {
        const l = await loginRes.json();
        if (l) {
          setLoginForm({
            eyebrowText: l.eyebrowText || '',
            mainHeading: l.mainHeading || '',
            description: l.description || '',
            loginFormTitle: l.loginFormTitle || '',
            loginFormDescription: l.loginFormDescription || '',
            publicAnnouncement: l.publicAnnouncement || '',
            loginLogo: l.loginLogo || '',
            brandPanelBg: l.brandPanelBg || '',
            primaryColor: l.primaryColor || '#0038a8',
            gradientColor: l.gradientColor || '#001a4e',
            accentColor: l.accentColor || '#ce1126',
            loginPanelColor: l.loginPanelColor || '#ffffff',
            showFullFooter: l.showFullFooter !== undefined ? l.showFullFooter : true,
          });
        }
      }

      if (footerRes.ok) {
        const f = await footerRes.json();
        if (f) {
          setFooterForm({
            firstWideLogo: f.firstWideLogo || '',
            logo2: f.logo2 || '',
            logo3: f.logo3 || '',
            footerText: f.footerText || '',
            supportEmail: f.supportEmail || 'qad.region8@deped.gov.ph',
            telephone: f.telephone || '(053) 832-2997',
            dataPrivacyUrl: f.dataPrivacyUrl || '#',
            termsUrl: f.termsUrl || '#',
            userManualUrl: f.userManualUrl || '#',
            facebookUrl: f.facebookUrl || 'https://www.facebook.com/DepEdROVIII',
            websiteUrl: f.websiteUrl || 'https://region8.deped.gov.ph',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load customization:', err);
      setAlertMsg({ type: 'danger', text: 'Error loading current customization configuration.' });
    } finally {
      setLoading(false);
    }
  };

  // Secure File Upload Handler
  const handleUploadAsset = async (
    fieldKey: string,
    file: File,
    category: 'logo' | 'favicon' | 'background' | 'general',
    currentUrl: string,
    onSuccessUrl: (newUrl: string) => void
  ) => {
    // 1. Client-side security pre-check: prevent executables
    const disallowedExts = [
      '.exe', '.bat', '.cmd', '.sh', '.bin', '.js', '.php', '.py', '.pl', '.cgi',
      '.jar', '.vbs', '.ps1', '.scr', '.msi', '.apk', '.zip'
    ];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (disallowedExts.includes(ext)) {
      setAlertMsg({
        type: 'danger',
        text: `Security Warning: Executable and script uploads (${ext}) are strictly forbidden.`,
      });
      return;
    }

    // 2. MIME type pre-check
    if (!file.type.startsWith('image/')) {
      setAlertMsg({
        type: 'danger',
        text: `Invalid file type (${file.type}). Only image files (PNG, JPEG, WebP, SVG, ICO) are allowed.`,
      });
      return;
    }

    setUploadingField(fieldKey);
    setAlertMsg(null);

    try {
      const formData = new FormData();
      formData.append('assetFile', file);
      formData.append('category', category);
      if (currentUrl) {
        formData.append('replaceUrl', currentUrl);
      }

      const res = await apiFetch('/api/customization/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: data.error || 'Asset upload rejected by server.' });
      } else {
        onSuccessUrl(data.url);
        const meta: UploadMetadata = data.metadata;
        setAlertMsg({
          type: 'success',
          text: `Asset uploaded and validated (${meta.width}×${meta.height}px, ${(meta.sizeBytes / 1024).toFixed(1)} KB, ${meta.mimeType}). Previous file replaced safely.`,
        });
      }
    } catch (err: any) {
      setAlertMsg({ type: 'danger', text: 'Network error uploading asset. Please try again.' });
    } finally {
      setUploadingField(null);
    }
  };

  // Save System Settings
  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlertMsg(null);
    try {
      const res = await apiFetch('/api/customization/system', {
        method: 'PUT',
        body: JSON.stringify(systemForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: data.error || 'Failed to save system settings.' });
      } else {
        setAlertMsg({ type: 'success', text: 'System settings saved successfully. Theme & title updated.' });
        await refreshCustomization();
        await refreshProfile();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error saving system settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Save Login Settings
  const handleSaveLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlertMsg(null);
    try {
      const res = await apiFetch('/api/customization/login', {
        method: 'PUT',
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: data.error || 'Failed to save login settings.' });
      } else {
        setAlertMsg({ type: 'success', text: 'Login page appearance updated successfully.' });
        await refreshCustomization();
        await refreshProfile();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error saving login settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Save Footer Settings
  const handleSaveFooter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlertMsg(null);
    try {
      const res = await apiFetch('/api/customization/footer', {
        method: 'PUT',
        body: JSON.stringify(footerForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: data.error || 'Failed to save footer settings.' });
      } else {
        setAlertMsg({ type: 'success', text: 'Footer configuration updated successfully.' });
        await refreshCustomization();
        await refreshProfile();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error saving footer settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Subcomponent for responsive asset upload card
  const AssetUploadControl: React.FC<{
    fieldKey: string;
    label: string;
    description: string;
    category: 'logo' | 'favicon' | 'background' | 'general';
    currentUrl: string;
    isWide?: boolean;
    onUrlChange: (url: string) => void;
  }> = ({ fieldKey, label, description, category, currentUrl, isWide = false, onUrlChange }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isUploading = uploadingField === fieldKey;

    return (
      <div className="card border shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div className="fw-bold fs-6 text-dark">{label}</div>
              <div className="text-muted small">{description}</div>
            </div>
            {currentUrl && (
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                <i className="bi bi-check-circle me-1"></i> Active Asset
              </span>
            )}
          </div>

          {/* Responsive Preview Container - cannot overflow */}
          <div
            className="rounded border p-2 mb-3 bg-light d-flex align-items-center justify-content-center overflow-hidden position-relative"
            style={{
              minHeight: isWide ? '90px' : '80px',
              maxHeight: isWide ? '140px' : '110px',
              maxWidth: '100%',
            }}
          >
            {currentUrl ? (
              <img
                src={currentUrl}
                alt={label}
                className="img-fluid rounded"
                style={{
                  maxHeight: isWide ? '120px' : '90px',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div className="text-muted small text-center p-3">
                <i className="bi bi-image fs-3 d-block text-secondary opacity-50 mb-1"></i>
                No image uploaded yet
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <input
              type="file"
              ref={fileInputRef}
              className="d-none"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleUploadAsset(fieldKey, file, category, currentUrl, onUrlChange);
                  e.target.value = '';
                }
              }}
            />

            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Validating & Uploading...
                </>
              ) : (
                <>
                  <i className="bi bi-cloud-arrow-up me-1"></i>
                  {currentUrl ? 'Replace Image' : 'Upload Image'}
                </>
              )}
            </button>

            {currentUrl && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                disabled={isUploading}
                onClick={() => onUrlChange('')}
              >
                <i className="bi bi-trash me-1"></i> Remove
              </button>
            )}

            <div className="ms-auto text-muted small" style={{ fontSize: '0.72rem' }}>
              <i className="bi bi-shield-lock me-1 text-primary"></i>
              Validated MIME, size & dimensions
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary mb-3" role="status"></div>
        <div className="text-muted">Loading regional customization portal...</div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-3 px-md-4 py-4">
      {/* Top Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3 border-bottom pb-3">
        <div>
          <h2 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
            <i className="bi bi-palette-fill text-primary"></i> Regional Customization
          </h2>
          <div className="text-muted small">
            Configure system branding, login portal appearance, and footer accreditation for DepEd Regional Office VIII.
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-danger text-uppercase px-3 py-2">
            <i className="bi bi-shield-fill-check me-1"></i> Regional Admin Authority
          </span>
        </div>
      </div>

      {/* Alert Messages */}
      {alertMsg && (
        <div
          className={`alert alert-${alertMsg.type} alert-dismissible fade show d-flex align-items-center mb-4`}
          role="alert"
        >
          <i
            className={`bi me-2 fs-5 ${
              alertMsg.type === 'success'
                ? 'bi-check-circle-fill'
                : alertMsg.type === 'danger'
                ? 'bi-exclamation-triangle-fill'
                : 'bi-info-circle-fill'
            }`}
          ></i>
          <div className="flex-grow-1 small">{alertMsg.text}</div>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setAlertMsg(null)}
          ></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <ul className="nav nav-pills mb-4 gap-2 bg-light p-2 rounded border">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-4 ${activeTab === 'system' ? 'active shadow-sm' : 'text-dark'}`}
            onClick={() => {
              setActiveTab('system');
              setAlertMsg(null);
            }}
          >
            <i className="bi bi-gear-fill me-2"></i> System Settings
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-4 ${activeTab === 'login' ? 'active shadow-sm' : 'text-dark'}`}
            onClick={() => {
              setActiveTab('login');
              setAlertMsg(null);
            }}
          >
            <i className="bi bi-box-arrow-in-right me-2"></i> Login Page Customization
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-4 ${activeTab === 'footer' ? 'active shadow-sm' : 'text-dark'}`}
            onClick={() => {
              setActiveTab('footer');
              setAlertMsg(null);
            }}
          >
            <i className="bi bi-layout-text-window-reverse me-2"></i> Footer Customization
          </button>
        </li>
      </ul>

      {/* ========================================================================= */}
      {/* TAB 1: SYSTEM SETTINGS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'system' && (
        <form onSubmit={handleSaveSystem}>
          <div className="row g-4">
            {/* Left Form Column */}
            <div className="col-12 col-lg-7">
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-sliders text-primary"></i> Core System Identification
                  </h5>
                </div>
                <div className="card-body p-4">
                  {/* Site Title */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">
                      Site Title <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={systemForm.siteTitle}
                      onChange={(e) => setSystemForm({ ...systemForm, siteTitle: e.target.value })}
                      required
                      placeholder="e.g. Project SBM Online"
                    />
                    <div className="form-text">Shown on browser tabs, navigation bar header, and portal branding.</div>
                  </div>

                  {/* Region */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">
                      Region / Organizational Entity <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={systemForm.regionTitle}
                      onChange={(e) => setSystemForm({ ...systemForm, regionTitle: e.target.value })}
                      required
                      placeholder="e.g. Department of Education Regional Office VIII"
                    />
                    <div className="form-text">Regional subtitle accompanying the system title across headers.</div>
                  </div>

                  {/* Base Font Size */}
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label fw-semibold text-dark mb-0">Base Font Size</label>
                      <span className="badge bg-primary fs-6">{systemForm.baseFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      className="form-range"
                      min="12"
                      max="20"
                      step="1"
                      value={systemForm.baseFontSize}
                      onChange={(e) =>
                        setSystemForm({ ...systemForm, baseFontSize: Number(e.target.value) })
                      }
                    />
                    <div className="d-flex justify-content-between text-muted small">
                      <span>12px (Compact)</span>
                      <span>15px (Standard)</span>
                      <span>20px (Accessible Large)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme Colors */}
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-paint-bucket text-primary"></i> Theme Colors
                  </h5>
                </div>
                <div className="card-body p-4">
                  <div className="row g-3">
                    {/* Primary Color */}
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Primary Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={systemForm.primaryColor}
                          onChange={(e) => setSystemForm({ ...systemForm, primaryColor: e.target.value })}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={systemForm.primaryColor}
                          onChange={(e) => setSystemForm({ ...systemForm, primaryColor: e.target.value })}
                        />
                      </div>
                      <div className="form-text small">Navbar header, key action buttons, and active tabs.</div>
                    </div>

                    {/* Secondary Color */}
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Secondary Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={systemForm.secondaryColor}
                          onChange={(e) => setSystemForm({ ...systemForm, secondaryColor: e.target.value })}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={systemForm.secondaryColor}
                          onChange={(e) => setSystemForm({ ...systemForm, secondaryColor: e.target.value })}
                        />
                      </div>
                      <div className="form-text small">Secondary buttons, subheadings, and neutral icons.</div>
                    </div>

                    {/* Accent Color */}
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Accent Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={systemForm.accentColor}
                          onChange={(e) => setSystemForm({ ...systemForm, accentColor: e.target.value })}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={systemForm.accentColor}
                          onChange={(e) => setSystemForm({ ...systemForm, accentColor: e.target.value })}
                        />
                      </div>
                      <div className="form-text small">Badges, official seals, and highlight elements.</div>
                    </div>

                    {/* Background Color */}
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Background Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={systemForm.backgroundColor}
                          onChange={(e) => setSystemForm({ ...systemForm, backgroundColor: e.target.value })}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={systemForm.backgroundColor}
                          onChange={(e) => setSystemForm({ ...systemForm, backgroundColor: e.target.value })}
                        />
                      </div>
                      <div className="form-text small">Application body and page canvas background.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Assets: Navbar Logo & Favicon */}
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-file-earmark-image text-primary"></i> Visual Assets (Secure Storage)
                  </h5>
                </div>
                <div className="card-body p-4">
                  {/* Navbar Logo */}
                  <AssetUploadControl
                    fieldKey="navbarLogo"
                    label="Navbar Brand Logo"
                    description="Displayed in the top navigation header across all authenticated pages. (Recommended: 200×60px PNG or SVG)"
                    category="logo"
                    currentUrl={systemForm.navbarLogo}
                    onUrlChange={(url) => setSystemForm({ ...systemForm, navbarLogo: url })}
                  />

                  {/* Favicon */}
                  <AssetUploadControl
                    fieldKey="favicon"
                    label="Portal Favicon"
                    description="Displayed in browser tabs and bookmarks. (Recommended: 32×32 or 64×64 ICO or PNG)"
                    category="favicon"
                    currentUrl={systemForm.favicon}
                    onUrlChange={(url) => setSystemForm({ ...systemForm, favicon: url })}
                  />
                </div>
              </div>
            </div>

            {/* Right Live Preview Column */}
            <div className="col-12 col-lg-5">
              <div className="card shadow-sm border-0 sticky-top" style={{ top: '20px' }}>
                <div className="card-header bg-dark text-white py-3 d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-bold">
                    <i className="bi bi-eye-fill me-2 text-warning"></i> Live System Preview
                  </h6>
                  <span className="badge bg-secondary text-uppercase" style={{ fontSize: '0.65rem' }}>
                    Real-time
                  </span>
                </div>
                <div
                  className="card-body p-4"
                  style={{ backgroundColor: systemForm.backgroundColor, fontSize: `${systemForm.baseFontSize}px` }}
                >
                  {/* Navbar Preview */}
                  <div className="text-muted small fw-bold text-uppercase mb-2" style={{ fontSize: '0.72rem' }}>
                    Navbar Header Mockup:
                  </div>
                  <div
                    className="p-3 rounded-3 text-white shadow-sm mb-4 d-flex align-items-center gap-3 overflow-hidden"
                    style={{
                      backgroundColor: systemForm.primaryColor,
                      backgroundImage: `linear-gradient(135deg, ${systemForm.primaryColor} 0%, #001a4e 100%)`,
                    }}
                  >
                    {systemForm.navbarLogo ? (
                      <div className="bg-white rounded p-1 overflow-hidden d-flex align-items-center">
                        <img
                          src={systemForm.navbarLogo}
                          alt="Nav Logo"
                          className="img-fluid"
                          style={{ maxHeight: '36px', maxWidth: '100px', objectFit: 'contain' }}
                        />
                      </div>
                    ) : (
                      <div
                        className="rounded bg-white text-primary d-flex align-items-center justify-content-center fw-bold"
                        style={{ width: '36px', height: '36px' }}
                      >
                        <i className="bi bi-mortarboard-fill fs-5"></i>
                      </div>
                    )}
                    <div className="text-truncate">
                      <div className="fw-bold fs-6 lh-1 text-truncate">{systemForm.siteTitle}</div>
                      <div className="text-white-50 small mt-1 text-truncate" style={{ fontSize: '0.7rem' }}>
                        {systemForm.regionTitle}
                      </div>
                    </div>
                  </div>

                  {/* Font Scale & UI Preview */}
                  <div className="text-muted small fw-bold text-uppercase mb-2" style={{ fontSize: '0.72rem' }}>
                    Typography & Color Hierarchy:
                  </div>
                  <div className="card border mb-3 bg-white p-3">
                    <div className="fw-bold mb-1" style={{ color: systemForm.primaryColor }}>
                      Sample Section Title ({systemForm.baseFontSize}px base)
                    </div>
                    <p className="text-muted small mb-3">
                      This text preview scales dynamically with your selected base font size setting ({systemForm.baseFontSize}px).
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-sm text-white"
                        style={{ backgroundColor: systemForm.primaryColor }}
                      >
                        Primary Action
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm text-white"
                        style={{ backgroundColor: systemForm.secondaryColor }}
                      >
                        Secondary
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm text-dark fw-bold"
                        style={{ backgroundColor: systemForm.accentColor }}
                      >
                        Accent Tag
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-footer bg-white p-3 border-top d-flex justify-content-end">
                  <button type="submit" className="btn btn-primary px-4 shadow-sm" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Saving System Settings...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-2"></i> Save System Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LOGIN PAGE CUSTOMIZATION                                           */}
      {/* ========================================================================= */}
      {activeTab === 'login' && (
        <form onSubmit={handleSaveLogin}>
          <div className="row g-4">
            {/* Left Config Column */}
            <div className="col-12 col-lg-7">
              {/* Login Texts */}
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-fonts text-primary"></i> Configured Login Page Texts
                  </h5>
                </div>
                <div className="card-body p-4">
                  {/* Eyebrow */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">Eyebrow Text</label>
                    <input
                      type="text"
                      className="form-control"
                      value={loginForm.eyebrowText}
                      onChange={(e) => setLoginForm({ ...loginForm, eyebrowText: e.target.value })}
                      placeholder="e.g. DEPARTMENT OF EDUCATION • REGIONAL OFFICE VIII"
                    />
                    <div className="form-text small">Small gold uppercase tag above the main heading.</div>
                  </div>

                  {/* Main Heading */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">
                      Main Heading <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={loginForm.mainHeading}
                      onChange={(e) => setLoginForm({ ...loginForm, mainHeading: e.target.value })}
                      required
                      placeholder="e.g. Project SBM Online"
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">
                      Portal Subtitle / Description
                    </label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={loginForm.description}
                      onChange={(e) => setLoginForm({ ...loginForm, description: e.target.value })}
                      placeholder="Enter description text. Supports **bold** and *italic* formatting."
                    />
                    <div className="form-text small">
                      Supports safe formatting: <code className="text-primary">**bold**</code>,{' '}
                      <code className="text-primary">*italic*</code>, and line breaks.
                    </div>
                  </div>

                  {/* Announcement */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">
                      Public Announcement / Advisory Notice
                    </label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={loginForm.publicAnnouncement}
                      onChange={(e) => setLoginForm({ ...loginForm, publicAnnouncement: e.target.value })}
                      placeholder="e.g. Official advisory or deadline announcement. Supports **bold** and *italic*."
                    />
                    <div className="form-text small">
                      Highlighted public announcement card on login page. Leave blank to omit.
                    </div>
                  </div>

                  {/* Form Card Title & Description */}
                  <div className="row g-3">
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Login Form Card Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={loginForm.loginFormTitle}
                        onChange={(e) => setLoginForm({ ...loginForm, loginFormTitle: e.target.value })}
                        placeholder="e.g. Sign In to SBM Portal"
                      />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Login Form Card Subtitle</label>
                      <input
                        type="text"
                        className="form-control"
                        value={loginForm.loginFormDescription}
                        onChange={(e) =>
                          setLoginForm({ ...loginForm, loginFormDescription: e.target.value })
                        }
                        placeholder="e.g. Select your role and enter credentials."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Login Colors */}
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-palette text-primary"></i> Login Panel Colors
                  </h5>
                </div>
                <div className="card-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Primary Brand Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={loginForm.primaryColor}
                          onChange={(e) => setLoginForm({ ...loginForm, primaryColor: e.target.value })}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={loginForm.primaryColor}
                          onChange={(e) => setLoginForm({ ...loginForm, primaryColor: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Gradient Stop Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={loginForm.gradientColor}
                          onChange={(e) => setLoginForm({ ...loginForm, gradientColor: e.target.value })}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={loginForm.gradientColor}
                          onChange={(e) => setLoginForm({ ...loginForm, gradientColor: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Accent Gold Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={loginForm.accentColor}
                          onChange={(e) => setLoginForm({ ...loginForm, accentColor: e.target.value })}
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={loginForm.accentColor}
                          onChange={(e) => setLoginForm({ ...loginForm, accentColor: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Login Form Panel Color</label>
                      <div className="input-group">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={loginForm.loginPanelColor}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, loginPanelColor: e.target.value })
                          }
                        />
                        <input
                          type="text"
                          className="form-control"
                          value={loginForm.loginPanelColor}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, loginPanelColor: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Login Assets: Logo & Background Image */}
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-image text-primary"></i> Login Visual Assets
                  </h5>
                </div>
                <div className="card-body p-4">
                  {/* Login Logo */}
                  <AssetUploadControl
                    fieldKey="loginLogo"
                    label="Login Portal Logo"
                    description="Official seal displayed at the top of the login brand panel. (Recommended: 200×200 PNG or SVG)"
                    category="logo"
                    currentUrl={loginForm.loginLogo}
                    onUrlChange={(url) => setLoginForm({ ...loginForm, loginLogo: url })}
                  />

                  {/* Background Image */}
                  <AssetUploadControl
                    fieldKey="brandPanelBg"
                    label="Brand Panel Background Image"
                    description="Optional photography or architectural image overlaid behind the brand gradient on the login page. (Recommended: 1920×1080 JPEG or WebP)"
                    category="background"
                    isWide={true}
                    currentUrl={loginForm.brandPanelBg}
                    onUrlChange={(url) => setLoginForm({ ...loginForm, brandPanelBg: url })}
                  />

                  {/* Show Full Footer Checkbox */}
                  <div className="form-check form-switch p-3 bg-light rounded border mt-3">
                    <input
                      className="form-check-input ms-0 me-3"
                      type="checkbox"
                      id="showFullFooterToggle"
                      checked={loginForm.showFullFooter}
                      onChange={(e) =>
                        setLoginForm({ ...loginForm, showFullFooter: e.target.checked })
                      }
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                    <label
                      className="form-check-label fw-semibold text-dark"
                      htmlFor="showFullFooterToggle"
                      style={{ cursor: 'pointer' }}
                    >
                      Show Full Footer on Login Page
                    </label>
                    <div className="text-muted small ms-4 ps-2">
                      When enabled, the complete 3-logo regional footer, accreditation, and legal links will be displayed on the public login page.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Live Preview Column */}
            <div className="col-12 col-lg-5">
              <div className="card shadow-sm border-0 sticky-top" style={{ top: '20px' }}>
                <div className="card-header bg-dark text-white py-3 d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-bold">
                    <i className="bi bi-eye-fill me-2 text-warning"></i> Live Login Page Preview
                  </h6>
                  <span className="badge bg-secondary text-uppercase" style={{ fontSize: '0.65rem' }}>
                    Interactive
                  </span>
                </div>
                <div className="card-body p-3 bg-light">
                  {/* Mock Login Card */}
                  <div className="rounded-3 shadow overflow-hidden border">
                    {/* Brand Banner Preview */}
                    <div
                      className="p-3 text-white position-relative overflow-hidden"
                      style={{
                        background: loginForm.brandPanelBg
                          ? `linear-gradient(135deg, ${loginForm.primaryColor}ee 0%, ${loginForm.gradientColor}ee 100%), url(${loginForm.brandPanelBg}) center/cover no-repeat`
                          : `linear-gradient(135deg, ${loginForm.primaryColor} 0%, ${loginForm.gradientColor} 100%)`,
                        minHeight: '220px',
                      }}
                    >
                      <div className="d-flex align-items-center gap-2 mb-2">
                        {loginForm.loginLogo ? (
                          <div className="bg-white rounded p-1 overflow-hidden d-flex align-items-center">
                            <img
                              src={loginForm.loginLogo}
                              alt="Logo"
                              className="img-fluid"
                              style={{ maxHeight: '36px', maxWidth: '80px', objectFit: 'contain' }}
                            />
                          </div>
                        ) : (
                          <div
                            className="rounded bg-white text-primary d-flex align-items-center justify-content-center"
                            style={{ width: '32px', height: '32px' }}
                          >
                            <i className="bi bi-mortarboard-fill fs-6"></i>
                          </div>
                        )}
                        <span
                          className="badge fw-bold text-uppercase px-2 py-1"
                          style={{ backgroundColor: loginForm.accentColor, color: '#000' }}
                        >
                          Official Portal
                        </span>
                      </div>

                      <div
                        className="text-warning small text-uppercase fw-bold mb-1"
                        style={{ fontSize: '0.65rem' }}
                      >
                        {loginForm.eyebrowText || 'DEPARTMENT OF EDUCATION • REGIONAL OFFICE VIII'}
                      </div>
                      <div className="fw-bold fs-5 text-white mb-2">{loginForm.mainHeading}</div>
                      <div className="text-white-75 small mb-3" style={{ fontSize: '0.78rem' }}>
                        <SafeFormattedText text={loginForm.description} />
                      </div>

                      {loginForm.publicAnnouncement && (
                        <div
                          className="p-2 rounded border border-warning-subtle mb-2 text-white"
                          style={{ backgroundColor: 'rgba(255, 193, 7, 0.2)', fontSize: '0.72rem' }}
                        >
                          <i className="bi bi-megaphone-fill text-warning me-1"></i>
                          <SafeFormattedText text={loginForm.publicAnnouncement} />
                        </div>
                      )}
                    </div>

                    {/* Mock Form Panel */}
                    <div className="p-3" style={{ backgroundColor: loginForm.loginPanelColor }}>
                      <div className="fw-bold fs-6 text-dark mb-1">{loginForm.loginFormTitle}</div>
                      <div className="text-muted small mb-3" style={{ fontSize: '0.72rem' }}>
                        {loginForm.loginFormDescription}
                      </div>

                      <div className="mb-2">
                        <div className="form-control form-control-sm bg-light text-muted">
                          Username
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="form-control form-control-sm bg-light text-muted">
                          Password (••••••••)
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm w-100 text-white fw-bold"
                        style={{ backgroundColor: loginForm.primaryColor }}
                      >
                        Sign In
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-footer bg-white p-3 border-top d-flex justify-content-end">
                  <button type="submit" className="btn btn-primary px-4 shadow-sm" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Saving Login Appearance...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-2"></i> Save Login Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FOOTER CUSTOMIZATION                                               */}
      {/* ========================================================================= */}
      {activeTab === 'footer' && (
        <form onSubmit={handleSaveFooter}>
          <div className="row g-4">
            {/* Left Config Column */}
            <div className="col-12 col-lg-7">
              {/* Three Logos */}
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-images text-primary"></i> Three Official Footer Logos
                  </h5>
                </div>
                <div className="card-body p-4">
                  {/* First Wide Logo */}
                  <AssetUploadControl
                    fieldKey="firstWideLogo"
                    label="Logo 1: Wide First Logo"
                    description="Wide regional or national banner (e.g. Bagong Pilipinas or DepEd wide banner). Recommended: 300×80px PNG with transparent background."
                    category="logo"
                    isWide={true}
                    currentUrl={footerForm.firstWideLogo}
                    onUrlChange={(url) => setFooterForm({ ...footerForm, firstWideLogo: url })}
                  />

                  {/* Middle Logo 2 */}
                  <AssetUploadControl
                    fieldKey="logo2"
                    label="Logo 2: Middle Official Seal"
                    description="Secondary seal or division emblem. Recommended: 100×100px square or circular PNG."
                    category="logo"
                    currentUrl={footerForm.logo2}
                    onUrlChange={(url) => setFooterForm({ ...footerForm, logo2: url })}
                  />

                  {/* Third Logo 3 */}
                  <AssetUploadControl
                    fieldKey="logo3"
                    label="Logo 3: Regional / ISO Quality Seal"
                    description="Regional accreditation, ISO 9001, or quality assurance badge. Recommended: 100×100px PNG."
                    category="logo"
                    currentUrl={footerForm.logo3}
                    onUrlChange={(url) => setFooterForm({ ...footerForm, logo3: url })}
                  />
                </div>
              </div>

              {/* Formatted Text */}
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-card-text text-primary"></i> Regional Footer Accreditation Text
                  </h5>
                </div>
                <div className="card-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">
                      Official Footer Address & Accreditation
                    </label>
                    <textarea
                      className="form-control"
                      rows={5}
                      value={footerForm.footerText}
                      onChange={(e) => setFooterForm({ ...footerForm, footerText: e.target.value })}
                      placeholder="Use **bold**, *italic*, and line breaks for regional office formatting."
                    />
                    <div className="form-text small">
                      Safe custom formatter supports exclusively:{' '}
                      <code className="text-primary">**bold**</code>,{' '}
                      <code className="text-primary">*italic*</code>, and standard line breaks.
                    </div>
                  </div>

                  {/* Real-time formatted text test preview */}
                  <div className="rounded p-3 bg-dark text-white small">
                    <div className="text-secondary fw-bold text-uppercase mb-2" style={{ fontSize: '0.68rem' }}>
                      Safe Formatter Result:
                    </div>
                    <SafeFormattedText text={footerForm.footerText} />
                  </div>
                </div>
              </div>

              {/* Support Contact & Legal Links */}
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-telephone-inbound text-primary"></i> Support Contact & Information Links
                  </h5>
                </div>
                <div className="card-body p-4">
                  <div className="row g-3 mb-4">
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Support Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={footerForm.supportEmail}
                        onChange={(e) => setFooterForm({ ...footerForm, supportEmail: e.target.value })}
                        placeholder="qad.region8@deped.gov.ph"
                      />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Telephone Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={footerForm.telephone}
                        onChange={(e) => setFooterForm({ ...footerForm, telephone: e.target.value })}
                        placeholder="(053) 832-2997"
                      />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Facebook URL</label>
                      <input
                        type="url"
                        className="form-control"
                        value={footerForm.facebookUrl}
                        onChange={(e) => setFooterForm({ ...footerForm, facebookUrl: e.target.value })}
                        placeholder="https://www.facebook.com/DepEdROVIII"
                      />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold text-dark">Official Regional Website</label>
                      <input
                        type="url"
                        className="form-control"
                        value={footerForm.websiteUrl}
                        onChange={(e) => setFooterForm({ ...footerForm, websiteUrl: e.target.value })}
                        placeholder="https://region8.deped.gov.ph"
                      />
                    </div>
                  </div>

                  <h6 className="fw-bold text-dark mb-3 border-top pt-3">
                    <i className="bi bi-shield-check me-2 text-primary"></i> Information & Policy Links
                  </h6>
                  <div className="row g-3">
                    <div className="col-12 col-sm-4">
                      <label className="form-label small fw-semibold text-dark">Data Privacy Notice URL</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={footerForm.dataPrivacyUrl}
                        onChange={(e) =>
                          setFooterForm({ ...footerForm, dataPrivacyUrl: e.target.value })
                        }
                        placeholder="#"
                      />
                    </div>
                    <div className="col-12 col-sm-4">
                      <label className="form-label small fw-semibold text-dark">Terms of Use URL</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={footerForm.termsUrl}
                        onChange={(e) => setFooterForm({ ...footerForm, termsUrl: e.target.value })}
                        placeholder="#"
                      />
                    </div>
                    <div className="col-12 col-sm-4">
                      <label className="form-label small fw-semibold text-dark">User Manual URL</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={footerForm.userManualUrl}
                        onChange={(e) =>
                          setFooterForm({ ...footerForm, userManualUrl: e.target.value })
                        }
                        placeholder="#"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Live Preview Column */}
            <div className="col-12 col-lg-5">
              <div className="card shadow-sm border-0 sticky-top" style={{ top: '20px' }}>
                <div className="card-header bg-dark text-white py-3 d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-bold">
                    <i className="bi bi-eye-fill me-2 text-warning"></i> Live Footer Preview
                  </h6>
                  <span className="badge bg-secondary text-uppercase" style={{ fontSize: '0.65rem' }}>
                    Authenticated Shell
                  </span>
                </div>
                <div className="card-body p-3 bg-dark text-white">
                  {/* Context Tracker Mock */}
                  <div className="text-secondary small fw-bold text-uppercase mb-2" style={{ fontSize: '0.68rem' }}>
                    Logged In As Context Tracker:
                  </div>
                  <div
                    className="p-3 rounded border border-secondary mb-4"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-primary text-uppercase px-2 py-1">
                        <i className="bi bi-shield-check me-1"></i> Logged In As
                      </span>
                      <span className="fw-bold text-warning">{user?.fullName || 'Regional Admin'}</span>
                      <span className="text-secondary">({user?.username || 'admin'})</span>
                    </div>
                    <div className="small text-secondary">
                      Role: <span className="text-white fw-semibold">Regional Administrator</span> • Scope:{' '}
                      <span className="text-white fw-semibold">All 13 Schools Divisions</span>
                    </div>
                  </div>

                  {/* Three Logos Preview */}
                  <div className="text-secondary small fw-bold text-uppercase mb-2" style={{ fontSize: '0.68rem' }}>
                    Three Logos Mockup:
                  </div>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-4 p-2 bg-secondary bg-opacity-25 rounded overflow-hidden">
                    {footerForm.firstWideLogo ? (
                      <div className="bg-white rounded p-1 overflow-hidden d-flex align-items-center">
                        <img
                          src={footerForm.firstWideLogo}
                          alt="First Wide Logo"
                          className="img-fluid"
                          style={{ maxHeight: '48px', maxWidth: '160px', objectFit: 'contain' }}
                        />
                      </div>
                    ) : (
                      <div
                        className="bg-primary text-white d-flex align-items-center justify-content-center rounded p-2 small fw-bold"
                        style={{ height: '44px', minWidth: '100px' }}
                      >
                        Wide Logo 1
                      </div>
                    )}

                    {footerForm.logo2 ? (
                      <div className="bg-white rounded p-1 overflow-hidden d-flex align-items-center">
                        <img
                          src={footerForm.logo2}
                          alt="Logo 2"
                          className="img-fluid"
                          style={{ maxHeight: '44px', maxWidth: '80px', objectFit: 'contain' }}
                        />
                      </div>
                    ) : (
                      <div
                        className="bg-secondary text-white d-flex align-items-center justify-content-center rounded p-1 small"
                        style={{ width: '44px', height: '44px' }}
                      >
                        <i className="bi bi-award fs-5"></i>
                      </div>
                    )}

                    {footerForm.logo3 ? (
                      <div className="bg-white rounded p-1 overflow-hidden d-flex align-items-center">
                        <img
                          src={footerForm.logo3}
                          alt="Logo 3"
                          className="img-fluid"
                          style={{ maxHeight: '44px', maxWidth: '80px', objectFit: 'contain' }}
                        />
                      </div>
                    ) : (
                      <div
                        className="bg-danger text-white d-flex align-items-center justify-content-center rounded p-1 small"
                        style={{ width: '44px', height: '44px' }}
                      >
                        <i className="bi bi-star-fill fs-5"></i>
                      </div>
                    )}
                  </div>

                  {/* Formatted Text Preview */}
                  <div className="text-secondary small fw-bold text-uppercase mb-2" style={{ fontSize: '0.68rem' }}>
                    Formatted Accreditation Text:
                  </div>
                  <div className="border border-secondary rounded p-3 mb-3 small bg-dark">
                    <SafeFormattedText text={footerForm.footerText} />
                    <div className="mt-2 text-secondary" style={{ fontSize: '0.75rem' }}>
                      <i className="bi bi-telephone me-1 text-primary"></i> {footerForm.telephone} &nbsp;|&nbsp;
                      <i className="bi bi-envelope me-1 text-danger"></i> {footerForm.supportEmail}
                    </div>
                  </div>
                </div>

                <div className="card-footer bg-white p-3 border-top d-flex justify-content-end">
                  <button type="submit" className="btn btn-primary px-4 shadow-sm" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Saving Footer Settings...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-2"></i> Save Footer Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default RegionalCustomization;
