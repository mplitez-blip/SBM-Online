import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SchoolDashboardProps {
  onNavigate: (view: string) => void;
}

export const SchoolDashboard: React.FC<SchoolDashboardProps> = ({ onNavigate }) => {
  const { user, apiFetch, activeSchoolYear } = useAuth();
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveAssessment();
  }, [activeSchoolYear]);

  const loadActiveAssessment = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/assessments/active');
      if (res.ok) {
        const data = await res.json();
        setAssessmentData(data);
      }
    } catch (err) {
      console.error('Failed to load active assessment for school:', err);
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
        <div className="spinner-border text-success" role="status"></div>
        <div className="text-muted small mt-2">Loading School SBM Portal...</div>
      </div>
    );
  }

  const assessment = assessmentData?.assessment;
  const form = assessmentData?.form;
  const isSubmitted = assessment?.status === 'Submitted';
  const isDraft = assessment?.status === 'Draft';

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* School Header Banner */}
      <div className="card border-0 shadow-sm rounded-3 mb-4 bg-primary text-white overflow-hidden">
        <div className="card-body p-4 position-relative">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="badge bg-warning text-dark fw-bold px-2 py-1">
                  DepEd ID: {user?.schoolDepedId}
                </span>
                <span className="badge bg-white bg-opacity-25 text-white px-2 py-1">
                  {user?.schoolClassification || 'Elementary'}
                </span>
              </div>
              <h1 className="h2 fw-bold mb-1 text-white">{user?.schoolName}</h1>
              <div className="text-white-75">
                <i className="bi bi-geo-alt me-1"></i> {user?.schoolDistrict} • Division of {user?.divisionName}
              </div>
              <div className="text-white-50 small mt-2">
                <i className="bi bi-person-badge me-1"></i> School Head: <strong className="text-white">{user?.schoolHead || 'Unassigned'}</strong>
              </div>
            </div>

            <div className="bg-white bg-opacity-10 rounded-3 p-3 text-center" style={{ minWidth: '180px' }}>
              <div className="text-white-75 small mb-1">Active SBM Assessment</div>
              <div className="fs-5 fw-bold text-warning">
                SY {activeSchoolYear ? activeSchoolYear.name : 'None'}
              </div>
              <div className="mt-2">
                <span
                  className={`badge px-3 py-1 fs-6 ${
                    isSubmitted ? 'bg-success' : isDraft ? 'bg-warning text-dark' : 'bg-secondary'
                  }`}
                >
                  {assessment?.status || 'Not started'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assessment Action Section */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-8">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <div>
                <h5 className="fw-bold mb-0 text-dark">
                  <i className="bi bi-journal-check text-primary me-2"></i>
                  {form ? form.title : 'School-Based Management Self-Assessment'}
                </h5>
                <div className="text-muted small">
                  School Year: {activeSchoolYear?.name}
                </div>
              </div>
              {getLevelBadge(assessment?.calculatedAverage || '0.00')}
            </div>
            <div className="card-body p-4">
              {form ? (
                <>
                  <div className="alert alert-info py-2 small mb-3">
                    <i className="bi bi-info-circle me-1"></i>
                    {form.instructions}
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-6 col-sm-3">
                      <div className="p-2 border rounded bg-light text-center">
                        <div className="text-muted small">Status</div>
                        <div className="fw-bold text-dark">{assessment?.status || 'Not started'}</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="p-2 border rounded bg-light text-center">
                        <div className="text-muted small">Current Average</div>
                        <div className="fw-bold text-primary fs-5">
                          {assessment?.calculatedAverage || '0.00'}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="p-2 border rounded bg-light text-center">
                        <div className="text-muted small">Active Dimensions</div>
                        <div className="fw-bold text-dark">{form.sections?.length || 0} Dimensions</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="p-2 border rounded bg-light text-center">
                        <div className="text-muted small">Total Indicators</div>
                        <div className="fw-bold text-dark">
                          {form.sections?.reduce((acc: number, s: any) => acc + (s.indicators?.length || 0), 0) || 0} Indicators
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-3">
                    <button
                      className="btn btn-primary px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
                      onClick={() => onNavigate('assessment')}
                    >
                      <i className="bi bi-pencil-square"></i>
                      <span>Fill in Self-Assessment</span>
                      {isSubmitted && <span className="badge bg-success-subtle text-white ms-1">Submitted</span>}
                      {isDraft && <span className="badge bg-warning text-dark ms-1">Draft</span>}
                    </button>
                    <button
                      className="btn btn-outline-primary px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
                      onClick={() => onNavigate('history')}
                    >
                      <i className="bi bi-file-earmark-bar-graph"></i>
                      <span>View Your Data</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-exclamation-circle fs-2 text-warning"></i>
                  <p className="mt-2 mb-0">
                    No published assessment form is currently available for this School Year. Please contact the Regional Office.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rating Scale Legend */}
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-header bg-white py-3 border-bottom">
              <h6 className="fw-bold mb-0 text-dark">
                <i className="bi bi-bar-chart-steps text-success me-2"></i>
                Official SBM Rating Scale
              </h6>
            </div>
            <div className="card-body p-3">
              <ul className="list-group list-group-flush small">
                <li className="list-group-item d-flex justify-content-between align-items-center px-0">
                  <div>
                    <span className="badge bg-danger me-2">1</span>
                    <strong>Level 1: Developing</strong>
                    <div className="text-muted" style={{ fontSize: '0.74rem' }}>Score Range: 1.00 – 1.49</div>
                  </div>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center px-0">
                  <div>
                    <span className="badge bg-warning text-dark me-2">2</span>
                    <strong>Level 2: Maturing</strong>
                    <div className="text-muted" style={{ fontSize: '0.74rem' }}>Score Range: 1.50 – 2.49</div>
                  </div>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center px-0">
                  <div>
                    <span className="badge bg-info text-dark me-2">3</span>
                    <strong>Level 3: Advanced</strong>
                    <div className="text-muted" style={{ fontSize: '0.74rem' }}>Score Range: 2.50 – 3.49</div>
                  </div>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center px-0">
                  <div>
                    <span className="badge bg-success me-2">4</span>
                    <strong>Level 4: Exemplary</strong>
                    <div className="text-muted" style={{ fontSize: '0.74rem' }}>Score Range: 3.50 – 4.00</div>
                  </div>
                </li>
              </ul>
              <div className="alert alert-light border mt-3 mb-0 small text-muted">
                Ratings must be substantiated by authentic Means of Verification (MOVs) maintained at the school level.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
