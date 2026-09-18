import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SchoolYearOption {
  id: number;
  name: string;
  isActive: boolean;
  isClosed: boolean;
}

interface DivisionOption {
  id: number;
  divisionName: string;
}

interface ExportConsolidatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSchoolYearId?: number | string;
  defaultDivisionId?: number | string;
}

export const ExportConsolidatedModal: React.FC<ExportConsolidatedModalProps> = ({
  isOpen,
  onClose,
  defaultSchoolYearId,
  defaultDivisionId,
}) => {
  const { user, apiFetch, activeSchoolYear } = useAuth();
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [selectedSyId, setSelectedSyId] = useState<string>(
    defaultSchoolYearId
      ? String(defaultSchoolYearId)
      : activeSchoolYear
      ? String(activeSchoolYear.id)
      : ''
  );
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(
    defaultDivisionId ? String(defaultDivisionId) : 'all'
  );
  const [loadingOptions, setLoadingOptions] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initial selections whenever modal opens or default props change
  useEffect(() => {
    if (defaultSchoolYearId) {
      setSelectedSyId(String(defaultSchoolYearId));
    } else if (activeSchoolYear) {
      setSelectedSyId(String(activeSchoolYear.id));
    }
  }, [defaultSchoolYearId, activeSchoolYear, isOpen]);

  useEffect(() => {
    if (defaultDivisionId) {
      setSelectedDivisionId(String(defaultDivisionId));
    }
  }, [defaultDivisionId, isOpen]);

  // Load configured School Years & Divisions using authenticated apiFetch
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setLoadingOptions(true);

    const fetchData = async () => {
      try {
        const [syRes, divRes] = await Promise.all([
          apiFetch('/api/school-years'),
          user?.role === 'regional' ? apiFetch('/api/divisions') : Promise.resolve(null),
        ]);

        if (syRes.ok) {
          const syData = await syRes.json();
          setSchoolYears(Array.isArray(syData) ? syData : []);
          
          // Select active school year or first available if not already selected
          setSelectedSyId((prevSelected) => {
            if (prevSelected && syData.some((s: SchoolYearOption) => String(s.id) === String(prevSelected))) {
              return prevSelected;
            }
            if (defaultSchoolYearId && syData.some((s: SchoolYearOption) => String(s.id) === String(defaultSchoolYearId))) {
              return String(defaultSchoolYearId);
            }
            if (activeSchoolYear && syData.some((s: SchoolYearOption) => String(s.id) === String(activeSchoolYear.id))) {
              return String(activeSchoolYear.id);
            }
            const active = syData.find((s: SchoolYearOption) => s.isActive);
            if (active) return String(active.id);
            if (syData.length > 0) return String(syData[0].id);
            return '';
          });
        } else {
          const errData = await syRes.json().catch(() => ({}));
          setErrorMessage(errData.error || 'Failed to load school years. Please refresh and try again.');
        }

        if (divRes && divRes.ok) {
          const divData = await divRes.json();
          setDivisions(Array.isArray(divData) ? divData : []);
        }
      } catch (err: any) {
        console.error('Failed to load export options:', err);
        setErrorMessage('Unable to load configured School Years. Please check connection.');
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchData();
  }, [isOpen, user?.role, defaultSchoolYearId, activeSchoolYear]);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedSyId) {
      setErrorMessage('Please select a configured School Year.');
      return;
    }

    setIsExporting(true);

    try {
      let url = `/api/export/excel?schoolYearId=${encodeURIComponent(selectedSyId)}`;
      if (user?.role === 'regional' && selectedDivisionId && selectedDivisionId !== 'all') {
        url += `&divisionId=${encodeURIComponent(selectedDivisionId)}`;
      } else if (user?.role === 'division' && user?.divisionId) {
        url += `&divisionId=${encodeURIComponent(user.divisionId)}`;
      }

      const response = await apiFetch(url);

      if (!response.ok) {
        let errorText = 'Failed to generate Excel report. Please try again.';
        try {
          const errorData = await response.json();
          if (errorData.error) errorText = errorData.error;
        } catch {}
        setErrorMessage(errorText);
        setIsExporting(false);
        return;
      }

      // Read Content-Disposition header for filename if available
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'SBM_Consolidated_Report.xlsx';
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setIsExporting(false);
      onClose();
    } catch (err: any) {
      console.error('Export download error:', err);
      setErrorMessage('A network error occurred while downloading the report. Please try again.');
      setIsExporting(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-3">
          <div className="modal-header bg-primary text-white py-3">
            <h5 className="modal-title h6 fw-bold mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-file-earmark-excel-fill text-warning fs-5"></i>
              Export Consolidated Excel Report (ExcelJS)
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={isExporting}
            ></button>
          </div>

          <form onSubmit={handleExport}>
            <div className="modal-body p-4">
              {errorMessage && (
                <div className="alert alert-danger d-flex align-items-start gap-2 py-2 px-3 small mb-3">
                  <i className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"></i>
                  <div>{errorMessage}</div>
                </div>
              )}

              {loadingOptions ? (
                <div className="text-center py-4 text-muted small">
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  Loading configured School Years...
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark">
                      Select Configured School Year <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={selectedSyId}
                      onChange={(e) => setSelectedSyId(e.target.value)}
                      disabled={isExporting}
                      required
                    >
                      <option value="" disabled>
                        -- Select School Year --
                      </option>
                      {schoolYears.map((sy) => (
                        <option key={sy.id} value={sy.id}>
                          SY {sy.name} {sy.isActive ? '(Active)' : sy.isClosed ? '(Closed)' : ''}
                        </option>
                      ))}
                    </select>
                    <div className="form-text small">
                      Export retrieves the selected year’s saved AssessmentForm and active indicators at export time.
                    </div>
                  </div>

                  {user?.role === 'regional' && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-dark">Export Geographic Scope</label>
                      <select
                        className="form-select"
                        value={selectedDivisionId}
                        onChange={(e) => setSelectedDivisionId(e.target.value)}
                        disabled={isExporting}
                      >
                        <option value="all">All 13 Schools Divisions (Full Regional Scope)</option>
                        {divisions.map((div) => (
                          <option key={div.id} value={div.id}>
                            {div.divisionName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {user?.role === 'division' && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-dark">Division Scope</label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value="Your Assigned Division Only (Strict Scope Enforced)"
                        disabled
                      />
                    </div>
                  )}

                  <div className="card bg-light border-0 p-3 rounded-2 mt-3">
                    <div className="fw-bold small text-primary mb-1">
                      <i className="bi bi-layers-fill me-1"></i> 5 Worksheets Included:
                    </div>
                    <ul className="small text-muted mb-0 ps-3">
                      <li>
                        <strong>1. Consolidated Results:</strong> Schools grouped by classification with section and overall averages
                      </li>
                      <li>
                        <strong>2. Detailed Consolidated Ratings:</strong> School-by-school matrix containing rating for each configured indicator
                      </li>
                      <li>
                        <strong>3. Indicator Summary:</strong> Item analysis and frequency counts excluding inactive indicators
                      </li>
                      <li>
                        <strong>4. Export Information:</strong> Full audit manifest, parameters, and metadata
                      </li>
                      <li>
                        <strong>5. Form Snapshot:</strong> Configured wording, dimensions, and active indicator hierarchy
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onClose}
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm px-3"
                disabled={isExporting || loadingOptions || !selectedSyId}
              >
                {isExporting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    Generating Report...
                  </>
                ) : (
                  <>
                    <i className="bi bi-download me-1"></i>
                    Download Excel (.xlsx)
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

export default ExportConsolidatedModal;
