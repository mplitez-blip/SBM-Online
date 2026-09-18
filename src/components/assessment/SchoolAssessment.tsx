import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SchoolAssessmentProps {
  onBack: () => void;
  targetSchoolId?: number; // For division/regional inspection
}

export const SchoolAssessment: React.FC<SchoolAssessmentProps> = ({ onBack, targetSchoolId }) => {
  const { user, apiFetch, activeSchoolYear } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [responses, setResponses] = useState<Map<number, { rating: number; remarks: string }>>(new Map());
  const [globalRemarks, setGlobalRemarks] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitterName, setSubmitterName] = useState(user?.fullName || '');

  // Active section tab
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

  const effectiveSchoolId = targetSchoolId || user?.schoolId;

  useEffect(() => {
    loadAssessment();
  }, [effectiveSchoolId, activeSchoolYear]);

  const loadAssessment = async () => {
    setLoading(true);
    setAlertMsg(null);
    try {
      const url = effectiveSchoolId ? `/api/assessments/active?schoolId=${effectiveSchoolId}` : '/api/assessments/active';
      const res = await apiFetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);

        if (json.form?.sections?.length > 0) {
          setActiveSectionId(json.form.sections[0].id);

          // Populate responses map
          const respMap = new Map<number, { rating: number; remarks: string }>();
          for (const sec of json.form.sections) {
            for (const ind of sec.indicators || []) {
              respMap.set(ind.id, {
                rating: ind.rating || 0,
                remarks: ind.remarks || '',
              });
            }
          }
          setResponses(respMap);
        }

        if (json.assessment) {
          setGlobalRemarks(json.assessment.globalRemarks || '');
          if (json.assessment.submittedByName) {
            setSubmitterName(json.assessment.submittedByName);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load school assessment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (indicatorId: number, ratingVal: number) => {
    if (isLocked) return;
    const current = responses.get(indicatorId) || { rating: 0, remarks: '' };
    const updated = new Map(responses);
    updated.set(indicatorId, { ...current, rating: ratingVal });
    setResponses(updated);
  };

  const handleRemarksChange = (indicatorId: number, remarksVal: string) => {
    if (isLocked) return;
    const current = responses.get(indicatorId) || { rating: 0, remarks: '' };
    const updated = new Map(responses);
    updated.set(indicatorId, { ...current, remarks: remarksVal });
    setResponses(updated);
  };

  // Convert map to array for payload
  const buildResponsesPayload = () => {
    const list: any[] = [];
    responses.forEach((val, indicatorId) => {
      list.push({
        indicatorId,
        rating: val.rating,
        remarks: val.remarks,
      });
    });
    return list;
  };

  // Calculate stats
  let totalActiveIndicators = 0;
  let answeredCount = 0;
  let totalScore = 0;

  if (data?.form?.sections) {
    for (const sec of data.form.sections) {
      for (const ind of sec.indicators || []) {
        totalActiveIndicators++;
        const r = responses.get(ind.id);
        if (r && r.rating > 0) {
          answeredCount++;
          totalScore += r.rating;
        }
      }
    }
  }

  const currentAverage = answeredCount > 0 ? (totalScore / answeredCount).toFixed(2) : '0.00';
  const progressPercent = totalActiveIndicators > 0 ? Math.round((answeredCount / totalActiveIndicators) * 100) : 0;

  // Save Draft
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setAlertMsg(null);
    try {
      const res = await apiFetch('/api/assessments/save-draft', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          schoolYearId: data.schoolYear.id,
          globalRemarks,
          responses: buildResponsesPayload(),
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: resJson.error || 'Failed to save draft.' });
      } else {
        setAlertMsg({ type: 'success', text: 'Assessment draft saved successfully.' });
      }
    } catch (err: any) {
      setAlertMsg({ type: 'danger', text: 'Network error while saving draft.' });
    } finally {
      setSavingDraft(false);
    }
  };

  // Submit Assessment
  const handleSubmitAssessment = async () => {
    setSubmitting(true);
    setAlertMsg(null);
    try {
      const res = await apiFetch('/api/assessments/submit', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: effectiveSchoolId,
          schoolYearId: data.schoolYear.id,
          globalRemarks,
          submitterName,
          responses: buildResponsesPayload(),
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: resJson.error || 'Failed to submit assessment.' });
        setShowSubmitConfirm(false);
      } else {
        setAlertMsg({
          type: 'success',
          text: `Assessment successfully submitted and recorded! Calculated Average: ${resJson.calculatedAverage} (${resJson.interpretation})`,
        });
        setShowSubmitConfirm(false);
        await loadAssessment();
      }
    } catch (err: any) {
      setAlertMsg({ type: 'danger', text: 'Network error while submitting assessment.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="text-muted small mt-2">Loading Assessment Form...</div>
      </div>
    );
  }

  if (!data?.available) {
    return (
      <div className="container py-5">
        <div className="card border-0 shadow-sm p-4 text-center">
          <i className="bi bi-exclamation-triangle text-warning display-4 mb-3"></i>
          <h4>Assessment Unavailable</h4>
          <p className="text-muted">{data?.message || 'No active assessment form found.'}</p>
          <div>
            <button className="btn btn-secondary" onClick={onBack}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const form = data.form;
  const assessment = data.assessment;
  const isLocked = assessment.isLocked;

  const currentSection = form.sections?.find((s: any) => s.id === activeSectionId) || form.sections?.[0];

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Top Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom gap-2">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={onBack}>
            <i className="bi bi-arrow-left me-1"></i> Back
          </button>
          <div>
            <h1 className="h4 fw-bold text-dark mb-0">{form.title}</h1>
            <div className="text-muted small">
              Active School Year: <strong className="text-dark">{data.schoolYear.name}</strong> • Status:{' '}
              <span
                className={`badge ${
                  assessment.status === 'Submitted'
                    ? 'bg-success'
                    : assessment.status === 'Draft'
                    ? 'bg-warning text-dark'
                    : 'bg-secondary'
                }`}
              >
                {assessment.status}
              </span>
              {isLocked && <span className="badge bg-secondary ms-1">Locked (Submitted)</span>}
            </div>
          </div>
        </div>

        {/* Progress & Live Rating */}
        <div className="d-flex align-items-center gap-3">
          <div className="text-end d-none d-sm-block">
            <div className="small text-muted">Running SBM Score</div>
            <div className="fs-5 fw-bold text-primary">{currentAverage} / 4.00</div>
          </div>

          {!isLocked && (
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                onClick={handleSaveDraft}
                disabled={savingDraft}
              >
                {savingDraft ? (
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                ) : (
                  <i className="bi bi-save"></i>
                )}
                Save Draft
              </button>

              <button
                className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                onClick={() => setShowSubmitConfirm(true)}
              >
                <i className="bi bi-send-check"></i> Submit Assessment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alert message if any */}
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

      {/* Instructions & Progress Card */}
      <div className="card border-0 shadow-sm rounded-3 mb-4">
        <div className="card-body p-3">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-md-8">
              <div className="d-flex align-items-center gap-2 text-primary fw-semibold small mb-1">
                <i className="bi bi-info-circle-fill"></i> Regional Instructions
              </div>
              <div className="small text-muted">{form.instructions}</div>
              <div className="mt-2 d-flex flex-wrap gap-2 small">
                {form.requireAllIndicators && (
                  <span className="badge bg-warning-subtle text-warning border">
                    <i className="bi bi-check2-all me-1"></i> All indicators required
                  </span>
                )}
                {form.requireGlobalRemarks && (
                  <span className="badge bg-info-subtle text-info border">
                    <i className="bi bi-chat-left-text me-1"></i> Global remarks required
                  </span>
                )}
                {form.requireIndicatorRemarks && (
                  <span className="badge bg-primary-subtle text-primary border">
                    <i className="bi bi-chat-dots me-1"></i> Remarks required per indicator
                  </span>
                )}
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>Completion Progress</span>
                <span className="fw-bold text-dark">
                  {answeredCount} of {totalActiveIndicators} Rated ({progressPercent}%)
                </span>
              </div>
              <div className="progress" style={{ height: '10px' }}>
                <div
                  className="progress-bar bg-success progress-bar-striped progress-bar-animated"
                  role="progressbar"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Scale Legend bar */}
      <div className="card border-0 shadow-sm rounded-3 mb-4 bg-light">
        <div className="card-body py-2 px-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 small">
            <span className="fw-bold text-secondary">
              <i className="bi bi-bar-chart-steps me-1"></i> Rating Scale:
            </span>
            <span className="badge bg-danger p-2">{form.ratingLabel1} (1)</span>
            <span className="badge bg-warning text-dark p-2">{form.ratingLabel2} (2)</span>
            <span className="badge bg-info text-dark p-2">{form.ratingLabel3} (3)</span>
            <span className="badge bg-success p-2">{form.ratingLabel4} (4)</span>
          </div>
        </div>
      </div>

      {/* Section / Dimension Navigation Tabs */}
      <div className="mb-3 border-bottom d-flex flex-wrap gap-1">
        {form.sections?.map((sec: any) => {
          const secInds = sec.indicators || [];
          const secAnswered = secInds.filter((i: any) => (responses.get(i.id)?.rating || 0) > 0).length;
          const isComplete = secInds.length > 0 && secAnswered === secInds.length;

          return (
            <button
              key={sec.id}
              className={`btn btn-sm rounded-top px-3 py-2 ${
                activeSectionId === sec.id
                  ? 'btn-primary active fw-bold'
                  : 'btn-light border-bottom-0 text-dark'
              }`}
              onClick={() => setActiveSectionId(sec.id)}
            >
              <span>{sec.title}</span>
              <span className={`badge ms-2 ${isComplete ? 'bg-success' : 'bg-secondary'}`}>
                {secAnswered}/{secInds.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Section Indicators */}
      {currentSection && (
        <div className="card border-0 shadow-sm rounded-3 mb-4">
          <div className="card-header bg-white py-3">
            <h5 className="fw-bold mb-0 text-dark">{currentSection.title}</h5>
            <div className="text-muted small">
              Rate each indicator honestly and objectively according to school documents and evidence.
            </div>
          </div>
          <div className="card-body p-0">
            <div className="list-group list-group-flush">
              {currentSection.indicators?.map((ind: any, idx: number) => {
                const resp = responses.get(ind.id) || { rating: 0, remarks: '' };
                const currentRating = resp.rating;

                return (
                  <div key={ind.id} className={`list-group-item p-4 ${idx % 2 === 1 ? 'bg-light-subtle' : ''}`}>
                    <div className="row g-3">
                      {/* Indicator content */}
                      <div className="col-12 col-lg-7">
                        <div className="d-flex align-items-start gap-2">
                          <span className="badge bg-primary text-uppercase px-2 py-1 mt-1">
                            {ind.code}
                          </span>
                          <div>
                            <div className="fw-semibold text-dark fs-6">{ind.content}</div>
                            {form.requireIndicatorRemarks && (
                              <div className="text-danger small mt-1">
                                <i className="bi bi-asterisk"></i> Remarks / MOVs are required for this indicator
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 4 Rating Buttons */}
                      <div className="col-12 col-lg-5">
                        <div className="d-flex flex-column align-items-lg-end">
                          <div className="btn-group w-100" role="group" aria-label="Rating options">
                            {[1, 2, 3, 4].map((rVal) => {
                              const isSelected = currentRating === rVal;
                              let btnClass = 'btn-outline-secondary';
                              if (isSelected) {
                                if (rVal === 1) btnClass = 'btn-danger active text-white fw-bold';
                                else if (rVal === 2) btnClass = 'btn-warning active text-dark fw-bold';
                                else if (rVal === 3) btnClass = 'btn-info active text-dark fw-bold';
                                else if (rVal === 4) btnClass = 'btn-success active text-white fw-bold';
                              }

                              const label =
                                rVal === 1
                                  ? form.ratingLabel1
                                  : rVal === 2
                                  ? form.ratingLabel2
                                  : rVal === 3
                                  ? form.ratingLabel3
                                  : form.ratingLabel4;

                              return (
                                <button
                                  key={rVal}
                                  type="button"
                                  className={`btn ${btnClass} py-2 d-flex flex-column align-items-center justify-content-center`}
                                  onClick={() => handleRatingChange(ind.id, rVal)}
                                  disabled={isLocked}
                                  title={label}
                                >
                                  <span className="fs-6 fw-bold">{rVal}</span>
                                  <span className="small text-truncate" style={{ fontSize: '0.68rem', maxWidth: '70px' }}>
                                    Lvl {rVal}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {currentRating > 0 && (
                            <div className="small text-muted mt-1">
                              Selected:{' '}
                              <strong className="text-primary">
                                {currentRating === 1
                                  ? form.ratingLabel1
                                  : currentRating === 2
                                  ? form.ratingLabel2
                                  : currentRating === 3
                                  ? form.ratingLabel3
                                  : form.ratingLabel4}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Remarks Field */}
                      <div className="col-12">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text bg-light text-muted">
                            <i className="bi bi-chat-text me-1"></i> MOVs / Remarks
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Specify Means of Verification (e.g., AIP, SIP, Brigada Eskwela Report, Minutes of Meeting)..."
                            value={resp.remarks}
                            onChange={(e) => handleRemarksChange(ind.id, e.target.value)}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global Remarks Card */}
      <div className="card border-0 shadow-sm rounded-3 mb-4">
        <div className="card-header bg-white py-3">
          <h6 className="fw-bold mb-0 text-dark">
            <i className="bi bi-card-text text-primary me-2"></i>
            Global Assessment Remarks / Best Practices / Areas for Improvement
          </h6>
        </div>
        <div className="card-body p-3">
          {form.requireGlobalRemarks && (
            <div className="text-danger small mb-2">
              <i className="bi bi-asterisk"></i> Global remarks are required by Regional Office prior to submission.
            </div>
          )}
          <textarea
            className="form-control"
            rows={4}
            placeholder="Summarize key institutional strengths, innovations, priority improvement areas, and technical assistance needs..."
            value={globalRemarks}
            onChange={(e) => setGlobalRemarks(e.target.value)}
            disabled={isLocked}
          ></textarea>
        </div>
      </div>

      {/* Bottom Action Bar */}
      {!isLocked && (
        <div className="d-flex flex-wrap justify-content-between align-items-center p-3 bg-white rounded shadow-sm">
          <div className="small text-muted">
            Rated <strong>{answeredCount}</strong> of <strong>{totalActiveIndicators}</strong> indicators
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-primary"
              onClick={handleSaveDraft}
              disabled={savingDraft}
            >
              {savingDraft ? 'Saving...' : 'Save Draft Progress'}
            </button>
            <button
              className="btn btn-success px-4 fw-semibold"
              onClick={() => setShowSubmitConfirm(true)}
            >
              Submit Final Assessment
            </button>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-shield-check me-2"></i> Confirm Assessment Submission
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowSubmitConfirm(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="fw-semibold mb-2">
                  Are you ready to submit your School-Based Management self-assessment for {data.schoolYear.name}?
                </p>
                <div className="alert alert-light border small text-muted mb-3">
                  <div>
                    Answered Indicators: <strong>{answeredCount}</strong> of <strong>{totalActiveIndicators}</strong>
                  </div>
                  <div>
                    Overall Calculated Score: <strong>{currentAverage}</strong>
                  </div>
                  {!form.allowEditAfterSubmission && (
                    <div className="text-danger mt-1">
                      <i className="bi bi-lock-fill"></i> Once submitted, responses are locked and cannot be modified without Regional Administrator approval.
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Submitted By (Officer Name):</label>
                  <input
                    type="text"
                    className="form-control"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSubmitConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSubmitAssessment}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
