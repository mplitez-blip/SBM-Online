import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface DivisionAccountItem {
  id: number;
  divisionCode: string;
  divisionName: string;
  logo: string | null;
  createdAt: string;
  updatedAt: string;
  userId: number | null;
  username: string | null;
  adminName: string;
  isActive: boolean;
  schoolCount: number;
  submittedCount: number;
  draftCount: number;
  notStartedCount: number;
  averageRating: string;
}

interface AffectedRecords {
  schools: number;
  schoolNames: string[];
  assessments: number;
  responses: number;
  users: number;
}

export const DivisionManagement: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const [divisions, setDivisions] = useState<DivisionAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDiv, setSelectedDiv] = useState<DivisionAccountItem | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    divisionName: '',
    divisionCode: '',
    adminName: '',
    username: '',
    password: '',
    confirmPassword: '',
    isActive: true,
    logo: null as string | null,
    removeLogo: false,
  });

  // Password Reset Fields
  const [resetData, setResetData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Deletion Confirmation & Impact
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [affectedRecords, setAffectedRecords] = useState<AffectedRecords | null>(null);
  const [loadingAffected, setLoadingAffected] = useState(false);

  // Status & Feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    loadDivisions();
  }, []);

  const loadDivisions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/divisions/accounts');
      if (res.ok) {
        const data = await res.json();
        setDivisions(data);
      } else {
        const err = await res.json();
        setActionError(err.error || 'Failed to load division accounts.');
      }
    } catch (err) {
      console.error('Failed to load divisions:', err);
      setActionError('Network error loading division accounts.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Logo Upload for Division
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setActionError('Logo file size must be less than 2MB.');
      return;
    }

    setLogoUploading(true);
    setActionError(null);
    try {
      const body = new FormData();
      body.append('logo', file);
      if (formData.logo) {
        body.append('replaceUrl', formData.logo);
      }

      const res = await apiFetch('/api/auth/upload-logo', {
        method: 'POST',
        body,
      });

      if (res.ok) {
        const data = await res.json();
        setFormData((prev) => ({ ...prev, logo: data.url, removeLogo: false }));
        setActionSuccess('Division logo uploaded successfully.');
      } else {
        const err = await res.json();
        setActionError(err.error || 'Failed to upload logo.');
      }
    } catch (err) {
      console.error('Logo upload failed:', err);
      setActionError('Network error uploading logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // Create Division
  const handleCreateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (formData.password !== formData.confirmPassword) {
      setActionError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 8) {
      setActionError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/divisions/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          divisionName: formData.divisionName,
          divisionCode: formData.divisionCode,
          adminName: formData.adminName,
          username: formData.username,
          password: formData.password,
          isActive: formData.isActive,
          logo: formData.logo,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccess(data.message || 'Division created successfully.');
        setShowAddModal(false);
        resetForm();
        loadDivisions();
      } else {
        setActionError(data.error || 'Failed to create division.');
      }
    } catch (err) {
      console.error('Create division error:', err);
      setActionError('Network error creating division.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Division
  const handleEditDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiv) return;

    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await apiFetch(`/api/divisions/accounts/${selectedDiv.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          divisionName: formData.divisionName,
          adminName: formData.adminName,
          username: formData.username,
          isActive: formData.isActive,
          logo: formData.logo,
          removeLogo: formData.removeLogo,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccess(data.message || 'Division updated successfully.');
        setShowEditModal(false);
        resetForm();
        loadDivisions();
      } else {
        setActionError(data.error || 'Failed to update division.');
      }
    } catch (err) {
      console.error('Edit division error:', err);
      setActionError('Network error updating division.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiv) return;

    if (resetData.newPassword !== resetData.confirmPassword) {
      setActionError('New passwords do not match.');
      return;
    }
    if (resetData.newPassword.length < 8) {
      setActionError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/divisions/accounts/${selectedDiv.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: resetData.newPassword,
          confirmPassword: resetData.confirmPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccess(data.message || 'Password reset successfully.');
        setShowResetModal(false);
        setResetData({ newPassword: '', confirmPassword: '' });
      } else {
        setActionError(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setActionError('Network error resetting password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async (div: DivisionAccountItem) => {
    const nextStatus = !div.isActive;
    try {
      const res = await apiFetch(`/api/divisions/accounts/${div.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextStatus }),
      });

      if (res.ok) {
        setActionSuccess(`Division "${div.divisionName}" is now ${nextStatus ? 'Active' : 'Inactive'}.`);
        loadDivisions();
      } else {
        const err = await res.json();
        setActionError(err.error || 'Failed to change status.');
      }
    } catch (err) {
      console.error('Toggle status error:', err);
      setActionError('Network error updating division status.');
    }
  };

  // Open Delete Modal & Inspect Impact
  const openDeleteModal = async (div: DivisionAccountItem) => {
    setSelectedDiv(div);
    setDeleteConfirmName('');
    setActionError(null);
    setShowDeleteModal(true);
    setLoadingAffected(true);

    try {
      const res = await apiFetch(`/api/divisions/accounts/${div.id}/affected-records`);
      if (res.ok) {
        const data = await res.json();
        setAffectedRecords(data.affected);
      }
    } catch (err) {
      console.error('Failed to load affected records:', err);
    } finally {
      setLoadingAffected(false);
    }
  };

  // Confirm Delete
  const handleDeleteDivision = async () => {
    if (!selectedDiv) return;

    if (deleteConfirmName.trim() !== selectedDiv.divisionName.trim()) {
      setActionError(`Please type "${selectedDiv.divisionName}" exactly to confirm.`);
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/divisions/accounts/${selectedDiv.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: deleteConfirmName }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccess(data.message || 'Division deleted successfully.');
        setShowDeleteModal(false);
        loadDivisions();
      } else {
        setActionError(data.error || 'Failed to delete division.');
      }
    } catch (err) {
      console.error('Delete division error:', err);
      setActionError('Network error deleting division.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      divisionName: '',
      divisionCode: '',
      adminName: '',
      username: '',
      password: '',
      confirmPassword: '',
      isActive: true,
      logo: null,
      removeLogo: false,
    });
    setSelectedDiv(null);
  };

  const openEditModal = (div: DivisionAccountItem) => {
    setSelectedDiv(div);
    setFormData({
      divisionName: div.divisionName,
      divisionCode: div.divisionCode,
      adminName: div.adminName,
      username: div.username || '',
      password: '',
      confirmPassword: '',
      isActive: div.isActive,
      logo: div.logo,
      removeLogo: false,
    });
    setActionError(null);
    setShowEditModal(true);
  };

  const openResetModal = (div: DivisionAccountItem) => {
    setSelectedDiv(div);
    setResetData({ newPassword: '', confirmPassword: '' });
    setActionError(null);
    setShowResetModal(true);
  };

  // Filtering
  const filteredDivisions = divisions.filter((d) => {
    const matchesSearch =
      d.divisionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.username && d.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      d.divisionCode.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? d.isActive
        : !d.isActive;

    return matchesSearch && matchesStatus;
  });

  const totalCount = divisions.length;
  const activeCount = divisions.filter((d) => d.isActive).length;
  const inactiveCount = divisions.filter((d) => !d.isActive).length;

  if (user?.role !== 'regional') {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger shadow-sm">
          <i className="bi bi-shield-lock-fill me-2 fs-5"></i>
          <strong>Access Restricted:</strong> Division Account Management is exclusively accessible to Regional Administrators.
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-building-gear text-primary"></i> Division Account Management
          </h1>
          <p className="text-muted small mb-0">
            Provision, monitor, edit, and manage Schools Division Offices (SDO) and administrator credentials across the Region.
          </p>
        </div>
        <button
          id="add-division-btn"
          className="btn btn-primary d-flex align-items-center gap-2 shadow-sm px-3 py-2 fw-semibold"
          onClick={() => {
            resetForm();
            setActionError(null);
            setShowAddModal(true);
          }}
        >
          <i className="bi bi-plus-circle-fill"></i> Add Division Account
        </button>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {actionSuccess}
          <button type="button" className="btn-close" onClick={() => setActionSuccess(null)}></button>
        </div>
      )}
      {actionError && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {actionError}
          <button type="button" className="btn-close" onClick={() => setActionError(null)}></button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-4">
          <div className="card border-0 shadow-sm rounded-3 bg-white h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold text-uppercase">Total Divisions</div>
                <div className="fs-3 fw-bold text-dark mt-1">{totalCount}</div>
              </div>
              <div className="bg-primary bg-opacity-10 text-primary rounded-3 p-3">
                <i className="bi bi-buildings fs-3"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-4">
          <div className="card border-0 shadow-sm rounded-3 bg-white h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold text-uppercase">Active Accounts</div>
                <div className="fs-3 fw-bold text-success mt-1">{activeCount}</div>
              </div>
              <div className="bg-success bg-opacity-10 text-success rounded-3 p-3">
                <i className="bi bi-check-circle-fill fs-3"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-4">
          <div className="card border-0 shadow-sm rounded-3 bg-white h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold text-uppercase">Inactive Accounts</div>
                <div className="fs-3 fw-bold text-secondary mt-1">{inactiveCount}</div>
              </div>
              <div className="bg-secondary bg-opacity-10 text-secondary rounded-3 p-3">
                <i className="bi bi-person-x-fill fs-3"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card border-0 shadow-sm rounded-3 mb-4">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  id="search-division-input"
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search by division name, administrator name, or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setSearchTerm('')}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="col-12 col-md-6 d-flex justify-content-md-end gap-2">
              <div className="btn-group" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${statusFilter === 'active' ? 'btn-success' : 'btn-outline-secondary'}`}
                  onClick={() => setStatusFilter('active')}
                >
                  Active ({activeCount})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${statusFilter === 'inactive' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => setStatusFilter('inactive')}
                >
                  Inactive ({inactiveCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Division Table */}
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-muted small text-uppercase">
              <tr>
                <th style={{ width: '60px' }}>Logo</th>
                <th>Division Name & Code</th>
                <th>Administrator</th>
                <th>Username</th>
                <th className="text-center">Schools</th>
                <th className="text-center">Status</th>
                <th className="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                    <div className="text-muted small mt-2">Loading Division accounts...</div>
                  </td>
                </tr>
              ) : filteredDivisions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    <i className="bi bi-buildings fs-1 d-block mb-2 text-secondary"></i>
                    No Division accounts found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDivisions.map((div) => (
                  <tr key={div.id}>
                    <td>
                      {div.logo ? (
                        <img
                          src={div.logo}
                          alt={div.divisionName}
                          className="rounded border bg-white shadow-sm"
                          style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                        />
                      ) : (
                        <div
                          className="rounded bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold"
                          style={{ width: '40px', height: '40px' }}
                        >
                          <i className="bi bi-building"></i>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="fw-bold text-dark">{div.divisionName}</div>
                      <div className="text-muted small">Code: {div.divisionCode}</div>
                    </td>
                    <td>
                      <div className="fw-medium text-dark">{div.adminName}</div>
                      <div className="text-muted small">SDO Lead</div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border font-monospace">
                        {div.username || 'unassigned'}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-info bg-opacity-10 text-info fw-bold px-2 py-1">
                        {div.schoolCount} schools
                      </span>
                    </td>
                    <td className="text-center">
                      {div.isActive ? (
                        <span className="badge bg-success">Active</span>
                      ) : (
                        <span className="badge bg-secondary">Inactive</span>
                      )}
                    </td>
                    <td className="text-end pe-3">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-primary"
                          title="Edit Division"
                          onClick={() => openEditModal(div)}
                        >
                          <i className="bi bi-pencil-square"></i>
                        </button>
                        <button
                          className="btn btn-outline-warning text-dark"
                          title="Reset Password"
                          onClick={() => openResetModal(div)}
                        >
                          <i className="bi bi-key-fill"></i>
                        </button>
                        <button
                          className={`btn ${div.isActive ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                          title={div.isActive ? 'Deactivate Account' : 'Activate Account'}
                          onClick={() => handleToggleStatus(div)}
                        >
                          <i className={`bi ${div.isActive ? 'bi-person-slash' : 'bi-person-check'}`}></i>
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          title="Delete Division"
                          onClick={() => openDeleteModal(div)}
                        >
                          <i className="bi bi-trash3-fill"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD DIVISION */}
      {showAddModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-plus-circle-fill"></i> Add Schools Division Office Account
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                ></button>
              </div>
              <form onSubmit={handleCreateDivision}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label small fw-bold">Division Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Division of Tacloban City"
                        value={formData.divisionName}
                        onChange={(e) => setFormData({ ...formData, divisionName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-bold">Division Code</label>
                      <input
                        type="text"
                        className="form-control text-uppercase"
                        placeholder="e.g. TACLOBAN"
                        value={formData.divisionCode}
                        onChange={(e) => setFormData({ ...formData, divisionCode: e.target.value })}
                      />
                      <div className="form-text small">Auto-generated if left blank.</div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Administrator Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Dr. Maria Santos, CESO V"
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Login Username *</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        placeholder="e.g. division_tacloban"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Password *</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Minimum 8 characters"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={8}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Confirm Password *</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Re-type password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                        minLength={8}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-bold">Division Logo (PNG, JPG, WebP - max 2MB)</label>
                      <div className="d-flex align-items-center gap-3">
                        {formData.logo ? (
                          <div className="position-relative">
                            <img
                              src={formData.logo}
                              alt="Preview"
                              className="rounded border bg-light shadow-sm"
                              style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                            />
                            <button
                              type="button"
                              className="btn btn-danger btn-sm position-absolute top-0 end-0 p-0 rounded-circle"
                              style={{ width: '20px', height: '20px', transform: 'translate(40%, -40%)' }}
                              onClick={() => setFormData({ ...formData, logo: null })}
                              title="Remove logo"
                            >
                              <i className="bi bi-x"></i>
                            </button>
                          </div>
                        ) : (
                          <div
                            className="rounded border border-dashed bg-light text-muted d-flex align-items-center justify-content-center"
                            style={{ width: '60px', height: '60px' }}
                          >
                            <i className="bi bi-image fs-4"></i>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="form-control"
                          onChange={handleLogoChange}
                          disabled={logoUploading}
                        />
                      </div>
                      {logoUploading && <div className="text-primary small mt-1">Uploading logo...</div>}
                    </div>

                    <div className="col-12">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="isActiveSwitch"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        />
                        <label className="form-check-label small fw-bold" htmlFor="isActiveSwitch">
                          Activate account immediately upon creation
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    onClick={() => setShowAddModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4 fw-semibold d-flex align-items-center gap-1 shadow-sm"
                    disabled={isSubmitting || logoUploading}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill"></i> Create Division Account
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DIVISION */}
      {showEditModal && selectedDiv && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-pencil-square"></i> Edit Division: {selectedDiv.divisionName}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmitting}
                ></button>
              </div>
              <form onSubmit={handleEditDivision}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label small fw-bold">Division Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.divisionName}
                        onChange={(e) => setFormData({ ...formData, divisionName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-bold">Division Code (Read-Only)</label>
                      <input
                        type="text"
                        className="form-control bg-light text-muted"
                        value={formData.divisionCode}
                        readOnly
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Administrator Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">Login Username *</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-bold">Division Logo</label>
                      <div className="d-flex align-items-center gap-3">
                        {formData.logo ? (
                          <div className="position-relative">
                            <img
                              src={formData.logo}
                              alt="Logo"
                              className="rounded border bg-light shadow-sm"
                              style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                            />
                            <button
                              type="button"
                              className="btn btn-danger btn-sm position-absolute top-0 end-0 p-0 rounded-circle"
                              style={{ width: '20px', height: '20px', transform: 'translate(40%, -40%)' }}
                              onClick={() => setFormData({ ...formData, logo: null, removeLogo: true })}
                              title="Remove logo"
                            >
                              <i className="bi bi-x"></i>
                            </button>
                          </div>
                        ) : (
                          <div
                            className="rounded border border-dashed bg-light text-muted d-flex align-items-center justify-content-center"
                            style={{ width: '60px', height: '60px' }}
                          >
                            <i className="bi bi-image fs-4"></i>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="form-control"
                          onChange={handleLogoChange}
                          disabled={logoUploading}
                        />
                      </div>
                      {formData.removeLogo && (
                        <div className="text-warning small mt-1">Logo will be removed upon saving.</div>
                      )}
                    </div>

                    <div className="col-12">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="editActiveSwitch"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        />
                        <label className="form-check-label small fw-bold" htmlFor="editActiveSwitch">
                          Account Status: {formData.isActive ? 'Active' : 'Inactive (User cannot sign in)'}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    onClick={() => setShowEditModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4 fw-semibold d-flex align-items-center gap-1 shadow-sm"
                    disabled={isSubmitting || logoUploading}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill"></i> Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {showResetModal && selectedDiv && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '450px' }}>
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-key-fill"></i> Reset Division Administrator Password
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowResetModal(false)}
                  disabled={isSubmitting}
                ></button>
              </div>
              <form onSubmit={handleResetPassword}>
                <div className="modal-body p-4">
                  <div className="alert alert-light border small text-muted mb-3">
                    Resetting password for: <strong>{selectedDiv.adminName}</strong> (Username: <code>{selectedDiv.username}</code>).
                    The administrator will be immediately signed out of any active sessions.
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Minimum 8 characters"
                      value={resetData.newPassword}
                      onChange={(e) => setResetData({ ...resetData, newPassword: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Confirm New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Confirm password"
                      value={resetData.confirmPassword}
                      onChange={(e) => setResetData({ ...resetData, confirmPassword: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    onClick={() => setShowResetModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning btn-sm px-4 fw-bold shadow-sm"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Resetting...' : 'Confirm Password Reset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION & IMPACT */}
      {showDeleteModal && selectedDiv && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill"></i> Permanent Deletion Warning: {selectedDiv.divisionName}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isSubmitting}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="text-danger fw-bold mb-2">
                  This action cannot be undone. Deleting this Division will permanently delete all associated data in a single transaction.
                </div>

                {loadingAffected ? (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm text-danger me-2" role="status"></div>
                    <span className="small text-muted">Calculating affected records...</span>
                  </div>
                ) : affectedRecords ? (
                  <div className="card bg-light border-0 mb-3">
                    <div className="card-body p-3">
                      <h6 className="fw-bold text-dark small text-uppercase mb-2">
                        Affected Records to be Deleted:
                      </h6>
                      <ul className="list-unstyled mb-0 small">
                        <li className="mb-1">
                          <i className="bi bi-building me-2 text-danger"></i>
                          <strong>{affectedRecords.schools}</strong> School records and their user accounts
                        </li>
                        <li className="mb-1">
                          <i className="bi bi-file-earmark-check me-2 text-danger"></i>
                          <strong>{affectedRecords.assessments}</strong> SBM Assessments and <strong>{affectedRecords.responses}</strong> indicator responses
                        </li>
                        <li>
                          <i className="bi bi-person-x me-2 text-danger"></i>
                          Division Administrator account (<code>{selectedDiv.username}</code>)
                        </li>
                      </ul>

                      {affectedRecords.schoolNames.length > 0 && (
                        <div className="mt-2 pt-2 border-top">
                          <div className="text-muted small fw-semibold mb-1">Schools in this Division:</div>
                          <div className="text-muted small text-truncate" style={{ maxHeight: '60px', overflowY: 'auto' }}>
                            {affectedRecords.schoolNames.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark">
                    To confirm deletion, please type the exact division name: <strong className="text-danger">{selectedDiv.divisionName}</strong>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={`Type "${selectedDiv.divisionName}"`}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-3"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm px-4 fw-bold shadow-sm d-flex align-items-center gap-1"
                  onClick={handleDeleteDivision}
                  disabled={isSubmitting || deleteConfirmName.trim() !== selectedDiv.divisionName.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                      Deleting Division...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash3-fill"></i> Delete Division & All Data
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
