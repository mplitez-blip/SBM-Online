import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SchoolYearItem {
  id: number;
  name: string;
  isActive: boolean;
  isClosed: boolean;
  createdAt: string;
  formStatus: 'published' | 'draft' | 'no_form';
  assessmentCount: number;
  activeIndicatorCount: number;
  answeredResponsesCount: number;
  totalResponsesCount: number;
  hasForm: boolean;
}

interface AffectedRecords {
  assessments: number;
  answeredResponses: number;
  totalResponses: number;
  forms: number;
  sections: number;
  indicators: number;
}

interface SchoolYearManagementProps {
  onNavigate?: (view: string, params?: any) => void;
}

export const SchoolYearManagement: React.FC<SchoolYearManagementProps> = ({ onNavigate }) => {
  const { apiFetch, refreshProfile } = useAuth();
  const [schoolYears, setSchoolYears] = useState<SchoolYearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  // Add School Year Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSyName, setNewSyName] = useState('');
  const [createEmptyForm, setCreateEmptyForm] = useState(false);
  const [cloneFromYearId, setCloneFromYearId] = useState<number | string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // Set Active Modal State
  const [setActiveTarget, setSetActiveTarget] = useState<SchoolYearItem | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<SchoolYearItem | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [affectedRecords, setAffectedRecords] = useState<AffectedRecords | null>(null);
  const [loadingAffected, setLoadingAffected] = useState(false);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  const loadSchoolYears = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/school-years');
      if (res.ok) {
        setSchoolYears(await res.json());
      }
    } catch (err) {
      console.error('Failed to load school years:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open Delete Modal and fetch affected records
  const handleOpenDelete = async (sy: SchoolYearItem) => {
    if (sy.isActive) {
      setAlertMsg({ type: 'danger', text: `Cannot delete active School Year '${sy.name}'.` });
      return;
    }
    setDeleteTarget(sy);
    setConfirmDeleteName('');
    setLoadingAffected(true);
    setAffectedRecords(null);

    try {
      const res = await apiFetch(`/api/school-years/${sy.id}/affected-records`);
      if (res.ok) {
        const data = await res.json();
        setAffectedRecords(data.affected);
      }
    } catch (err) {
      console.error('Failed to fetch affected records:', err);
    } finally {
      setLoadingAffected(false);
    }
  };

  // Add School Year
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);
    setActionLoading(true);

    try {
      const res = await apiFetch('/api/school-years', {
        method: 'POST',
        body: JSON.stringify({
          name: newSyName,
          createEmptyForm,
          cloneFromYearId: cloneFromYearId ? Number(cloneFromYearId) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to create school year.' });
      } else {
        setAlertMsg({ type: 'success', text: `School Year ${newSyName} created successfully.` });
        setShowAddModal(false);
        setNewSyName('');
        setCreateEmptyForm(false);
        setCloneFromYearId('');
        await loadSchoolYears();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error while creating school year.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Set Active School Year (Database transaction on server)
  const executeSetActive = async (id: number, name: string) => {
    setAlertMsg(null);
    setActionLoading(true);
    setActivatingId(id);
    try {
      const res = await apiFetch(`/api/school-years/${id}/active`, { method: 'PUT' });
      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to set active school year.' });
      } else {
        setAlertMsg({ type: 'success', text: json.message || `SY ${name} is now the active School Year.` });
        setSetActiveTarget(null);
        await loadSchoolYears();
        await refreshProfile();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error while setting active school year.' });
    } finally {
      setActionLoading(false);
      setActivatingId(null);
    }
  };

  // Toggle Closed / Reopen
  const handleToggleClosed = async (id: number) => {
    setAlertMsg(null);
    try {
      const res = await apiFetch(`/api/school-years/${id}/toggle-closed`, { method: 'PUT' });
      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to toggle status.' });
      } else {
        setAlertMsg({ type: 'success', text: json.message });
        await loadSchoolYears();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error.' });
    }
  };

  // Delete School Year (Database transaction on server)
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;

    if (confirmDeleteName.trim() !== deleteTarget.name.trim()) {
      setAlertMsg({ type: 'danger', text: 'Typed confirmation does not match the exact School Year name.' });
      return;
    }

    setAlertMsg(null);
    setActionLoading(true);

    try {
      const res = await apiFetch(`/api/school-years/${deleteTarget.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmName: confirmDeleteName.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to delete school year. Transaction rolled back.' });
      } else {
        const aff = json.affected;
        const detail = aff ? ` (${aff.assessments} assessments, ${aff.answeredResponses} answered ratings deleted)` : '';
        setAlertMsg({ type: 'success', text: `${json.message}${detail}` });
        setDeleteTarget(null);
        setConfirmDeleteName('');
        await loadSchoolYears();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error during deletion. Transaction rolled back safely.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">School Year Management</h2>
          <p className="text-secondary small mb-0">
            Define academic cycles, configure assessment forms, and monitor regional submission progress.
          </p>
        </div>

        <button
          className="btn btn-primary d-flex align-items-center gap-2 shadow-sm"
          onClick={() => setShowAddModal(true)}
        >
          <i className="bi bi-plus-lg"></i> Add New School Year
        </button>
      </div>

      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 px-3 small d-flex align-items-center gap-2 mb-3 shadow-sm`}>
          <i
            className={`bi bi-${
              alertMsg.type === 'success'
                ? 'check-circle-fill'
                : alertMsg.type === 'warning'
                ? 'exclamation-triangle-fill'
                : 'x-circle-fill'
            }`}
          ></i>
          <div>{alertMsg.text}</div>
        </div>
      )}

      {/* School Years Table */}
      <div className="card border-0 shadow-sm rounded-3">
        <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
          <h5 className="fw-bold mb-0 text-dark">Configured School Years</h5>
          <span className="badge bg-light text-secondary border">Total: {schoolYears.length} School Years</span>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light small text-secondary">
              <tr>
                <th>School Year</th>
                <th className="text-center">Status</th>
                <th className="text-center">Published or Draft Form</th>
                <th className="text-center">Number of School Assessments</th>
                <th className="text-center">Answered Indicator Ratings</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                    <div className="text-muted small mt-2">Loading School Years...</div>
                  </td>
                </tr>
              ) : schoolYears.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    No School Years found. Click 'Add New School Year' to create one.
                  </td>
                </tr>
              ) : (
                schoolYears.map((sy) => (
                  <tr key={sy.id}>
                    {/* 1. School Year */}
                    <td>
                      <div className="fw-bold text-dark fs-6">SY {sy.name}</div>
                      <div className="text-muted small">
                        Created: {new Date(sy.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    {/* 2. Status */}
                    <td className="text-center">
                      <div className="d-flex flex-column align-items-center gap-1">
                        {sy.isActive ? (
                          <span className="badge bg-success px-2 py-1">
                            <i className="bi bi-check-circle-fill me-1"></i> Active Year
                          </span>
                        ) : (
                          <button
                            id={`set-active-btn-${sy.id}`}
                            className="btn btn-outline-primary btn-sm py-0 px-2 fw-semibold shadow-sm"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => setSetActiveTarget(sy)}
                            disabled={actionLoading && activatingId === sy.id}
                            title="Set as the active School Year for the region"
                          >
                            {actionLoading && activatingId === sy.id ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-1" role="status" style={{ width: '0.7rem', height: '0.7rem' }}></span>
                                Activating...
                              </>
                            ) : (
                              'Set Active'
                            )}
                          </button>
                        )}
                        {sy.isClosed ? (
                          <span className="badge bg-danger-subtle text-danger border" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-lock-fill me-1"></i> Closed
                          </span>
                        ) : (
                          <span className="badge bg-success-subtle text-success border" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-unlock-fill me-1"></i> Open
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Published or Draft form */}
                    <td className="text-center">
                      <div className="d-flex flex-column align-items-center gap-1">
                        {sy.formStatus === 'published' ? (
                          <div>
                            <span className="badge bg-success-subtle text-success border px-2 py-1">
                              <i className="bi bi-check-circle me-1"></i> Published
                            </span>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {sy.activeIndicatorCount} indicators
                            </div>
                          </div>
                        ) : sy.formStatus === 'draft' ? (
                          <div>
                            <span className="badge bg-warning-subtle text-warning-emphasis border px-2 py-1">
                              <i className="bi bi-pencil-square me-1"></i> Draft Form
                            </span>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {sy.activeIndicatorCount} indicators
                            </div>
                          </div>
                        ) : (
                          <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">
                            No Form
                          </span>
                        )}

                        {/* Shortcut to Assessment Form Builder */}
                        {onNavigate && (
                          <button
                            id={`goto-form-builder-btn-${sy.id}`}
                            type="button"
                            className="btn btn-link btn-sm p-0 text-decoration-none d-inline-flex align-items-center gap-1 mt-1 text-primary fw-semibold"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => onNavigate('form-builder', { schoolYearId: sy.id })}
                            title={`Open Assessment Form Builder for SY ${sy.name}`}
                          >
                            <i className="bi bi-sliders2"></i>
                            <span>Assessment Form Builder</span>
                            <i className="bi bi-arrow-right-short"></i>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 4. Number of School assessments */}
                    <td className="text-center">
                      <span className="fw-bold fs-6 text-dark">{sy.assessmentCount}</span>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        {sy.assessmentCount === 1 ? 'school assessment' : 'school assessments'}
                      </div>
                    </td>

                    {/* 5. Number of answered indicator ratings */}
                    <td className="text-center">
                      <span className="fw-bold fs-6 text-primary">{sy.answeredResponsesCount}</span>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        answered ratings
                      </div>
                      <div className="text-secondary" style={{ fontSize: '0.65rem' }}>
                        (excludes blank responses)
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className={`btn ${sy.isClosed ? 'btn-outline-success' : 'btn-outline-warning'}`}
                          onClick={() => handleToggleClosed(sy.id)}
                          title={sy.isClosed ? 'Reopen submissions' : 'Close submissions'}
                        >
                          {sy.isClosed ? 'Reopen' : 'Close'}
                        </button>

                        {/* Delete action: Hidden for the active year */}
                        {!sy.isActive && (
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => handleOpenDelete(sy)}
                            title="Delete School Year (Permanently removes assessments & forms)"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add School Year Modal */}
      {showAddModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-calendar-plus me-2"></i> Add School Year
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAddModal(false)}
                ></button>
              </div>
              <form onSubmit={handleAddSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      School Year Name (Format: YYYY-YYYY)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 2025-2026"
                      value={newSyName}
                      onChange={(e) => setNewSyName(e.target.value)}
                      required
                    />
                    <div className="form-text text-muted small">
                      Must follow standard DepEd academic year naming (consecutive years).
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Assessment Form Setup</label>
                    {schoolYears.length > 0 && (
                      <div className="form-check mb-2">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="formOption"
                          id="formClone"
                          checked={!createEmptyForm}
                          onChange={() => setCreateEmptyForm(false)}
                        />
                        <label className="form-check-label small" htmlFor="formClone">
                          <strong>Clone framework from previous School Year</strong>
                          <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                            Atomically copies all dimensions and indicators within a database transaction
                          </div>
                        </label>
                        {!createEmptyForm && (
                          <select
                            className="form-select form-select-sm mt-2"
                            value={cloneFromYearId}
                            onChange={(e) => setCloneFromYearId(e.target.value)}
                          >
                            <option value="">-- Select School Year to Clone From --</option>
                            {schoolYears.map((sy) => (
                              <option key={sy.id} value={sy.id}>
                                SY {sy.name} ({sy.activeIndicatorCount} indicators)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="formOption"
                        id="formEmpty"
                        checked={createEmptyForm}
                        onChange={() => setCreateEmptyForm(true)}
                      />
                      <label className="form-check-label small" htmlFor="formEmpty">
                        <strong>Create empty form framework</strong>
                        <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                          Build sections and indicators from scratch in Form Builder
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Creating...' : 'Create School Year'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i> Delete School Year: SY {deleteTarget.name}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setDeleteTarget(null)}
                ></button>
              </div>
              <form onSubmit={handleDeleteSubmit}>
                <div className="modal-body p-4">
                  <div className="alert alert-danger py-2 px-3 small mb-3">
                    <strong>Warning:</strong> This operation is permanent and irreversible. All associated data will be removed in a single atomic database transaction.
                  </div>

                  {/* Affected Record Counts Display */}
                  <div className="card bg-light border p-3 mb-3">
                    <h6 className="fw-bold mb-2 small text-dark">
                      <i className="bi bi-graph-down text-danger me-1"></i> Affected Records to be Permanently Deleted:
                    </h6>
                    {loadingAffected ? (
                      <div className="text-center py-2">
                        <div className="spinner-border spinner-border-sm text-secondary" role="status"></div>
                        <span className="small text-muted ms-2">Calculating affected records...</span>
                      </div>
                    ) : affectedRecords ? (
                      <ul className="list-unstyled mb-0 small text-secondary">
                        <li className="d-flex justify-content-between py-1 border-bottom">
                          <span>School Assessments:</span>
                          <strong className="text-dark">{affectedRecords.assessments} records</strong>
                        </li>
                        <li className="d-flex justify-content-between py-1 border-bottom">
                          <span>Answered Indicator Ratings:</span>
                          <strong className="text-dark">{affectedRecords.answeredResponses} ratings</strong>
                        </li>
                        <li className="d-flex justify-content-between py-1 border-bottom">
                          <span>Total Stored Response Rows:</span>
                          <strong className="text-dark">{affectedRecords.totalResponses} rows</strong>
                        </li>
                        <li className="d-flex justify-content-between py-1 border-bottom">
                          <span>Form Frameworks:</span>
                          <strong className="text-dark">{affectedRecords.forms} forms</strong>
                        </li>
                        <li className="d-flex justify-content-between py-1 border-bottom">
                          <span>Form Sections / Dimensions:</span>
                          <strong className="text-dark">{affectedRecords.sections} sections</strong>
                        </li>
                        <li className="d-flex justify-content-between py-1">
                          <span>Form Indicators:</span>
                          <strong className="text-dark">{affectedRecords.indicators} indicators</strong>
                        </li>
                      </ul>
                    ) : (
                      <ul className="list-unstyled mb-0 small text-secondary">
                        <li className="d-flex justify-content-between py-1 border-bottom">
                          <span>School Assessments:</span>
                          <strong className="text-dark">{deleteTarget.assessmentCount}</strong>
                        </li>
                        <li className="d-flex justify-content-between py-1 border-bottom">
                          <span>Answered Ratings:</span>
                          <strong className="text-dark">{deleteTarget.answeredResponsesCount}</strong>
                        </li>
                        <li className="d-flex justify-content-between py-1">
                          <span>Active Indicators:</span>
                          <strong className="text-dark">{deleteTarget.activeIndicatorCount}</strong>
                        </li>
                      </ul>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      To confirm deletion, type the exact School Year name: <code className="fw-bold fs-6">{deleteTarget.name}</code>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={`Type '${deleteTarget.name}' here`}
                      value={confirmDeleteName}
                      onChange={(e) => setConfirmDeleteName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDeleteTarget(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={confirmDeleteName.trim() !== deleteTarget.name.trim() || actionLoading}
                  >
                    {actionLoading ? 'Deleting...' : 'Permanently Delete School Year'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Set Active School Year Confirmation Modal */}
      {setActiveTarget && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-primary text-white py-3">
                <h5 className="modal-title h6 fw-bold mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-calendar-check-fill text-warning"></i> Set Active School Year
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSetActiveTarget(null)}
                  disabled={actionLoading}
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="mb-3 text-dark">
                  Are you sure you want to set <strong>SY {setActiveTarget.name}</strong> as the single active School Year for the entire Region?
                </p>
                <div className="alert alert-warning py-2 px-3 small d-flex align-items-start gap-2 mb-0">
                  <i className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"></i>
                  <div>
                    Setting this year active will atomically switch regional assessment submissions and reports to <strong>SY {setActiveTarget.name}</strong>. Any currently active school year will be set to inactive.
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSetActiveTarget(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  id="confirm-set-active-btn"
                  type="button"
                  className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm"
                  onClick={() => executeSetActive(setActiveTarget.id, setActiveTarget.name)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      Activating...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle-fill"></i>
                      Confirm & Set Active
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
export default SchoolYearManagement;
