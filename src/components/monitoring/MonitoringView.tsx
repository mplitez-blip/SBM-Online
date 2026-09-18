import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

interface MonitoringViewProps {
  initialDivisionId?: number;
  onInspectSchool: (schoolId: number) => void;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({ initialDivisionId, onInspectSchool }) => {
  const { user, apiFetch, activeSchoolYear } = useAuth();

  // Filter states
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classifications, setClassifications] = useState<any[]>([]);

  const [selectedSyId, setSelectedSyId] = useState<number | string>('');
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | string>(
    user?.role === 'division' ? user.divisionId! : initialDivisionId || ''
  );
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedClassification, setSelectedClassification] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<string>('schoolName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Table Data
  const [data, setData] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeIndicatorCount, setActiveIndicatorCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Active view tab (List vs Division Summary for Regional)
  const [activeTab, setActiveTab] = useState<'schools' | 'divisionSummary'>('schools');
  const [divisionSummary, setDivisionSummary] = useState<any>(null);

  // Load dropdown options
  useEffect(() => {
    loadDropdowns();
  }, []);

  const loadDropdowns = async () => {
    try {
      const [syRes, divRes, clsRes] = await Promise.all([
        apiFetch('/api/school-years'),
        apiFetch('/api/divisions'),
        apiFetch('/api/classifications'),
      ]);

      if (syRes.ok) {
        const syList = await syRes.json();
        setSchoolYears(syList);
        const active = syList.find((s: any) => s.isActive);
        if (active) setSelectedSyId(active.id);
        else if (syList.length > 0) setSelectedSyId(syList[0].id);
      }
      if (divRes.ok) setDivisions(await divRes.json());
      if (clsRes.ok) setClassifications(await clsRes.json());
    } catch (err) {
      console.error('Failed to load filter dropdowns:', err);
    }
  };

  // Load monitoring table data
  useEffect(() => {
    if (selectedSyId) {
      loadMonitoringData();
      if (user?.role === 'regional') {
        loadDivisionSummary();
      }
    }
  }, [
    selectedSyId,
    selectedDivisionId,
    selectedDistrict,
    selectedClassification,
    selectedStatus,
    sortBy,
    sortDir,
    currentPage,
    pageSize,
  ]);

  const loadMonitoringData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSyId) params.append('schoolYearId', String(selectedSyId));
      if (selectedDivisionId) params.append('divisionId', String(selectedDivisionId));
      if (selectedDistrict) params.append('district', selectedDistrict);
      if (selectedClassification) params.append('classification', selectedClassification);
      if (selectedStatus) params.append('status', selectedStatus);
      if (searchQuery) params.append('search', searchQuery);
      params.append('sortBy', sortBy);
      params.append('sortDir', sortDir);
      params.append('page', String(currentPage));
      params.append('pageSize', String(pageSize));

      const res = await apiFetch(`/api/monitoring?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotalRecords(json.total || 0);
        setTotalPages(json.totalPages || 1);
        setActiveIndicatorCount(json.activeIndicatorCount || 0);
      }
    } catch (err) {
      console.error('Monitoring load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDivisionSummary = async () => {
    try {
      const res = await apiFetch(`/api/monitoring/division-summary?schoolYearId=${selectedSyId}`);
      if (res.ok) {
        setDivisionSummary(await res.json());
      }
    } catch (err) {
      console.error('Division summary load error:', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadMonitoringData();
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return <i className="bi bi-arrow-down-up text-muted ms-1" style={{ fontSize: '0.75rem' }}></i>;
    return sortDir === 'asc' ? (
      <i className="bi bi-sort-up text-primary ms-1"></i>
    ) : (
      <i className="bi bi-sort-down text-primary ms-1"></i>
    );
  };

  const getLevelBadge = (avgStr: string) => {
    const avg = parseFloat(avgStr);
    if (avg <= 0) return <span className="badge bg-secondary">Not Assessed</span>;
    if (avg < 1.5) return <span className="badge bg-danger">Level 1: Developing</span>;
    if (avg < 2.5) return <span className="badge bg-warning text-dark">Level 2: Maturing</span>;
    if (avg < 3.5) return <span className="badge bg-info text-dark">Level 3: Advanced</span>;
    return <span className="badge bg-success">Level 4: Exemplary</span>;
  };

  // Export URL
  const exportExcelUrl = `/api/export/excel?schoolYearId=${selectedSyId}${
    selectedDivisionId ? `&divisionId=${selectedDivisionId}` : ''
  }`;

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h1 className="h4 fw-bold text-dark mb-0">School Monitoring & Assessment Console</h1>
          <div className="text-muted small">
            Real-time validation of school SBM ratings, completion indicators, and division status
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <button
            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
            onClick={loadMonitoringData}
          >
            <i className="bi bi-arrow-clockwise"></i> Refresh Data
          </button>
          <a
            href={exportExcelUrl}
            className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
          >
            <i className="bi bi-file-earmark-excel"></i> Export Consolidated Excel (4 Sheets)
          </a>
        </div>
      </div>

      {/* Tabs if Regional */}
      {user?.role === 'regional' && (
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold ${activeTab === 'schools' ? 'active text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('schools')}
            >
              <i className="bi bi-list-columns-reverse me-1"></i> Schools Monitoring Table
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold ${activeTab === 'divisionSummary' ? 'active text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('divisionSummary')}
            >
              <i className="bi bi-bar-chart-line me-1"></i> Division Performance Summary
            </button>
          </li>
        </ul>
      )}

      {/* Division Summary Tab */}
      {activeTab === 'divisionSummary' && user?.role === 'regional' ? (
        <div className="card border-0 shadow-sm rounded-3 mb-4">
          <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold mb-0 text-dark">Division SBM Status Summary</h5>
              <div className="text-muted small">
                Consolidated overview for all 13 Schools Divisions in Region VIII
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <label className="small fw-semibold text-secondary">School Year:</label>
              <select
                className="form-select form-select-sm"
                value={selectedSyId}
                onChange={(e) => setSelectedSyId(e.target.value)}
              >
                {schoolYears.map((sy) => (
                  <option key={sy.id} value={sy.id}>
                    SY {sy.name} {sy.isActive ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small text-secondary">
                <tr>
                  <th>Schools Division</th>
                  <th className="text-center">Total Schools</th>
                  <th className="text-center">Not Started</th>
                  <th className="text-center">Draft</th>
                  <th className="text-center">Submitted</th>
                  <th className="text-center" style={{ width: '180px' }}>Completion</th>
                  <th className="text-center">Average Rating</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {divisionSummary?.divisions?.map((div: any) => (
                  <tr key={div.id}>
                    <td>
                      <div className="fw-semibold text-dark">{div.divisionName}</div>
                      <div className="text-muted small">{div.divisionCode}</div>
                    </td>
                    <td className="text-center fw-bold">{div.totalSchools}</td>
                    <td className="text-center">
                      <span className="badge bg-secondary-subtle text-secondary px-2">{div.notStarted}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-warning-subtle text-warning px-2">{div.draft}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-success-subtle text-success px-2">{div.submitted}</span>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="progress flex-grow-1" style={{ height: '8px' }}>
                          <div
                            className="progress-bar bg-success"
                            role="progressbar"
                            style={{ width: `${div.completionPercentage}%` }}
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
                        onClick={() => {
                          setSelectedDivisionId(div.id);
                          setActiveTab('schools');
                        }}
                      >
                        Filter Schools
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {divisionSummary?.regionalTotals && (
                <tfoot className="table-secondary fw-bold">
                  <tr>
                    <td>REGIONAL TOTALS (RO VIII)</td>
                    <td className="text-center">{divisionSummary.regionalTotals.totalSchools}</td>
                    <td className="text-center">{divisionSummary.regionalTotals.notStarted}</td>
                    <td className="text-center">{divisionSummary.regionalTotals.draft}</td>
                    <td className="text-center">{divisionSummary.regionalTotals.submitted}</td>
                    <td className="text-center">{divisionSummary.regionalTotals.completionPercentage}%</td>
                    <td className="text-center">
                      {divisionSummary.regionalTotals.averageRating}{' '}
                      {getLevelBadge(divisionSummary.regionalTotals.averageRating)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* Schools Monitoring Tab */
        <>
          {/* Filters Bar */}
          <div className="card border-0 shadow-sm rounded-3 mb-4">
            <div className="card-body p-3">
              <div className="row g-2 align-items-end">
                {/* School Year Filter */}
                <div className="col-12 col-sm-6 col-md-2">
                  <label className="form-label small fw-semibold text-secondary">School Year</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedSyId}
                    onChange={(e) => {
                      setSelectedSyId(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    {schoolYears.map((sy) => (
                      <option key={sy.id} value={sy.id}>
                        SY {sy.name} {sy.isActive ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Division Filter (Regional Only) */}
                {user?.role === 'regional' && (
                  <div className="col-12 col-sm-6 col-md-2">
                    <label className="form-label small fw-semibold text-secondary">Division</label>
                    <select
                      className="form-select form-select-sm"
                      value={selectedDivisionId}
                      onChange={(e) => {
                        setSelectedDivisionId(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">All 13 Divisions</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.divisionName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* District Filter */}
                <div className="col-12 col-sm-6 col-md-2">
                  <label className="form-label small fw-semibold text-secondary">District</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Filter district..."
                    value={selectedDistrict}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                {/* Classification Filter */}
                <div className="col-12 col-sm-6 col-md-2">
                  <label className="form-label small fw-semibold text-secondary">Classification</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedClassification}
                    onChange={(e) => {
                      setSelectedClassification(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">All Classifications</option>
                    {classifications.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="col-12 col-sm-6 col-md-2">
                  <label className="form-label small fw-semibold text-secondary">Status</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">All Statuses</option>
                    <option value="Not started">Not started</option>
                    <option value="Draft">Draft</option>
                    <option value="Submitted">Submitted</option>
                  </select>
                </div>

                {/* Search box */}
                <div className="col-12 col-md-2">
                  <form onSubmit={handleSearchSubmit}>
                    <label className="form-label small fw-semibold text-secondary">Search ID / Name</label>
                    <div className="input-group input-group-sm">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <button type="submit" className="btn btn-primary">
                        <i className="bi bi-search"></i>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Active Filter Clear Tags */}
              {(selectedDivisionId || selectedDistrict || selectedClassification || selectedStatus || searchQuery) && (
                <div className="mt-2 pt-2 border-top d-flex flex-wrap align-items-center gap-2 small">
                  <span className="text-muted">Active Filters:</span>
                  {selectedDivisionId && user?.role === 'regional' && (
                    <span className="badge bg-light text-dark border">
                      Division ID: {selectedDivisionId}
                      <i
                        className="bi bi-x ms-1 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedDivisionId('')}
                      ></i>
                    </span>
                  )}
                  {selectedDistrict && (
                    <span className="badge bg-light text-dark border">
                      District: {selectedDistrict}
                      <i
                        className="bi bi-x ms-1 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedDistrict('')}
                      ></i>
                    </span>
                  )}
                  {selectedClassification && (
                    <span className="badge bg-light text-dark border">
                      Class: {selectedClassification}
                      <i
                        className="bi bi-x ms-1 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedClassification('')}
                      ></i>
                    </span>
                  )}
                  {selectedStatus && (
                    <span className="badge bg-light text-dark border">
                      Status: {selectedStatus}
                      <i
                        className="bi bi-x ms-1 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedStatus('')}
                      ></i>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="badge bg-light text-dark border">
                      Query: {searchQuery}
                      <i
                        className="bi bi-x ms-1 cursor-pointer"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSearchQuery('')}
                      ></i>
                    </span>
                  )}
                  <button
                    className="btn btn-link btn-sm p-0 text-danger text-decoration-none"
                    onClick={() => {
                      if (user?.role === 'regional') setSelectedDivisionId('');
                      setSelectedDistrict('');
                      setSelectedClassification('');
                      setSelectedStatus('');
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Monitoring Table */}
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center">
              <div>
                <span className="fw-bold text-dark">
                  Showing {data.length} of {totalRecords} schools
                </span>
                <span className="text-muted small ms-2">
                  (Total Active Indicators in Form: {activeIndicatorCount})
                </span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <label className="small text-muted">Per Page:</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: '75px' }}
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-secondary">
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('schoolId')}>
                      School ID {getSortIcon('schoolId')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('schoolName')}>
                      School Name {getSortIcon('schoolName')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('divisionName')}>
                      Division {getSortIcon('divisionName')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('district')}>
                      District {getSortIcon('district')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('classification')}>
                      Classification {getSortIcon('classification')}
                    </th>
                    <th className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('status')}>
                      Status {getSortIcon('status')}
                    </th>
                    <th className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('answeredCount')}>
                      Answered Indicators {getSortIcon('answeredCount')}
                    </th>
                    <th className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('averageRating')}>
                      Avg Rating {getSortIcon('averageRating')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('lastUpdated')}>
                      Last Updated {getSortIcon('lastUpdated')}
                    </th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-5">
                        <div className="spinner-border text-primary" role="status"></div>
                        <div className="text-muted small mt-2">Loading schools data...</div>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-5 text-muted">
                        <i className="bi bi-inbox fs-2 d-block text-secondary mb-2"></i>
                        No schools found matching your search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    data.map((item) => {
                      const isComplete =
                        item.totalIndicators > 0 && item.answeredCount === item.totalIndicators;

                      return (
                        <tr key={item.schoolDbId}>
                          <td className="fw-bold text-primary">{item.schoolId}</td>
                          <td>
                            <div className="fw-semibold text-dark">{item.schoolName}</div>
                            <div className="text-muted small">Head: {item.schoolHead}</div>
                          </td>
                          <td className="small text-secondary">{item.divisionName}</td>
                          <td className="small text-secondary">{item.district}</td>
                          <td className="small">
                            <span className="badge bg-light text-dark border">
                              {item.classification}
                            </span>
                          </td>
                          <td className="text-center">
                            <span
                              className={`badge px-2 py-1 ${
                                item.status === 'Submitted'
                                  ? 'bg-success'
                                  : item.status === 'Draft'
                                  ? 'bg-warning text-dark'
                                  : 'bg-secondary'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className={`fw-semibold ${isComplete ? 'text-success' : 'text-dark'}`}>
                              {item.answeredCount} / {item.totalIndicators}
                            </span>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                              {item.totalIndicators > 0
                                ? `${Math.round((item.answeredCount / item.totalIndicators) * 100)}%`
                                : '0%'}
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="fw-bold">{item.averageRating}</div>
                            <div>{getLevelBadge(item.averageRating)}</div>
                          </td>
                          <td className="small text-muted">
                            {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : '—'}
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => onInspectSchool(item.schoolDbId)}
                              title="Inspect School SBM Details"
                            >
                              <i className="bi bi-eye me-1"></i> Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="card-footer bg-white py-3 d-flex flex-wrap justify-content-between align-items-center">
                <div className="small text-muted">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (Total {totalRecords} records)
                </div>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </button>
                  </li>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => setCurrentPage(pageNum)}>
                          {pageNum}
                        </button>
                      </li>
                    );
                  })}
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                      Next
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
