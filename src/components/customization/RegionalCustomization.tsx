import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

export const RegionalCustomization: React.FC = () => {
  const { apiFetch, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Active Tab: Login Appearance vs Footer Customization
  const [activeTab, setActiveTab] = useState<'login' | 'footer'>('login');

  // Login Config Form State
  const [loginForm, setLoginForm] = useState({
    primaryColor: '#0038a8',
    gradientColor: '#001a4e',
    accentColor: '#ce1126',
    loginPanelColor: '#ffffff',
    showFullFooter: true,
    loginLogo: '',
    eyebrowText: 'DEPARTMENT OF EDUCATION • REGIONAL OFFICE VIII',
    mainHeading: 'Project SBM Online',
    description:
      'Role-based School-Based Management self-assessment, monitoring, administration, and reporting platform for DepEd Eastern Visayas.',
    loginFormTitle: 'Sign In to Portal',
    loginFormDescription: 'Enter your DepEd assigned credentials to access your assessment dashboard.',
    publicAnnouncement: '',
  });

  // Footer Config Form State
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
    privacyNoticeUrl: '',
    termsUrl: '',
    userManualUrl: '',
    facebookUrl: 'https://www.facebook.com/DepEdROVIII',
    websiteUrl: 'https://region8.deped.gov.ph',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [loginRes, footerRes] = await Promise.all([
        apiFetch('/api/customization/login'),
        apiFetch('/api/customization/footer'),
      ]);

      if (loginRes.ok) {
        const lData = await loginRes.json();
        setLoginForm({
          primaryColor: lData.primaryColor || '#0038a8',
          gradientColor: lData.gradientColor || '#001a4e',
          accentColor: lData.accentColor || '#ce1126',
          loginPanelColor: lData.loginPanelColor || '#ffffff',
          showFullFooter: lData.showFullFooter !== undefined ? lData.showFullFooter : true,
          loginLogo: lData.loginLogo || '',
          eyebrowText: lData.eyebrowText || 'DEPARTMENT OF EDUCATION • REGIONAL OFFICE VIII',
          mainHeading: lData.mainHeading || 'Project SBM Online',
          description: lData.description || '',
          loginFormTitle: lData.loginFormTitle || 'Sign In to Portal',
          loginFormDescription: lData.loginFormDescription || '',
          publicAnnouncement: lData.publicAnnouncement || '',
        });
      }

      if (footerRes.ok) {
        const fData = await footerRes.json();
        setFooterForm({
          firstWideLogo: fData.firstWideLogo || '',
          logo2: fData.logo2 || '',
          logo3: fData.logo3 || '',
          footerText: fData.footerText || '',
          supportEmail: fData.supportEmail || 'qad.region8@deped.gov.ph',
          telephone: fData.telephone || '(053) 832-2997',
          privacyNoticeUrl: fData.privacyNoticeUrl || '',
          termsUrl: fData.termsUrl || '',
          userManualUrl: fData.userManualUrl || '',
          facebookUrl: fData.facebookUrl || 'https://www.facebook.com/DepEdROVIII',
          websiteUrl: fData.websiteUrl || 'https://region8.deped.gov.ph',
        });
      }
    } catch (err) {
      console.error('Failed to load customization:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save Login Configuration
  const handleSaveLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlertMsg(null);

    try {
      const res = await apiFetch('/api/customization/login', {
        method: 'PUT',
        body: JSON.stringify(loginForm),
      });

      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to save login settings.' });
      } else {
        setAlertMsg({ type: 'success', text: 'Regional Login Appearance updated successfully.' });
        await refreshProfile();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error.' });
    } finally {
      setSaving(false);
    }
  };

  // Reset Login Configuration to default
  const handleResetLogin = async () => {
    if (!window.confirm('Reset Login page appearance to official DepEd Regional defaults?')) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/customization/login/reset', { method: 'POST' });
      if (res.ok) {
        setAlertMsg({ type: 'success', text: 'Login settings reset to defaults.' });
        await loadSettings();
        await refreshProfile();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Failed to reset settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Save Footer Configuration
  const handleSaveFooter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlertMsg(null);

    try {
      const res = await apiFetch('/api/customization/footer', {
        method: 'PUT',
        body: JSON.stringify(footerForm),
      });

      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to save footer settings.' });
      } else {
        setAlertMsg({ type: 'success', text: 'Regional Footer & Compliance details updated.' });
        await refreshProfile();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error.' });
    } finally {
      setSaving(false);
    }
  };

  // Reset Footer Configuration
  const handleResetFooter = async () => {
    if (!window.confirm('Reset Footer branding and contact details to official DepEd RO8 defaults?')) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/customization/footer/reset', { method: 'POST' });
      if (res.ok) {
        setAlertMsg({ type: 'success', text: 'Footer settings reset to defaults.' });
        await loadSettings();
        await refreshProfile();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Failed to reset footer.' });
    } finally {
      setSaving(false);
    }
  };

  // Convert image file to data URL safely with overflow handling
  const handleLogoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image file size must be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setter(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="text-muted small mt-2">Loading Customization Settings...</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <div className="badge bg-danger text-uppercase px-2 py-1 mb-1">
            Regional Administration
          </div>
          <h1 className="h4 fw-bold text-dark mb-0">Regional Branding & Portal Customization</h1>
          <div className="text-muted small">
            Customize public login portal, color schemes, advisories, official logos, and compliance footer
          </div>
        </div>
      </div>

      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 px-3 small d-flex align-items-center gap-2 mb-3`}>
          <i
            className={`bi bi-${
              alertMsg.type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill'
            }`}
          ></i>
          <div>{alertMsg.text}</div>
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'login' ? 'active text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('login')}
          >
            <i className="bi bi-window me-1"></i> Login Page & Theme Appearance
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'footer' ? 'active text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('footer')}
          >
            <i className="bi bi-layout-text-window-reverse me-1"></i> Footer, Logos & Compliance URLs
          </button>
        </li>
      </ul>

      {/* Login Appearance Tab */}
      {activeTab === 'login' && (
        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="card border-0 shadow-sm rounded-3">
              <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                <h5 className="fw-bold mb-0 text-dark">Portal Branding & Colors</h5>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleResetLogin}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i> Reset to Defaults
                </button>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleSaveLogin}>
                  {/* Colors */}
                  <h6 className="fw-bold text-dark mb-3">Color Palette</h6>
                  <div className="row g-3 mb-4">
                    <div className="col-6 col-sm-3">
                      <label className="form-label small fw-semibold">Primary Color</label>
                      <div className="d-flex align-items-center gap-2">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={loginForm.primaryColor}
                          onChange={(e) => setLoginForm({ ...loginForm, primaryColor: e.target.value })}
                        />
                        <span className="small text-muted">{loginForm.primaryColor}</span>
                      </div>
                    </div>

                    <div className="col-6 col-sm-3">
                      <label className="form-label small fw-semibold">Gradient Base</label>
                      <div className="d-flex align-items-center gap-2">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={loginForm.gradientColor}
                          onChange={(e) => setLoginForm({ ...loginForm, gradientColor: e.target.value })}
                        />
                        <span className="small text-muted">{loginForm.gradientColor}</span>
                      </div>
                    </div>

                    <div className="col-6 col-sm-3">
                      <label className="form-label small fw-semibold">Accent Color</label>
                      <div className="d-flex align-items-center gap-2">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={loginForm.accentColor}
                          onChange={(e) => setLoginForm({ ...loginForm, accentColor: e.target.value })}
                        />
                        <span className="small text-muted">{loginForm.accentColor}</span>
                      </div>
                    </div>

                    <div className="col-6 col-sm-3">
                      <label className="form-label small fw-semibold">Card Panel BG</label>
                      <div className="d-flex align-items-center gap-2">
                        <input
                          type="color"
                          className="form-control form-control-color"
                          value={loginForm.loginPanelColor}
                          onChange={(e) => setLoginForm({ ...loginForm, loginPanelColor: e.target.value })}
                        />
                        <span className="small text-muted">{loginForm.loginPanelColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Logo Upload */}
                  <h6 className="fw-bold text-dark mb-3 border-top pt-3">Login Portal Logo</h6>
                  <div className="mb-3">
                    <input
                      type="file"
                      className="form-control form-control-sm"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, (val) => setLoginForm({ ...loginForm, loginLogo: val }))}
                    />
                    <div className="form-text small">
                      Upload transparent PNG or SVG logo for the regional login header (max 2MB).
                    </div>
                    {loginForm.loginLogo && (
                      <div className="mt-2 p-2 border rounded bg-light d-flex align-items-center gap-2" style={{ maxWidth: '240px', overflow: 'hidden' }}>
                        <img
                          src={loginForm.loginLogo}
                          alt="Logo Preview"
                          style={{ maxHeight: '48px', maxWidth: '100%', objectFit: 'contain' }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger"
                          onClick={() => setLoginForm({ ...loginForm, loginLogo: '' })}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Text Content */}
                  <h6 className="fw-bold text-dark mb-3 border-top pt-3">Headings & Copy</h6>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Eyebrow Label</label>
                    <input
                      type="text"
                      className="form-control"
                      value={loginForm.eyebrowText}
                      onChange={(e) => setLoginForm({ ...loginForm, eyebrowText: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Main Heading</label>
                    <input
                      type="text"
                      className="form-control"
                      value={loginForm.mainHeading}
                      onChange={(e) => setLoginForm({ ...loginForm, mainHeading: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description Text</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={loginForm.description}
                      onChange={(e) => setLoginForm({ ...loginForm, description: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold">Form Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={loginForm.loginFormTitle}
                        onChange={(e) => setLoginForm({ ...loginForm, loginFormTitle: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold">Form Subtitle</label>
                      <input
                        type="text"
                        className="form-control"
                        value={loginForm.loginFormDescription}
                        onChange={(e) => setLoginForm({ ...loginForm, loginFormDescription: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Public Announcement */}
                  <div className="mb-3 border-top pt-3">
                    <label className="form-label small fw-semibold text-warning">
                      <i className="bi bi-megaphone-fill me-1"></i> Public Advisory / Announcement Banner
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="e.g. SBM Submission Cycle for SY 2024-2025 is extended until Friday, 5:00 PM."
                      value={loginForm.publicAnnouncement}
                      onChange={(e) => setLoginForm({ ...loginForm, publicAnnouncement: e.target.value })}
                    ></textarea>
                    <div className="form-text small">
                      Leave blank if there is no active advisory.
                    </div>
                  </div>

                  {/* Footer toggle */}
                  <div className="form-check form-switch mb-4 border-top pt-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="showFullFooterCheck"
                      checked={loginForm.showFullFooter}
                      onChange={(e) => setLoginForm({ ...loginForm, showFullFooter: e.target.checked })}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor="showFullFooterCheck">
                      Show full customized footer on public login page
                    </label>
                  </div>

                  <button type="submit" className="btn btn-primary px-4 fw-semibold shadow-sm" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Login Appearance'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="col-12 col-lg-5">
            <div className="card border-0 shadow-sm rounded-3 sticky-top" style={{ top: '1rem' }}>
              <div className="card-header bg-white py-3">
                <h6 className="fw-bold mb-0 text-dark">
                  <i className="bi bi-eye text-primary me-2"></i> Live Login Preview
                </h6>
              </div>
              <div className="card-body p-3">
                <div
                  className="rounded-3 p-3 text-white overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${loginForm.primaryColor} 0%, ${loginForm.gradientColor} 100%)`,
                    minHeight: '220px',
                  }}
                >
                  <div className="small text-warning fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>
                    {loginForm.eyebrowText}
                  </div>
                  <div className="h5 fw-bold mb-1 text-white">{loginForm.mainHeading}</div>
                  <p className="small text-white-75 mb-2" style={{ fontSize: '0.72rem' }}>
                    {loginForm.description}
                  </p>
                  {loginForm.publicAnnouncement && (
                    <div className="p-2 rounded bg-warning bg-opacity-25 border border-warning text-white small" style={{ fontSize: '0.7rem' }}>
                      <i className="bi bi-megaphone-fill text-warning me-1"></i>
                      {loginForm.publicAnnouncement}
                    </div>
                  )}
                </div>

                <div
                  className="p-3 border rounded-3 mt-2"
                  style={{ backgroundColor: loginForm.loginPanelColor }}
                >
                  <div className="fw-bold small text-dark">{loginForm.loginFormTitle}</div>
                  <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                    {loginForm.loginFormDescription}
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm w-100 disabled"
                      style={{ backgroundColor: loginForm.primaryColor, borderColor: loginForm.primaryColor }}
                    >
                      Sign In Button Preview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Customization Tab */}
      {activeTab === 'footer' && (
        <div className="card border-0 shadow-sm rounded-3">
          <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold mb-0 text-dark">Customized Regional Footer & Compliance</h5>
              <div className="text-muted small">
                Configure inline logos, rich markdown text, official support hotline, and compliance links
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={handleResetFooter}
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i> Reset to Defaults
            </button>
          </div>
          <div className="card-body p-4">
            <form onSubmit={handleSaveFooter}>
              {/* Up to 3 inline logos */}
              <h6 className="fw-bold text-dark mb-3">Inline Footer Logos (Up to 3)</h6>
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">Logo 1 (Wide Regional Logo)</label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept="image/*"
                    onChange={(e) => handleLogoUpload(e, (val) => setFooterForm({ ...footerForm, firstWideLogo: val }))}
                  />
                  {footerForm.firstWideLogo && (
                    <div className="mt-2 p-2 border rounded bg-dark d-flex align-items-center gap-2 overflow-hidden">
                      <img src={footerForm.firstWideLogo} alt="Logo 1" style={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger"
                        onClick={() => setFooterForm({ ...footerForm, firstWideLogo: '' })}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">Logo 2 (Quality Assurance / Seal)</label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept="image/*"
                    onChange={(e) => handleLogoUpload(e, (val) => setFooterForm({ ...footerForm, logo2: val }))}
                  />
                  {footerForm.logo2 && (
                    <div className="mt-2 p-2 border rounded bg-dark d-flex align-items-center gap-2 overflow-hidden">
                      <img src={footerForm.logo2} alt="Logo 2" style={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger"
                        onClick={() => setFooterForm({ ...footerForm, logo2: '' })}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">Logo 3 (Bagong Pilipinas / DepEd)</label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept="image/*"
                    onChange={(e) => handleLogoUpload(e, (val) => setFooterForm({ ...footerForm, logo3: val }))}
                  />
                  {footerForm.logo3 && (
                    <div className="mt-2 p-2 border rounded bg-dark d-flex align-items-center gap-2 overflow-hidden">
                      <img src={footerForm.logo3} alt="Logo 3" style={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger"
                        onClick={() => setFooterForm({ ...footerForm, logo3: '' })}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Multiline Footer Text with Markdown */}
              <h6 className="fw-bold text-dark mb-3 border-top pt-3">
                Multiline Footer Text (Supports **bold** and *italic*)
              </h6>
              <div className="mb-3">
                <textarea
                  className="form-control"
                  rows={4}
                  value={footerForm.footerText}
                  onChange={(e) => setFooterForm({ ...footerForm, footerText: e.target.value })}
                  required
                ></textarea>
                <div className="form-text small">
                  Formatting tip: use <code>**Department of Education**</code> for bold and <code>*Quality Assurance*</code> for italic. Raw HTML tags are blocked for data security.
                </div>
              </div>

              {/* Contact Information */}
              <h6 className="fw-bold text-dark mb-3 border-top pt-3">Support & Communications</h6>
              <div className="row g-3 mb-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold">Support Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={footerForm.supportEmail}
                    onChange={(e) => setFooterForm({ ...footerForm, supportEmail: e.target.value })}
                    required
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold">Telephone Hotline</label>
                  <input
                    type="text"
                    className="form-control"
                    value={footerForm.telephone}
                    onChange={(e) => setFooterForm({ ...footerForm, telephone: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Compliance & External URLs */}
              <h6 className="fw-bold text-dark mb-3 border-top pt-3">Official & Compliance URLs</h6>
              <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold">Official Website URL</label>
                  <input
                    type="url"
                    className="form-control"
                    value={footerForm.websiteUrl}
                    onChange={(e) => setFooterForm({ ...footerForm, websiteUrl: e.target.value })}
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold">Official Facebook Page URL</label>
                  <input
                    type="url"
                    className="form-control"
                    value={footerForm.facebookUrl}
                    onChange={(e) => setFooterForm({ ...footerForm, facebookUrl: e.target.value })}
                  />
                </div>
                <div className="col-12 col-sm-4">
                  <label className="form-label small fw-semibold">Data Privacy Notice URL</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Leave blank to use integrated modal"
                    value={footerForm.privacyNoticeUrl}
                    onChange={(e) => setFooterForm({ ...footerForm, privacyNoticeUrl: e.target.value })}
                  />
                </div>
                <div className="col-12 col-sm-4">
                  <label className="form-label small fw-semibold">Terms of Use URL</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Leave blank to use integrated modal"
                    value={footerForm.termsUrl}
                    onChange={(e) => setFooterForm({ ...footerForm, termsUrl: e.target.value })}
                  />
                </div>
                <div className="col-12 col-sm-4">
                  <label className="form-label small fw-semibold">User Manual URL</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Leave blank to use integrated modal"
                    value={footerForm.userManualUrl}
                    onChange={(e) => setFooterForm({ ...footerForm, userManualUrl: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary px-4 fw-semibold shadow-sm" disabled={saving}>
                {saving ? 'Saving...' : 'Save Footer Settings'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
