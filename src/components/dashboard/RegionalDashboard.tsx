import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface RegionalDashboardProps {
  onNavigate: (view: string, filterParams?: any) => void;
}

export const RegionalDashboard: React.FC<RegionalDashboardProps> = ({ onNavigate }) => {
  const { apiFetch, activeSchoolYear } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [activeSchoolYear]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, sumRes] = await Promise.all([
        apiFetch('/api/monitoring/dashboard-stats'),
        apiFetch(`/api/monitoring/division-summary${activeSchoolYear ? `?schoolYearId=${activeSchoolYear.id}` : ''}`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (sumRes.ok) setSummaryData(await sumRes.json());
    } catch (err) {
      console.error('Failed to load regional dashboard stats:', err);
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
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading Regional Dashboard...</span>
        </div>
        <div className="text-muted small mt-2">Loading Regional SBM Analytics...</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Title & Active School Year Banner */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <div className="badge bg-danger text-uppercase px-2 py-1 mb-1">
            Regional Office Administration
          </div>
          <h1 className="h3 fw-bold text-dark mb-0">Regional SBM Executive Dashboard</h1>
          <div className="text-muted small">
            Consolidated Quality Assurance & School-Based Management Monitoring for Eastern Visayas (Region VIII)
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <button
            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
            onClick={loadDashboardData}
          >
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>
          <a
            href="/api/export/excel"
            className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
          >
            <i className="bi bi-file-earmark-excel"></i> Export Regional Excel
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        {/* Divisions in Scope */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 border-0 shadow-sm rounded-3">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-semibold">Divisions in Scope</span>
                <div className="bg-primary bg-opacity-10 text-primary rounded p-2">
                  <i className="bi bi-diagram-3-fill fs-5"></i>
                </div>
              </div>
              <h2 className="display-6 fw-bold mb-0 text-dark">{stats?.divisionsInScope || 13}</h2>
              <div className="text-muted small mt-1">13 Schools Divisions</div>
            </div>
          </div>
        </div>

        {/* Schools in Scope */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 border-0 shadow-sm rounded-3">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-semibold">Schools in Scope</span>
                <div className="bg-info bg-opacity-10 text-info rounded p-2">
                  <i className="bi bi-buildings-fill fs-5"></i>
                </div>
              </div>
              <h2 className="display-6 fw-bold mb-0 text-dark">{stats?.schoolsInScope || 0}</h2>
              <div className="text-muted small mt-1">Active Schools in RO8</div>
            </div>
          </div>
        </div>

        {/* Submitted */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 border-0 shadow-sm rounded-3 border-start border-success border-4">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-semibold">Submitted</span>
                <div className="bg-success bg-opacity-10 text-success rounded p-2">
                  <i className="bi bi-check-circle-fill fs-5"></i>
                </div>
              </div>
              <h2 className="display-6 fw-bold mb-0 text-success">{stats?.submittedCount || 0}</h2>
              <div className="text-success small mt-1 fw-semibold">
                {stats?.completionPercentage || 0}% Completion Rate
              </div>
            </div>
          </div>
        </div>

        {/* Draft Assessments */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 border-0 shadow-sm rounded-3">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-semibold">Draft Assessments</span>
                <div className="bg-warning bg-opacity-10 text-warning rounded p-2">
                  <i className="bi bi-pencil-square fs-5"></i>
                </div>
              </div>
              <h2 className="display-6 fw-bold mb-0 text-warning">{stats?.draftCount || 0}</h2>
              <div className="text-muted small mt-1">Self-assessments in progress</div>
            </div>
          </div>
        </div>

        {/* Not Started */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 border-0 shadow-sm rounded-3">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-semibold">Not Started</span>
                <div className="bg-secondary bg-opacity-10 text-secondary rounded p-2">
                  <i className="bi bi-hourglass-split fs-5"></i>
                </div>
              </div>
              <h2 className="display-6 fw-bold mb-0 text-secondary">{stats?.notStartedCount || 0}</h2>
              <div className="text-muted small mt-1">Pending school initiation</div>
            </div>
          </div>
        </div>

        {/* Regional Average Rating */}
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card h-100 border-0 shadow-sm rounded-3 bg-primary text-white">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-white-75 small fw-semibold">Regional Mean</span>
                <div className="bg-white bg-opacity-20 text-white rounded p-2">
                  <i className="bi bi-star-fill fs-5"></i>
                </div>
              </div>
              <h2 className="display-6 fw-bold mb-1 text-white">{stats?.averageRating || '0.00'}</h2>
              <div>{getLevelBadge(stats?.averageRating || '0.00')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-3">
          <button
            className="btn btn-outline-dark w-100 p-3 text-start shadow-sm bg-white rounded-3 d-flex align-items-center justify-content-between hover-lift"
            onClick={() => onNavigate('form-builder')}
          >
            <div>
              <div className="fw-bold text-dark">
                <i className="bi bi-sliders text-primary me-2"></i> Assessment Form Builder
              </div>
              <div className="text-muted small">Configure dimensions, labels & rules</div>
            </div>
            <i className="bi bi-chevron-right text-muted"></i>
          </button>
        </div>

        <div className="col-12 col-md-3">
          <button
            className="btn btn-outline-dark w-100 p-3 text-start shadow-sm bg-white rounded-3 d-flex align-items-center justify-content-between hover-lift"
            onClick={() => onNavigate('school-years')}
          >
            <div>
              <div className="fw-bold text-dark">
                <i className="bi bi-calendar-range text-success me-2"></i> School Year Lifecycle
              </div>
              <div className="text-muted small">Activate, close & clone school years</div>
            </div>
            <i className="bi bi-chevron-right text-muted"></i>
          </button>
        </div>

        <div className="col-12 col-md-3">
          <button
            className="btn btn-outline-dark w-100 p-3 text-start shadow-sm bg-white rounded-3 d-flex align-items-center justify-content-between hover-lift"
            onClick={() => onNavigate('monitoring')}
          >
            <div>
              <div className="fw-bold text-dark">
                <i className="bi bi-table text-info me-2"></i> Monitoring & Schools
              </div>
              <div className="text-muted small">Filter, search & inspect school records</div>
            </div>
            <i className="bi bi-chevron-right text-muted"></i>
          </button>
        </div>

        <div className="col-12 col-md-3">
          <button
            className="btn btn-outline-dark w-100 p-3 text-start shadow-sm bg-white rounded-3 d-flex align-items-center justify-content-between hover-lift"
            onClick={() => onNavigate('customization')}
          >
            <div>
              <div className="fw-bold text-dark">
                <i className="bi bi-palette text-danger me-2"></i> Regional Customization
              </div>
              <div className="text-muted small">Branding, login & footer options</div>
            </div>
            <i className="bi bi-chevron-right text-muted"></i>
          </button>
        </div>
      </div>

      {/* Division Summary Breakdown Table */}
      <div className="card border-0 shadow-sm rounded-3 mb-4">
        <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center">
          <div>
            <h5 className="fw-bold mb-0 text-dark">Division-by-Division SBM Progress Summary</h5>
            <div className="text-muted small">
              Tracking all 13 Schools Division Offices (SDOs) in DepEd Region VIII
            </div>
          </div>
          <span className="badge bg-light text-dark border">
            Active SY: {activeSchoolYear?.name || 'All'}
          </span>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-secondary small">
              <tr>
                <th>Schools Division</th>
                <th className="text-center">Total Schools</th>
                <th className="text-center">Not Started</th>
                <th className="text-center">Draft</th>
                <th className="text-center">Submitted</th>
                <th className="text-center" style={{ width: '180px' }}>Completion</th>
                <th className="text-center">Average Rating</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summaryData?.divisions?.map((div: any) => (
                <tr key={div.id}>
                  <td>
                    <div className="fw-semibold text-dark">{div.divisionName}</div>
                    <div className="text-muted small">{div.divisionCode}</div>
                  </td>
                  <td className="text-center fw-bold">{div.totalSchools}</td>
                  <td className="text-center">
                    <span className="badge bg-secondary-subtle text-secondary px-2">
                      {div.notStarted}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="badge bg-warning-subtle text-warning px-2">
                      {div.draft}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="badge bg-success-subtle text-success px-2">
                      {div.submitted}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="progress flex-grow-1" style={{ height: '8px' }}>
                        <div
                          className="progress-bar bg-success"
                          role="progressbar"
                          style={{ width: `${div.completionPercentage}%` }}
                          aria-valuenow={div.completionPercentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        ></div>
                      </div>
                      <span className="small fw-semibold" style={{ width: '40px' }}>
                        {div.completionPercentage}%
                      </span>
                    </div>
                  </td>
                  <td className="text-center">
                    <span className="fw-bold">{div.averageRating}</span>{' '}
                    {getLevelBadge(div.averageRating)}
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => onNavigate('monitoring', { divisionId: div.id })}
                    >
                      <i className="bi bi-eye me-1"></i> View Schools
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {summaryData?.regionalTotals && (
              <tfoot className="table-secondary fw-bold">
                <tr>
                  <td>REGIONAL TOTALS (RO VIII)</td>
                  <td className="text-center">{summaryData.regionalTotals.totalSchools}</td>
                  <td className="text-center">{summaryData.regionalTotals.notStarted}</td>
                  <td className="text-center">{summaryData.regionalTotals.draft}</td>
                  <td className="text-center">{summaryData.regionalTotals.submitted}</td>
                  <td className="text-center">{summaryData.regionalTotals.completionPercentage}%</td>
                  <td className="text-center">
                    {summaryData.regionalTotals.averageRating}{' '}
                    {getLevelBadge(summaryData.regionalTotals.averageRating)}
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onNavigate('monitoring')}
                    >
                      All Records
                    </button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
