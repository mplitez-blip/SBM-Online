import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface DivisionDashboardProps {
  onNavigate: (view: string, filterParams?: any) => void;
}

export const DivisionDashboard: React.FC<DivisionDashboardProps> = ({ onNavigate }) => {
  const { user, apiFetch, activeSchoolYear } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDivisionStats();
  }, [activeSchoolYear]);

  const loadDivisionStats = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/monitoring/dashboard-stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      console.error('Failed to load division dashboard:', err);
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
        <div className="text-muted small mt-2">Loading Division Portal...</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Division Banner */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <div className="badge bg-primary text-uppercase px-2 py-1 mb-1">
            Schools Division Office (SDO)
          </div>
          <h1 className="h3 fw-bold text-dark mb-0">
            Division of {user?.divisionName || 'Assigned Division'}
          </h1>
          <div className="text-muted small">
            Official School-Based Management Monitoring, Validation, and Technical Assistance Portal
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <button
            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
            onClick={loadDivisionStats}
          >
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>
          <a
            href={`/api/export/excel?divisionId=${user?.divisionId}`}
            className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
          >
            <i className="bi bi-file-earmark-excel"></i> Export Division Excel
          </a>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="row g-3 mb-4">
        {/* Schools in Scope */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="card h-100 border-0 shadow-sm rounded-3">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-semibold">Assigned Schools</span>
                <div className="bg-primary bg-opacity-10 text-primary rounded p-2">
                  <i className="bi bi-buildings-fill fs-5"></i>
                </div>
              </div>
              <h2 className="display-6 fw-bold mb-0 text-dark">{stats?.schoolsInScope || 0}</h2>
              <div className="text-muted small mt-1">Under Division Jurisdiction</div>
            </div>
          </div>
        </div>

        {/* Submitted */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="card h-100 border-0 shadow-sm rounded-3 border-start border-success border-4">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-semibold">Submitted Assessments</span>
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

        {/* Drafts */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="card h-100 border-0 shadow-sm rounded-3">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-semibold">In Draft / Progress</span>
                <div className="bg-warning bg-opacity-10 text-warning rounded p-2">
                  <i className="bi bi-pencil-square fs-5"></i>
                </div>
              </div>
              <h2 className="display-6 fw-bold mb-0 text-warning">{stats?.draftCount || 0}</h2>
              <div className="text-muted small mt-1">Pending submission</div>
            </div>
          </div>
        </div>

        {/* Division Average SBM */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="card h-100 border-0 shadow-sm rounded-3 bg-primary text-white">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-white-75 small fw-semibold">Division SBM Mean</span>
                <div className="bg-white bg-opacity-20 text-white rounded p-2">
                  <i className="bi bi-award-fill fs-5"></i>
                </div>
              </div>
              <h2 className="display-6 fw-bold mb-1 text-white">{stats?.averageRating || '0.00'}</h2>
              <div>{getLevelBadge(stats?.averageRating || '0.00')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Division Action Cards */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="bg-info bg-opacity-10 text-info rounded p-3">
                  <i className="bi bi-table fs-3"></i>
                </div>
                <div>
                  <h5 className="fw-bold mb-0">School Monitoring & Validation Console</h5>
                  <div className="text-muted small">
                    Inspect individual school ratings, indicator answers, and remarks
                  </div>
                </div>
              </div>
              <p className="text-muted small">
                Monitor the submission status of all schools in {user?.divisionName}. Filter by district, classification, or search by School ID. View submitted self-assessments in detail to provide data-driven technical assistance.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate('monitoring')}
              >
                <i className="bi bi-arrow-right-circle me-1"></i> Open Monitoring Console
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm rounded-3 h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="bg-success bg-opacity-10 text-success rounded p-3">
                  <i className="bi bi-buildings fs-3"></i>
                </div>
                <div>
                  <h5 className="fw-bold mb-0">Division School Account Management</h5>
                  <div className="text-muted small">
                    Create schools, reset portal passwords & import schools from CSV
                  </div>
                </div>
              </div>
              <p className="text-muted small">
                Add single schools, update school heads and classifications, reset school portal passwords, or batch-import multiple schools from standard CSV rosters directly into the Division roster.
              </p>
              <button
                className="btn btn-outline-success"
                onClick={() => onNavigate('schools')}
              >
                <i className="bi bi-people-fill me-1"></i> Manage School Accounts
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
