import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface ManageAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageAccountModal: React.FC<ManageAccountModalProps> = ({ isOpen, onClose }) => {
  const { user, apiFetch, refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [schoolHead, setSchoolHead] = useState('');
  const [classification, setClassification] = useState('');
  const [classificationsList, setClassificationsList] = useState<string[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  // Security credentials
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Feedback
  const [loadingClassifications, setLoadingClassifications] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setFullName(user.fullName || '');
      setSchoolHead(user.schoolHead || user.fullName || '');
      setClassification(user.schoolClassification || '');
      setLogo(user.logo || null);
      setRemoveLogo(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMessage(null);
      setSuccessMessage(null);

      if (user.role === 'school') {
        loadClassifications();
      }
    }
  }, [isOpen, user]);

  const loadClassifications = async () => {
    setLoadingClassifications(true);
    try {
      const res = await apiFetch('/api/schools/classifications');
      if (res.ok) {
        const data = await res.json();
        setClassificationsList(data.map((c: any) => c.name || c));
      }
    } catch (err) {
      console.error('Failed to load classifications:', err);
    } finally {
      setLoadingClassifications(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Logo image file must be smaller than 2MB.');
      return;
    }

    setIsUploadingLogo(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      if (logo) {
        formData.append('replaceUrl', logo);
      }

      const res = await apiFetch('/api/auth/upload-logo', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setLogo(data.url);
        setRemoveLogo(false);
        setSuccessMessage('Logo uploaded and verified. Click "Save Profile Changes" to apply.');
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to upload logo.');
      }
    } catch (err) {
      console.error('Logo upload error:', err);
      setErrorMessage('Network error during logo upload.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage('Current password is required to save any profile or account changes.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        setErrorMessage('New password must be at least 8 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New password and confirmation do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        currentPassword,
        newPassword: newPassword || undefined,
        confirmPassword: confirmPassword || undefined,
        fullName: fullName.trim(),
        logo: removeLogo ? null : logo,
        removeLogo,
      };

      if (user?.role === 'school') {
        payload.schoolHead = schoolHead.trim();
        payload.classification = classification.trim();
      }

      const res = await apiFetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || 'Profile updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await refreshUser();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Save profile error:', err);
      setErrorMessage('Network error while saving profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg rounded-3">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
              <i className="bi bi-person-gear"></i> Manage Account & Organization Profile
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={isSubmitting}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Feedback banners */}
              {errorMessage && (
                <div className="alert alert-danger alert-dismissible fade show shadow-sm mb-3" role="alert">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {errorMessage}
                  <button type="button" className="btn-close" onClick={() => setErrorMessage(null)}></button>
                </div>
              )}
              {successMessage && (
                <div className="alert alert-success alert-dismissible fade show shadow-sm mb-3" role="alert">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  {successMessage}
                  <button type="button" className="btn-close" onClick={() => setSuccessMessage(null)}></button>
                </div>
              )}

              {/* Account Identity Header Card */}
              <div className="card bg-light border-0 rounded-3 p-3 mb-4">
                <div className="d-flex align-items-center gap-3">
                  {logo && !removeLogo ? (
                    <img
                      src={logo}
                      alt="Logo"
                      className="rounded border bg-white shadow-sm"
                      style={{ width: '64px', height: '64px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div
                      className="rounded bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold fs-4"
                      style={{ width: '64px', height: '64px' }}
                    >
                      {user?.fullName?.charAt(0) || <i className="bi bi-person"></i>}
                    </div>
                  )}
                  <div>
                    <h6 className="fw-bold text-dark mb-1">{user?.fullName}</h6>
                    <div className="text-muted small">
                      <span className="badge bg-secondary text-uppercase me-2 font-monospace">
                        {user?.role === 'regional'
                          ? 'Regional Administrator'
                          : user?.role === 'division'
                          ? 'Division SDO Admin'
                          : 'School Administrator'}
                      </span>
                      Username: <code>{user?.username}</code>
                    </div>
                    <div className="text-muted small mt-1">
                      {user?.role === 'school' && `School ID: ${user?.schoolDepedId || 'N/A'} • ${user?.schoolName || ''}`}
                      {user?.role === 'division' && `SDO: ${user?.divisionName || 'N/A'}`}
                      {user?.role === 'regional' && 'DepEd Regional Office VIII QA Division'}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: Organization Logo Management */}
              <div className="mb-4">
                <h6 className="fw-bold text-dark text-uppercase small border-bottom pb-2 mb-3">
                  <i className="bi bi-image me-1 text-primary"></i> Organization Logo
                </h6>
                <div className="d-flex flex-wrap align-items-center gap-3">
                  {logo && !removeLogo ? (
                    <div className="position-relative">
                      <img
                        src={logo}
                        alt="Current logo"
                        className="rounded border bg-white p-1 shadow-sm"
                        style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                      />
                      <button
                        type="button"
                        className="btn btn-danger btn-sm position-absolute top-0 end-0 p-0 rounded-circle"
                        style={{ width: '22px', height: '22px', transform: 'translate(35%, -35%)' }}
                        title="Remove Logo"
                        onClick={() => setRemoveLogo(true)}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    </div>
                  ) : (
                    <div
                      className="rounded border border-dashed text-muted bg-white d-flex flex-column align-items-center justify-content-center"
                      style={{ width: '80px', height: '80px' }}
                    >
                      <i className="bi bi-cloud-arrow-up fs-4"></i>
                      <span style={{ fontSize: '0.65rem' }}>No logo</span>
                    </div>
                  )}

                  <div className="flex-grow-1">
                    <label className="form-label small fw-bold mb-1">
                      Upload Replacement Logo (PNG, JPG, WebP — max 2MB)
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="form-control form-control-sm"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                    />
                    <div className="form-text small">
                      {removeLogo
                        ? 'Logo will be removed when changes are saved.'
                        : 'Accepted formats: PNG, JPG, WebP. High-contrast square or circular emblems recommended.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: Role Specific Profile Fields */}
              <div className="mb-4">
                <h6 className="fw-bold text-dark text-uppercase small border-bottom pb-2 mb-3">
                  <i className="bi bi-person-lines-fill me-1 text-primary"></i> Profile Information
                </h6>

                {user?.role === 'school' ? (
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">School Head Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={schoolHead}
                        onChange={(e) => setSchoolHead(e.target.value)}
                        required
                        placeholder="e.g. Juan Dela Cruz, Principal II"
                      />
                      <div className="form-text small">Authorized official name appearing on SBM reports.</div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">School Classification *</label>
                      <select
                        className="form-select"
                        value={classification}
                        onChange={(e) => setClassification(e.target.value)}
                        disabled={loadingClassifications}
                        required
                      >
                        <option value="">-- Select School Classification --</option>
                        {classificationsList.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <div className="form-text small">Standardized DepEd classification level.</div>
                    </div>

                    {/* School Read-Only System Details */}
                    <div className="col-12 col-md-4">
                      <label className="form-label small text-muted">DepEd School ID (Read-Only)</label>
                      <input
                        type="text"
                        className="form-control bg-light text-muted font-monospace"
                        value={user.schoolDepedId || 'N/A'}
                        readOnly
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small text-muted">School Name (Read-Only)</label>
                      <input
                        type="text"
                        className="form-control bg-light text-muted"
                        value={user.schoolName || 'N/A'}
                        readOnly
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small text-muted">Division & District (Read-Only)</label>
                      <input
                        type="text"
                        className="form-control bg-light text-muted"
                        value={`${user.divisionName || 'N/A'} - ${user.schoolDistrict || 'N/A'}`}
                        readOnly
                      />
                    </div>
                  </div>
                ) : (
                  <div className="row g-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label small fw-bold">Administrator Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        placeholder="e.g. Maria Clara, Education Program Supervisor"
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small text-muted">Account Username</label>
                      <input
                        type="text"
                        className="form-control bg-light text-muted font-monospace"
                        value={user?.username || ''}
                        readOnly
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: Security & Password Update */}
              <div className="mb-3">
                <h6 className="fw-bold text-dark text-uppercase small border-bottom pb-2 mb-3">
                  <i className="bi bi-shield-lock me-1 text-primary"></i> Security & Password
                </h6>

                <div className="row g-3">
                  <div className="col-12">
                    <div className="alert alert-light border small text-muted mb-0">
                      <i className="bi bi-info-circle me-1 text-primary"></i>
                      To save changes or update your password, your <strong>Current Password</strong> is required.
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold text-primary">
                      Current Password * <span className="text-muted fw-normal">(Required to verify changes)</span>
                    </label>
                    <input
                      type="password"
                      className="form-control border-primary"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6 d-none d-md-block"></div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold text-muted">
                      New Password <span className="text-muted fw-normal">(Optional, min 8 chars)</span>
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Leave blank to keep unchanged"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold text-muted">Confirm New Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Re-type new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer bg-light">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-3"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm px-4 fw-semibold shadow-sm d-flex align-items-center gap-1"
                disabled={isSubmitting || isUploadingLogo || !currentPassword}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    Saving Profile...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle-fill"></i> Save Profile Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
