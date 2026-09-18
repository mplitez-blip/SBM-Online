import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ExportConsolidatedModal } from '../common/ExportConsolidatedModal.tsx';

interface MonitoringViewProps {
  initialDivisionId?: number;
  onInspectSchool: (schoolId: number) => void;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({ initialDivisionId, onInspectSchool }) => {
  const { user, apiFetch, activeSchoolYear } = useAuth();
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Read URL query params on mount for state preservation
  const urlParams = new URLSearchParams(window.location.search);
  const paramSy = urlParams.get('schoolYearId') || urlParams.get('sy') || '';
  const paramDiv =
    user?.role === 'division'
      ? String(user.divisionId)
      : urlParams.get('divisionId') || (initialDivisionId ? String(initialDivisionId) : '');
  const paramDist = urlParams.get('district') || '';
  const paramCls = urlParams.get('classification') || '';
  const paramStat = urlParams.get('status') || '';
  const paramSearch = urlParams.get('search') || '';
  const paramSortBy = urlParams.get('sortBy') || 'schoolName';
  const paramSortDir = (urlParams.get('sortDir') as 'asc' | 'desc') || 'asc';
  const paramPage = parseInt(urlParams.get('page') || '1', 10) || 1;
  const paramPageSize = parseInt(urlParams.get('pageSize') || '15', 10) || 15;

  // Filter states
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [classifications, setClassifications] = useState<any[]>([]);

  const [selectedSyId, setSelectedSyId] = useState<number | string>(paramSy);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | string>(paramDiv);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(paramDist);
  const [selectedClassification, setSelectedClassification] = useState<string>(paramCls);
  const [selectedStatus, setSelectedStatus] = useState<string>(paramStat);
  const [searchQuery, setSearchQuery] = useState<string>(paramSearch);
  const [searchInput, setSearchInput] = useState<string>(paramSearch);

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<string>(paramSortBy);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(paramSortDir);
  const [currentPage, setCurrentPage] = useState<number>(paramPage);
  const [pageSize, setPageSize] = useState<number>(paramPageSize);

  // Table Data & States
  const [data, setData] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeIndicatorCount, setActiveIndicatorCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab (List vs Division Summary for Regional)
  const [activeTab, setActiveTab] = useState<'schools' | 'divisionSummary'>('schools');
  const [divisionSummary, setDivisionSummary] = useState<any>(null);

  // Sync state changes to URL query parameters
  useEffect(() => {
    const url = new URL(window.location.href);

    if (selectedSyId) url.searchParams.set('schoolYearId', String(selectedSyId));
    else url.searchParams.delete('schoolYearId');

    if (user?.role === 'regional' && selectedDivisionId) {
      url.searchParams.set('divisionId', String(selectedDivisionId));
    } else {
      url.searchParams.delete('divisionId');
    }

    if (selectedDistrict) url.searchParams.set('district', selectedDistrict);
    else url.searchParams.delete('district');

    if (selectedClassification) url.searchParams.set('classification', selectedClassification);
    else url.searchParams.delete('classification');

    if (selectedStatus) url.searchParams.set('status', selectedStatus);
    else url.searchParams.delete('status');

    if (searchQuery) url.searchParams.set('search', searchQuery);
    else url.searchParams.delete('search');

    if (sortBy && sortBy !== 'schoolName') url.searchParams.set('sortBy', sortBy);
    else url.searchParams.delete('sortBy');

    if (sortDir && sortDir !== 'asc') url.searchParams.set('sortDir', sortDir);
    else url.searchParams.delete('sortDir');

    if (currentPage > 1) url.searchParams.set('page', String(currentPage));
    else url.searchParams.delete('page');

    if (pageSize !== 15) url.searchParams.set('pageSize', String(pageSize));
    else url.searchParams.delete('pageSize');

    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, [
    selectedSyId,
    selectedDivisionId,
    selectedDistrict,
    selectedClassification,
    selectedStatus,
    searchQuery,
    sortBy,
    sortDir,
    currentPage,
    pageSize,
    user?.role,
  ]);

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
        if (!selectedSyId) {
          const active = syList.find((s: any) => s.isActive);
          if (active) setSelectedSyId(active.id);
          else if (syList.length > 0) setSelectedSyId(syList[0].id);
        }
      }
      if (divRes.ok) setDivisions(await divRes.json());
      if (clsRes.ok) setClassifications(await clsRes.json());
    } catch (err) {
      console.error('Failed to load filter dropdowns:', err);
    }
  };

  // Load districts whenever division changes
  useEffect(() => {
    loadDistricts();
  }, [selectedDivisionId, user?.role]);

  const loadDistricts = async () => {
    try {
      const divParam = selectedDivisionId ? `?divisionId=${selectedDivisionId}` : '';
      const res = await apiFetch(`/api/monitoring/districts${divParam}`);
      if (res.ok) {
        const list = await res.json();
        setDistricts(list);
      }
    } catch (err) {
      console.error('Failed to load districts:', err);
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
    searchQuery,
    sortBy,
    sortDir,
    currentPage,
    pageSize,
  ]);

  const loadMonitoringData = async () => {
    setLoading(true);
    setError(null);
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
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || `Failed to fetch data (${res.status})`);
      }
    } catch (err: any) {
      console.error('Monitoring load error:', err);
      setError(err?.message || 'Network connection failed. Please retry.');
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
    setSearchQuery(searchInput.trim());
    setCurrentPage(1);
  };

  const clearFilters = () => {
    if (user?.role === 'regional') setSelectedDivisionId('');
    setSelectedDistrict('');
    setSelectedClassification('');
    setSelectedStatus('');
    setSearchQuery('');
    setSearchInput('');
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
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
          <button
            className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
            onClick={() => setShowExportModal(true)}
          >
            <i className="bi bi-file-earmark-excel"></i> Export Consolidated Excel (4 Sheets)
          </button>
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
                  {districts.length > 0 ? (
                    <select
                      className="form-select form-select-sm"
                      value={selectedDistrict}
                      onChange={(e) => {
                        setSelectedDistrict(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">All Districts ({districts.length})</option>
                      {districts.map((dst) => (
                        <option key={dst} value={dst}>
                          {dst}
                        </option>
                      ))}
                    </select>
                  ) : (
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
                  )}
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
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                      />
                      <button type="submit" className="btn btn-primary" title="Search">
                        <i className="bi bi-search"></i>
                      </button>
                      {searchQuery && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          title="Clear search"
                          onClick={() => {
                            setSearchInput('');
                            setSearchQuery('');
                            setCurrentPage(1);
                          }}
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      )}
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
                        onClick={() => {
                          setSearchInput('');
                          setSearchQuery('');
                        }}
                      ></i>
                    </span>
                  )}
                  <button
                    className="btn btn-link btn-sm p-0 text-danger text-decoration-none"
                    onClick={clearFilters}
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Error Alert Banner */}
          {error && !loading && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between mb-4 shadow-sm rounded-3">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill fs-5 text-danger"></i>
                <div>
                  <strong>Monitoring Data Error:</strong> {error}
                </div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={loadMonitoringData}>
                <i className="bi bi-arrow-clockwise me-1"></i> Retry
              </button>
            </div>
          )}

          {/* Monitoring Table */}
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center">
              <div>
                <span className="fw-bold text-dark">
                  Showing {data.length} of {totalRecords} schools
                </span>
                <span className="badge bg-light text-secondary border ms-2">
                  Active Indicator Count: {activeIndicatorCount}
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
                      Answered Indicators ({activeIndicatorCount} Active) {getSortIcon('answeredCount')}
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
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <div className="text-muted small mt-2 fw-semibold">Loading school submission records...</div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={10} className="text-center py-5 text-danger">
                        <i className="bi bi-exclamation-triangle fs-2 d-block mb-2 text-danger"></i>
                        <div className="fw-bold mb-1">Failed to load monitoring data</div>
                        <div className="small text-muted mb-3">{error}</div>
                        <button className="btn btn-primary btn-sm" onClick={loadMonitoringData}>
                          <i className="bi bi-arrow-clockwise me-1"></i> Retry
                        </button>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-5 text-muted">
                        <i className="bi bi-inbox fs-2 d-block text-secondary mb-2"></i>
                        <div className="h6 fw-bold text-dark mb-1">No Schools Found</div>
                        <div className="small text-muted mb-3">
                          No schools matched your search or filter criteria.
                        </div>
                        <button className="btn btn-outline-primary btn-sm" onClick={clearFilters}>
                          <i className="bi bi-x-circle me-1"></i> Clear All Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    data.map((item) => {
                      const isComplete =
                        activeIndicatorCount > 0 && item.answeredCount === activeIndicatorCount;

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
                              {item.answeredCount} / {activeIndicatorCount}
                            </span>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                              {activeIndicatorCount > 0
                                ? `${Math.round((item.answeredCount / activeIndicatorCount) * 100)}%`
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
              <div className="card-footer bg-white py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div className="small text-muted">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (Total {totalRecords} records)
                </div>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(1)} title="First Page">
                      &laquo;
                    </button>
                  </li>
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                      Prev
                    </button>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .map((pageNum, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && pageNum - prev > 1;
                      return (
                        <React.Fragment key={pageNum}>
                          {showEllipsis && (
                            <li className="page-item disabled">
                              <span className="page-link">...</span>
                            </li>
                          )}
                          <li className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                            <button className="page-link" onClick={() => setCurrentPage(pageNum)}>
                              {pageNum}
                            </button>
                          </li>
                        </React.Fragment>
                      );
                    })}
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                      Next
                    </button>
                  </li>
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(totalPages)} title="Last Page">
                      &raquo;
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      <ExportConsolidatedModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultSchoolYearId={selectedSyId}
        defaultDivisionId={selectedDivisionId}
      />
    </div>
  );
};
