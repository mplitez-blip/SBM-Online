import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface FormBuilderProps {
  initialSchoolYearId?: number | string;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({ initialSchoolYearId }) => {
  const { apiFetch, activeSchoolYear } = useAuth();
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [selectedSyId, setSelectedSyId] = useState<number | string>(initialSchoolYearId || '');
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  // Section Modal state
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [sectionTitle, setSectionTitle] = useState('');

  // Indicator Modal state
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [indicatorParentSectionId, setIndicatorParentSectionId] = useState<number | null>(null);
  const [editingIndicator, setEditingIndicator] = useState<any>(null);
  const [indCode, setIndCode] = useState('');
  const [indContent, setIndContent] = useState('');
  const [indActive, setIndActive] = useState(true);
  const [indRequired, setIndRequired] = useState(true);

  // Clone Modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceYearId, setCloneSourceYearId] = useState<number | string>('');
  const [cloneLoading, setCloneLoading] = useState(false);

  // Confirmation Modals
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'section' | 'indicator';
    id: number;
    title: string;
    hasDependencies?: boolean;
    count?: number;
  } | null>(null);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  useEffect(() => {
    if (initialSchoolYearId) {
      setSelectedSyId(initialSchoolYearId);
    }
  }, [initialSchoolYearId]);

  const loadSchoolYears = async () => {
    try {
      const res = await apiFetch('/api/school-years');
      if (res.ok) {
        const list = await res.json();
        setSchoolYears(list);
        if (initialSchoolYearId && list.some((s: any) => String(s.id) === String(initialSchoolYearId))) {
          setSelectedSyId(initialSchoolYearId);
        } else if (selectedSyId && list.some((s: any) => String(s.id) === String(selectedSyId))) {
          // preserve existing selection
        } else {
          const active = list.find((s: any) => s.isActive);
          if (active) setSelectedSyId(active.id);
          else if (list.length > 0) setSelectedSyId(list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load school years:', err);
    }
  };

  useEffect(() => {
    if (selectedSyId) {
      loadFormData(Number(selectedSyId));
    }
  }, [selectedSyId]);

  const loadFormData = async (syId: number) => {
    setLoading(true);
    setAlertMsg(null);
    try {
      const res = await apiFetch(`/api/forms/year/${syId}`);
      if (res.ok) {
        setFormData(await res.json());
      }
    } catch (err) {
      console.error('Failed to load form builder data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Publish / Draft
  const handleTogglePublish = async () => {
    if (!formData?.form) return;
    setSaving(true);
    setAlertMsg(null);
    try {
      const res = await apiFetch(`/api/forms/${formData.form.id}/publish`, { method: 'PUT' });
      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to toggle form status.' });
      } else {
        setAlertMsg({ type: 'success', text: json.message });
        await loadFormData(Number(selectedSyId));
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error toggling status.' });
    } finally {
      setSaving(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData?.form) return;
    setSaving(true);
    setAlertMsg(null);

    try {
      const form = formData.form;
      const res = await apiFetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: form.title,
          instructions: form.instructions,
          ratingLabel1: form.ratingLabel1,
          ratingLabel2: form.ratingLabel2,
          ratingLabel3: form.ratingLabel3,
          ratingLabel4: form.ratingLabel4,
          requireAllIndicators: form.requireAllIndicators,
          requireIndicatorRemarks: form.requireIndicatorRemarks,
          requireGlobalRemarks: form.requireGlobalRemarks,
          allowEditAfterSubmission: form.allowEditAfterSubmission,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to update settings.' });
      } else {
        setAlertMsg({ type: 'success', text: 'Form configuration and rating scale saved successfully.' });
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error.' });
    } finally {
      setSaving(false);
    }
  };

  // Section Create/Edit
  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionTitle.trim()) return;

    try {
      if (editingSection) {
        const res = await apiFetch(`/api/forms/sections/${editingSection.id}`, {
          method: 'PUT',
          body: JSON.stringify({ title: sectionTitle }),
        });
        if (!res.ok) throw new Error('Failed to update section.');
        setAlertMsg({ type: 'success', text: 'Dimension title updated.' });
      } else {
        const res = await apiFetch(`/api/forms/sections`, {
          method: 'POST',
          body: JSON.stringify({ formId: formData.form.id, title: sectionTitle }),
        });
        if (!res.ok) throw new Error('Failed to add section.');
        setAlertMsg({ type: 'success', text: 'New dimension added.' });
      }
      setShowSectionModal(false);
      await loadFormData(Number(selectedSyId));
    } catch (err: any) {
      setAlertMsg({ type: 'danger', text: err.message || 'Operation failed.' });
    }
  };

  // Indicator Create/Edit
  const handleIndicatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indCode.trim() || !indContent.trim()) return;

    try {
      if (editingIndicator) {
        const res = await apiFetch(`/api/forms/indicators/${editingIndicator.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            code: indCode,
            content: indContent,
            isActive: indActive,
          }),
        });
        if (!res.ok) throw new Error('Failed to update indicator.');
        setAlertMsg({ type: 'success', text: 'Indicator updated.' });
      } else {
        const res = await apiFetch(`/api/forms/indicators`, {
          method: 'POST',
          body: JSON.stringify({
            formId: formData.form.id,
            sectionId: indicatorParentSectionId,
            code: indCode,
            content: indContent,
            isActive: indActive,
          }),
        });
        if (!res.ok) throw new Error('Failed to add indicator.');
        setAlertMsg({ type: 'success', text: 'Indicator added.' });
      }
      setShowIndicatorModal(false);
      await loadFormData(Number(selectedSyId));
    } catch (err: any) {
      setAlertMsg({ type: 'danger', text: err.message || 'Operation failed.' });
    }
  };

  // Toggle Indicator Active Status
  const handleToggleIndicatorActive = async (indicatorId: number) => {
    try {
      const res = await apiFetch(`/api/forms/indicators/${indicatorId}/toggle-active`, { method: 'PUT' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to toggle status.');
      setAlertMsg({ type: 'success', text: json.message });
      await loadFormData(Number(selectedSyId));
    } catch (err: any) {
      setAlertMsg({ type: 'danger', text: err.message || 'Operation failed.' });
    }
  };

  // Delete Section / Indicator
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      let res;
      if (confirmDelete.type === 'section') {
        res = await apiFetch(`/api/forms/sections/${confirmDelete.id}`, { method: 'DELETE' });
      } else {
        res = await apiFetch(`/api/forms/indicators/${confirmDelete.id}`, { method: 'DELETE' });
      }

      if (!res.ok) throw new Error('Failed to delete item.');
      setAlertMsg({ type: 'success', text: `${confirmDelete.type === 'section' ? 'Dimension' : 'Indicator'} deleted.` });
      setConfirmDelete(null);
      await loadFormData(Number(selectedSyId));
    } catch (err: any) {
      setAlertMsg({ type: 'danger', text: err.message || 'Failed to delete.' });
    }
  };

  // Move Section Up/Down
  const handleMoveSection = async (sectionId: number, direction: 'up' | 'down') => {
    const sections = [...formData.form.sections];
    const index = sections.findIndex((s) => s.id === sectionId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = sections[index];
    sections[index] = sections[targetIndex];
    sections[targetIndex] = temp;

    const orderedSectionIds = sections.map((s) => s.id);
    try {
      const res = await apiFetch(`/api/forms/sections/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ orderedSectionIds }),
      });
      if (res.ok) {
        await loadFormData(Number(selectedSyId));
      }
    } catch (err) {
      console.error('Failed to reorder sections:', err);
    }
  };

  // Clone Form from another year (Database Transaction)
  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSourceYearId || !formData?.form) return;

    setCloneLoading(true);
    setAlertMsg(null);
    try {
      const res = await apiFetch(`/api/forms/${formData.form.id}/clone-from/${cloneSourceYearId}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to clone form framework.' });
      } else {
        setAlertMsg({ type: 'success', text: json.message });
        setShowCloneModal(false);
        setCloneSourceYearId('');
        await loadFormData(Number(selectedSyId));
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error cloning form.' });
    } finally {
      setCloneLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <div className="badge bg-danger text-uppercase px-2 py-1 mb-1">
            Regional Administration
          </div>
          <h1 className="h4 fw-bold text-dark mb-0">SBM Assessment Form & Dimensions Builder</h1>
          <div className="text-muted small">
            Configure assessment dimensions, indicators, rating scale labels, and publishing status.
          </div>
        </div>

        {/* School Year Selector & Actions */}
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <label className="small fw-semibold text-secondary">Target School Year:</label>
          <select
            className="form-select form-select-sm"
            style={{ width: '220px' }}
            value={selectedSyId}
            onChange={(e) => setSelectedSyId(e.target.value)}
          >
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>
                SY {sy.name} {sy.isActive ? '(Active)' : ''} - {sy.formStatus === 'published' ? 'Published' : 'Draft'}
              </option>
            ))}
          </select>
        </div>
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

      {/* WARNING WHEN ASSESSMENTS ALREADY EXIST FOR THE SELECTED YEAR */}
      {formData?.hasAssessments && (
        <div className="alert alert-warning border-warning shadow-sm d-flex align-items-start gap-3 mb-4 p-3 rounded-3">
          <i className="bi bi-exclamation-triangle-fill fs-3 text-warning flex-shrink-0 mt-1"></i>
          <div className="flex-grow-1">
            <h6 className="alert-heading fw-bold text-dark mb-1">
              ⚠️ Warning: Active School Assessments Exist ({formData.assessmentCount} Recorded)
            </h6>
            <div className="small text-secondary">
              There are currently <strong>{formData.assessmentCount} school assessments</strong> and <strong>{formData.answeredResponsesCount} answered indicator ratings</strong> associated with SY {formData.schoolYear?.name}.
              Modifying indicator codes, deleting dimensions, or altering rating scales may invalidate existing school submissions or distort regional analytical reports. Please proceed with caution.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <div className="text-muted small mt-2">Loading Assessment Form Configuration...</div>
        </div>
      ) : !formData?.form ? (
        <div className="card border-0 shadow-sm p-4 text-center text-muted">
          <i className="bi bi-file-earmark-x display-4 text-secondary mb-2"></i>
          <h5 className="text-dark fw-bold">No Assessment Form Exists</h5>
          <p className="small mb-3">No assessment form has been initialized for SY {formData?.schoolYear?.name}.</p>
          <div className="d-flex justify-content-center gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCloneModal(true)}
            >
              <i className="bi bi-copy me-1"></i> Clone from Previous School Year
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Left Column: Form Settings, Status & Rating Labels */}
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm rounded-3 mb-4 sticky-top" style={{ top: '1rem' }}>
              <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                <h5 className="fw-bold mb-0 text-dark">
                  <i className="bi bi-gear-fill text-primary me-2"></i> Form Rules & Scale
                </h5>
                {/* Form Status Badge & Toggle */}
                <div>
                  {formData.form.status === 'published' ? (
                    <span className="badge bg-success-subtle text-success border px-2 py-1">
                      <i className="bi bi-check-circle-fill me-1"></i> Published
                    </span>
                  ) : (
                    <span className="badge bg-warning-subtle text-warning-emphasis border px-2 py-1">
                      <i className="bi bi-pencil-square me-1"></i> Draft Mode
                    </span>
                  )}
                </div>
              </div>
              <div className="card-body p-3">
                {/* Publish Toggle Button */}
                <div className="d-grid mb-3">
                  <button
                    className={`btn btn-sm ${formData.form.status === 'published' ? 'btn-outline-warning' : 'btn-success'}`}
                    onClick={handleTogglePublish}
                    disabled={saving}
                  >
                    <i className={`bi ${formData.form.status === 'published' ? 'bi-arrow-counterclockwise' : 'bi-send-check'} me-1`}></i>
                    {formData.form.status === 'published' ? 'Return Form to Draft' : 'Publish Form for Schools'}
                  </button>
                </div>

                <form onSubmit={handleSaveSettings}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Assessment Title</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.form.title}
                      onChange={(e) =>
                        setFormData({ ...formData, form: { ...formData.form, title: e.target.value } })
                      }
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Instructions for Schools</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      value={formData.form.instructions}
                      onChange={(e) =>
                        setFormData({ ...formData, form: { ...formData.form, instructions: e.target.value } })
                      }
                      required
                    ></textarea>
                  </div>

                  <div className="mb-3 border-top pt-3">
                    <label className="form-label small fw-bold text-dark">Four Rating Scale Labels</label>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label text-danger" style={{ fontSize: '0.72rem' }}>
                          Level 1 (Developing)
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.form.ratingLabel1}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              form: { ...formData.form, ratingLabel1: e.target.value },
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label text-warning" style={{ fontSize: '0.72rem' }}>
                          Level 2 (Maturing)
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.form.ratingLabel2}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              form: { ...formData.form, ratingLabel2: e.target.value },
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label text-info" style={{ fontSize: '0.72rem' }}>
                          Level 3 (Advanced)
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.form.ratingLabel3}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              form: { ...formData.form, ratingLabel3: e.target.value },
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label text-success" style={{ fontSize: '0.72rem' }}>
                          Level 4 (Exemplary)
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.form.ratingLabel4}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              form: { ...formData.form, ratingLabel4: e.target.value },
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 border-top pt-3">
                    <label className="form-label small fw-bold text-dark">Submission Policies</label>

                    <div className="form-check form-switch mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="reqAll"
                        checked={formData.form.requireAllIndicators}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            form: { ...formData.form, requireAllIndicators: e.target.checked },
                          })
                        }
                      />
                      <label className="form-check-label small" htmlFor="reqAll">
                        Require all indicators before submit
                      </label>
                    </div>

                    <div className="form-check form-switch mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="reqIndRemarks"
                        checked={formData.form.requireIndicatorRemarks}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            form: { ...formData.form, requireIndicatorRemarks: e.target.checked },
                          })
                        }
                      />
                      <label className="form-check-label small" htmlFor="reqIndRemarks">
                        Require remarks / MOVs per indicator
                      </label>
                    </div>

                    <div className="form-check form-switch mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="reqGlobal"
                        checked={formData.form.requireGlobalRemarks}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            form: { ...formData.form, requireGlobalRemarks: e.target.checked },
                          })
                        }
                      />
                      <label className="form-check-label small" htmlFor="reqGlobal">
                        Require overall school reflection remarks
                      </label>
                    </div>

                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="allowEdit"
                        checked={formData.form.allowEditAfterSubmission}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            form: { ...formData.form, allowEditAfterSubmission: e.target.checked },
                          })
                        }
                      />
                      <label className="form-check-label small" htmlFor="allowEdit">
                        Allow editing after submission
                      </label>
                    </div>
                  </div>

                  <div className="d-grid gap-2 border-top pt-3">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setShowCloneModal(true)}
                    >
                      <i className="bi bi-copy me-1"></i> Clone Framework from Another Year
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Right Column: Variable Dimensions and Indicators Editor */}
          <div className="col-12 col-lg-8">
            <div className="card border-0 shadow-sm rounded-3 mb-4">
              <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <h5 className="fw-bold mb-0 text-dark">
                    Assessment Dimensions & Indicators ({formData.form.sections?.length || 0} Sections)
                  </h5>
                  <div className="text-muted small">
                    Supports a variable number of sections and indicators for SY {formData.schoolYear.name}.
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
                  onClick={() => {
                    setEditingSection(null);
                    setSectionTitle('');
                    setShowSectionModal(true);
                  }}
                >
                  <i className="bi bi-folder-plus"></i> Add Dimension
                </button>
              </div>

              <div className="card-body p-3">
                {formData.form.sections?.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-folder-x fs-1 d-block text-secondary mb-2"></i>
                    <h6>No Dimensions Created Yet</h6>
                    <p className="small mb-3">Click 'Add Dimension' to create the first section for this assessment.</p>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        setEditingSection(null);
                        setSectionTitle('');
                        setShowSectionModal(true);
                      }}
                    >
                      <i className="bi bi-plus-lg me-1"></i> Add First Dimension
                    </button>
                  </div>
                ) : (
                  formData.form.sections.map((sec: any, secIdx: number) => (
                    <div key={sec.id} className="card border rounded-3 mb-4 overflow-hidden">
                      {/* Section Header */}
                      <div className="card-header bg-light py-2 px-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-primary px-2 py-1">Dim {secIdx + 1}</span>
                          <span className="fw-bold text-dark fs-6">{sec.title}</span>
                          <span className="badge bg-secondary-subtle text-secondary small">
                            {sec.indicators?.length || 0} {sec.indicators?.length === 1 ? 'indicator' : 'indicators'}
                          </span>
                        </div>

                        <div className="d-flex align-items-center gap-1">
                          <button
                            className="btn btn-sm btn-link text-secondary p-0 px-1"
                            onClick={() => handleMoveSection(sec.id, 'up')}
                            disabled={secIdx === 0}
                            title="Move Dimension Up"
                          >
                            <i className="bi bi-arrow-up"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-link text-secondary p-0 px-1"
                            onClick={() => handleMoveSection(sec.id, 'down')}
                            disabled={secIdx === formData.form.sections.length - 1}
                            title="Move Dimension Down"
                          >
                            <i className="bi bi-arrow-down"></i>
                          </button>
                          <div className="vr mx-1"></div>
                          <button
                            className="btn btn-outline-secondary btn-sm py-0 px-2"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => {
                              setEditingSection(sec);
                              setSectionTitle(sec.title);
                              setShowSectionModal(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm py-0 px-2"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => {
                              setConfirmDelete({
                                type: 'section',
                                id: sec.id,
                                title: sec.title,
                                hasDependencies: (sec.indicators?.length || 0) > 0,
                                count: sec.indicators?.length || 0,
                              });
                            }}
                          >
                            Delete
                          </button>
                          <button
                            className="btn btn-success btn-sm py-0 px-2 ms-2"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => {
                              setIndicatorParentSectionId(sec.id);
                              setEditingIndicator(null);
                              setIndCode('');
                              setIndContent('');
                              setIndActive(true);
                              setIndRequired(true);
                              setShowIndicatorModal(true);
                            }}
                          >
                            <i className="bi bi-plus-lg me-1"></i> Add Indicator
                          </button>
                        </div>
                      </div>

                      {/* Indicator List */}
                      <div className="card-body p-0">
                        {sec.indicators?.length === 0 ? (
                          <div className="p-3 text-muted small text-center">
                            No indicators in this dimension. Click 'Add Indicator' to add one.
                          </div>
                        ) : (
                          <div className="list-group list-group-flush">
                            {sec.indicators.map((ind: any) => (
                              <div key={ind.id} className="list-group-item p-3">
                                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                                  <div style={{ maxWidth: '75%' }}>
                                    <div className="d-flex align-items-center gap-2 mb-1">
                                      <span className="badge bg-secondary font-monospace">{ind.code}</span>
                                      <span className="fw-semibold text-dark">{ind.content}</span>
                                    </div>
                                    <div className="d-flex gap-2 small">
                                      {ind.isActive ? (
                                        <span className="text-success">
                                          <i className="bi bi-check-circle me-1"></i> Active
                                        </span>
                                      ) : (
                                        <span className="text-secondary">
                                          <i className="bi bi-pause-circle me-1"></i> Inactive
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="btn-group btn-group-sm">
                                    <button
                                      className={`btn ${ind.isActive ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                      style={{ fontSize: '0.75rem' }}
                                      onClick={() => handleToggleIndicatorActive(ind.id)}
                                      title={ind.isActive ? 'Deactivate indicator' : 'Activate indicator'}
                                    >
                                      {ind.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                      className="btn btn-outline-secondary"
                                      style={{ fontSize: '0.75rem' }}
                                      onClick={() => {
                                        setIndicatorParentSectionId(sec.id);
                                        setEditingIndicator(ind);
                                        setIndCode(ind.code);
                                        setIndContent(ind.content);
                                        setIndActive(ind.isActive);
                                        setShowIndicatorModal(true);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="btn btn-outline-danger"
                                      style={{ fontSize: '0.75rem' }}
                                      onClick={() => {
                                        setConfirmDelete({
                                          type: 'indicator',
                                          id: ind.id,
                                          title: `${ind.code} - ${ind.content.substring(0, 30)}...`,
                                        });
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section Modal */}
      {showSectionModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-folder me-2"></i>
                  {editingSection ? 'Edit Dimension Title' : 'Add New Dimension'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowSectionModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSectionSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Dimension Title</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Leadership and Governance"
                      value={sectionTitle}
                      onChange={(e) => setSectionTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowSectionModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingSection ? 'Update Dimension' : 'Create Dimension'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Indicator Modal */}
      {showIndicatorModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-bookmark-plus me-2"></i>
                  {editingIndicator ? 'Edit Indicator' : 'Add New Indicator'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowIndicatorModal(false)}
                ></button>
              </div>
              <form onSubmit={handleIndicatorSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Indicator Code / Label</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 1.1 or A-1"
                      value={indCode}
                      onChange={(e) => setIndCode(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Indicator Description / Content</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Specify the standard or statement to be evaluated..."
                      value={indContent}
                      onChange={(e) => setIndContent(e.target.value)}
                      required
                    ></textarea>
                  </div>

                  <div className="form-check form-switch mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="indActiveCheck"
                      checked={indActive}
                      onChange={(e) => setIndActive(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="indActiveCheck">
                      Active (included in current evaluations)
                    </label>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowIndicatorModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingIndicator ? 'Update Indicator' : 'Save Indicator'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Clone Framework Modal */}
      {showCloneModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-copy me-2"></i> Clone Assessment Form Framework
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowCloneModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCloneSubmit}>
                <div className="modal-body p-4">
                  <p className="small text-secondary mb-3">
                    Clone all dimensions and indicators from another school year into <strong>SY {formData?.schoolYear?.name}</strong>.
                    This runs as an atomic database transaction.
                  </p>

                  {formData?.hasAssessments && (
                    <div className="alert alert-danger py-2 px-3 small mb-3">
                      <strong>Warning:</strong> {formData.assessmentCount} school assessments exist for this school year. Cloning will replace the current framework.
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Source School Year to Clone From</label>
                    <select
                      className="form-select"
                      value={cloneSourceYearId}
                      onChange={(e) => setCloneSourceYearId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Source School Year --</option>
                      {schoolYears
                        .filter((s) => s.id !== Number(selectedSyId))
                        .map((sy) => (
                          <option key={sy.id} value={sy.id}>
                            SY {sy.name} ({sy.activeIndicatorCount} indicators)
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCloneModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!cloneSourceYearId || cloneLoading}
                  >
                    {cloneLoading ? 'Cloning within transaction...' : 'Clone Framework'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i> Confirm Deletion
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setConfirmDelete(null)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="mb-2">
                  Are you sure you want to delete this {confirmDelete.type === 'section' ? 'dimension' : 'indicator'}?
                </p>
                <div className="p-2 bg-light border rounded small fw-bold text-dark mb-3">
                  {confirmDelete.title}
                </div>

                {confirmDelete.hasDependencies && (
                  <div className="alert alert-warning py-2 px-3 small mb-2">
                    <strong>Notice:</strong> This dimension currently contains <strong>{confirmDelete.count} indicators</strong>. All child indicators will also be removed.
                  </div>
                )}

                {formData?.hasAssessments && (
                  <div className="alert alert-danger py-2 px-3 small mb-0">
                    <strong>⚠️ Caution:</strong> {formData.assessmentCount} school assessments exist for this school year! Deleting items may invalidate existing school submissions.
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmDelete}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default FormBuilder;
