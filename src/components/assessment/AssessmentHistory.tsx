import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface AssessmentHistoryProps {
  onBack: () => void;
  targetSchoolId?: number;
}

export const AssessmentHistory: React.FC<AssessmentHistoryProps> = ({ onBack, targetSchoolId }) => {
  const { user, apiFetch } = useAuth();
  const [historyData, setHistoryData] = useState<any>(null);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveSchoolId = targetSchoolId || user?.schoolId;

  useEffect(() => {
    loadHistory();
  }, [effectiveSchoolId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/assessments/history/${effectiveSchoolId}`);
      if (res.ok) {
        const json = await res.json();
        setHistoryData(json);
        if (json.history?.length > 0) {
          setSelectedYearId(json.history[0].schoolYearId);
        }
      }
    } catch (err) {
      console.error('Failed to load assessment history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLevelBadge = (avgStr: string) => {
    const avg = parseFloat(avgStr);
    if (avg <= 0) return <span className="badge bg-secondary">Not Assessed</span>;
    if (avg < 1.5) return <span className="badge bg-danger">Level 1: Developing</span>;
    if (avg < 2.5) return <span className="badge bg-warning text-dark">Level 2: Maturing</span>;
    if (avg < 3.5) return <span className="badge bg-info text-dark">Level 3: Advanced</span>;
    return <span className="badge bg-success">Level 4: Exemplary</span>;
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="text-muted small mt-2">Loading SBM Historical Records...</div>
      </div>
    );
  }

  const school = historyData?.school;
  const historyList = historyData?.history || [];
  const activeRecord = historyList.find((h: any) => h.schoolYearId === selectedYearId) || historyList[0];

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={onBack}>
            <i className="bi bi-arrow-left me-1"></i> Back
          </button>
          <div>
            <h1 className="h4 fw-bold text-dark mb-0">SBM Historical Assessment Records</h1>
            <div className="text-muted small">
              {school?.schoolName} ({school?.schoolId}) • {school?.district}
            </div>
          </div>
        </div>

        {/* School Year Selector */}
        <div className="d-flex align-items-center gap-2 mt-2 mt-sm-0">
          <label className="small fw-semibold text-secondary">Select School Year:</label>
          <select
            className="form-select form-select-sm"
            style={{ width: '180px' }}
            value={selectedYearId || ''}
            onChange={(e) => setSelectedYearId(Number(e.target.value))}
          >
            {historyList.map((h: any) => (
              <option key={h.schoolYearId} value={h.schoolYearId}>
                SY {h.schoolYearName} {h.isActive ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeRecord ? (
        <>
          {/* Summary KPI Bar */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card border-0 shadow-sm rounded-3 p-3">
                <div className="text-muted small">Assessment Status</div>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <span
                    className={`badge px-2 py-1 ${
                      activeRecord.status === 'Submitted'
                        ? 'bg-success'
                        : activeRecord.status === 'Draft'
                        ? 'bg-warning text-dark'
                        : 'bg-secondary'
                    }`}
                  >
                    {activeRecord.status}
                  </span>
                  {activeRecord.isClosed && <span className="badge bg-danger">Closed SY</span>}
                </div>
                {activeRecord.submittedAt && (
                  <div className="text-muted small mt-1" style={{ fontSize: '0.72rem' }}>
                    Submitted: {new Date(activeRecord.submittedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <div className="card border-0 shadow-sm rounded-3 p-3">
                <div className="text-muted small">Indicators Answered</div>
                <div className="h4 fw-bold text-dark mb-0">
                  {activeRecord.indicatorsAnswered} / {activeRecord.totalActiveIndicators}
                </div>
                <div className="text-muted small mt-1" style={{ fontSize: '0.72rem' }}>
                  {activeRecord.totalActiveIndicators > 0
                    ? `${Math.round((activeRecord.indicatorsAnswered / activeRecord.totalActiveIndicators) * 100)}% Complete`
                    : 'No active indicators'}
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <div className="card border-0 shadow-sm rounded-3 p-3 bg-primary text-white">
                <div className="text-white-75 small">Overall Average Rating</div>
                <div className="display-6 fw-bold text-white mb-0">
                  {activeRecord.calculatedAverage || '0.00'}
                </div>
                <div className="small text-white-50 mt-1">Scale: 1.00 – 4.00</div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <div className="card border-0 shadow-sm rounded-3 p-3">
                <div className="text-muted small">SBM Practice Level</div>
                <div className="mt-1">{getLevelBadge(activeRecord.calculatedAverage || '0.00')}</div>
                <div className="text-muted small mt-1 fw-semibold">
                  {activeRecord.interpretation}
                </div>
              </div>
            </div>
          </div>

          {/* Section / Dimension Breakdown */}
          <div className="card border-0 shadow-sm rounded-3 mb-4">
            <div className="card-header bg-white py-3">
              <h5 className="fw-bold mb-0 text-dark">
                <i className="bi bi-graph-up me-2 text-primary"></i>
                Performance by Dimension / Section
              </h5>
            </div>
            <div className="card-body p-3">
              <div className="row g-3">
                {activeRecord.sections?.map((sec: any) => {
                  const secAvg = parseFloat(sec.average);
                  const widthPct = Math.min(100, Math.round((secAvg / 4) * 100));

                  return (
                    <div key={sec.id} className="col-12 col-md-6">
                      <div className="p-3 border rounded bg-light">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-bold text-dark">{sec.title}</span>
                          <span className="badge bg-primary fs-6">{sec.average} / 4.00</span>
                        </div>
                        <div className="progress mb-2" style={{ height: '8px' }}>
                          <div
                            className="progress-bar bg-primary"
                            role="progressbar"
                            style={{ width: `${widthPct}%` }}
                          ></div>
                        </div>
                        <div className="small text-muted">
                          Answered: {sec.answeredCount} of {sec.totalIndicators} indicators
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detailed Indicators Table */}
          <div className="card border-0 shadow-sm rounded-3 mb-4">
            <div className="card-header bg-white py-3">
              <h5 className="fw-bold mb-0 text-dark">
                <i className="bi bi-list-check me-2 text-primary"></i>
                Detailed Indicators, Ratings & MOVs
              </h5>
              <div className="text-muted small">
                Read-only official audit snapshot for School Year {activeRecord.schoolYearName}
              </div>
            </div>
            <div className="card-body p-0">
              {activeRecord.sections?.map((sec: any) => (
                <div key={sec.id} className="border-bottom">
                  <div className="bg-light px-4 py-2 fw-bold text-primary d-flex justify-content-between align-items-center">
                    <span>{sec.title}</span>
                    <span className="small text-muted">Dimension Mean: {sec.average}</span>
                  </div>

                  <div className="list-group list-group-flush">
                    {sec.indicators?.map((ind: any) => (
                      <div key={ind.id} className="list-group-item px-4 py-3">
                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                          <div style={{ maxWidth: '75%' }}>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="badge bg-secondary">{ind.code}</span>
                              <span className="fw-semibold text-dark">{ind.content}</span>
                            </div>
                            {ind.remarks ? (
                              <div className="small text-muted mt-1 ps-2 border-start border-2 border-primary">
                                <strong className="text-dark">MOVs / Remarks:</strong> {ind.remarks}
                              </div>
                            ) : (
                              <div className="small text-muted fst-italic">No remarks recorded.</div>
                            )}
                          </div>

                          <div>
                            {ind.rating > 0 ? (
                              <span
                                className={`badge px-3 py-2 fs-6 ${
                                  ind.rating === 1
                                    ? 'bg-danger'
                                    : ind.rating === 2
                                    ? 'bg-warning text-dark'
                                    : ind.rating === 3
                                    ? 'bg-info text-dark'
                                    : 'bg-success'
                                }`}
                              >
                                Level {ind.rating}
                              </span>
                            ) : (
                              <span className="badge bg-light text-muted border">Unrated</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global Remarks Snapshot */}
          {activeRecord.globalRemarks && (
            <div className="card border-0 shadow-sm rounded-3 mb-4">
              <div className="card-header bg-white py-3">
                <h6 className="fw-bold mb-0 text-dark">
                  <i className="bi bi-chat-quote text-primary me-2"></i>
                  Official Submission Remarks / Summary
                </h6>
              </div>
              <div className="card-body p-3">
                <div className="p-3 bg-light rounded text-dark small" style={{ whiteSpace: 'pre-wrap' }}>
                  {activeRecord.globalRemarks}
                </div>
                {activeRecord.submittedByName && (
                  <div className="text-muted small mt-2">
                    Submitted by: <strong>{activeRecord.submittedByName}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card border-0 shadow-sm p-4 text-center text-muted">
          <i className="bi bi-folder2-open display-4 text-secondary mb-2"></i>
          <p>No historical assessment records available for this School Year.</p>
        </div>
      )}
    </div>
  );
};
