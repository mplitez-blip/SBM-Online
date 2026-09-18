import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';

export const SchoolManagement: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classifications, setClassifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | string>(
    user?.role === 'division' ? user.divisionId! : ''
  );
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  // Add/Edit School Modal
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<any>(null);
  const [schoolIdInput, setSchoolIdInput] = useState('');
  const [schoolNameInput, setSchoolNameInput] = useState('');
  const [divisionIdInput, setDivisionIdInput] = useState<number | string>(
    user?.role === 'division' ? user.divisionId! : ''
  );
  const [districtInput, setDistrictInput] = useState('');
  const [classificationInput, setClassificationInput] = useState('Elementary');
  const [schoolHeadInput, setSchoolHeadInput] = useState('');
  const [initialPasswordInput, setInitialPasswordInput] = useState('');

  // Password Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetSchool, setResetTargetSchool] = useState<any>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // CSV Import Modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvDivisionId, setCsvDivisionId] = useState<number | string>(
    user?.role === 'division' ? user.divisionId! : ''
  );
  const [csvContent, setCsvContent] = useState('');
  const [csvParsed, setCsvParsed] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    loadDivisionsAndClasses();
  }, []);

  useEffect(() => {
    loadSchools();
  }, [selectedDivisionId, selectedDistrict, selectedClass]);

  const loadDivisionsAndClasses = async () => {
    try {
      const [divRes, clsRes] = await Promise.all([
        apiFetch('/api/divisions'),
        apiFetch('/api/classifications'),
      ]);
      if (divRes.ok) setDivisions(await divRes.json());
      if (clsRes.ok) setClassifications(await clsRes.json());
    } catch (err) {
      console.error('Failed to load divisions/classes:', err);
    }
  };

  const loadSchools = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDivisionId) params.append('divisionId', String(selectedDivisionId));
      if (selectedDistrict) params.append('district', selectedDistrict);
      if (selectedClass) params.append('classification', selectedClass);
      if (searchQuery) params.append('search', searchQuery);

      const res = await apiFetch(`/api/schools?${params.toString()}`);
      if (res.ok) {
        setSchools(await res.json());
      }
    } catch (err) {
      console.error('Failed to load schools:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadSchools();
  };

  // Submit Add or Edit
  const handleSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);

    // Validate 6 digits
    if (!/^\d{6}$/.test(schoolIdInput.trim())) {
      setAlertMsg({ type: 'danger', text: 'School ID must be exactly 6 digits.' });
      return;
    }

    try {
      if (editingSchool) {
        const res = await apiFetch(`/api/schools/${editingSchool.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            schoolName: schoolNameInput.trim(),
            divisionId: Number(divisionIdInput),
            district: districtInput.trim(),
            classification: classificationInput,
            schoolHead: schoolHeadInput.trim(),
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setAlertMsg({ type: 'danger', text: json.error || 'Failed to update school.' });
        } else {
          setAlertMsg({ type: 'success', text: 'School updated successfully.' });
          setShowSchoolModal(false);
          await loadSchools();
        }
      } else {
        const res = await apiFetch('/api/schools', {
          method: 'POST',
          body: JSON.stringify({
            schoolId: schoolIdInput.trim(),
            schoolName: schoolNameInput.trim(),
            divisionId: Number(divisionIdInput),
            district: districtInput.trim(),
            classification: classificationInput,
            schoolHead: schoolHeadInput.trim(),
            initialPassword: initialPasswordInput.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setAlertMsg({ type: 'danger', text: json.error || 'Failed to create school.' });
        } else {
          setAlertMsg({
            type: 'success',
            text: `School created! Account username: ${json.school.schoolId}, default password: ${json.defaultPassword || initialPasswordInput}`,
          });
          setShowSchoolModal(false);
          await loadSchools();
        }
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error.' });
    }
  };

  // Submit Password Reset
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetSchool) return;

    try {
      const res = await apiFetch(`/api/schools/${resetTargetSchool.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: newResetPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to reset password.' });
      } else {
        setAlertMsg({
          type: 'success',
          text: `Password for ${resetTargetSchool.schoolName} (${resetTargetSchool.schoolId}) reset to: ${newResetPassword || json.defaultPassword}`,
        });
        setShowResetModal(false);
        setResetTargetSchool(null);
        setNewResetPassword('');
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Failed to reset password.' });
    }
  };

  // CSV file reading
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      parseCsv(text);
    };
    reader.readAsText(file);
  };

  const parseCsv = (text: string) => {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) return;

    // Header row
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const parsed: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length >= 2) {
        parsed.push({
          schoolId: cols[0],
          schoolName: cols[1],
          district: cols[2] || 'Central District',
          classification: cols[3] || 'Elementary',
          schoolHead: cols[4] || 'Unassigned',
        });
      }
    }
    setCsvParsed(parsed);
  };

  const handleImportSubmit = async () => {
    if (csvParsed.length === 0) return;
    setImporting(true);

    try {
      const res = await apiFetch('/api/schools/import-csv', {
        method: 'POST',
        body: JSON.stringify({
          divisionId: Number(csvDivisionId),
          schools: csvParsed,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setAlertMsg({ type: 'danger', text: json.error || 'Failed to import CSV.' });
      } else {
        setAlertMsg({
          type: 'success',
          text: `Successfully imported ${json.importedCount} schools! (${json.skippedCount} skipped/duplicates).`,
        });
        setShowCsvModal(false);
        setCsvParsed([]);
        setCsvContent('');
        await loadSchools();
      }
    } catch (err) {
      setAlertMsg({ type: 'danger', text: 'Network error during CSV import.' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h1 className="h4 fw-bold text-dark mb-0">School Directory & Account Management</h1>
          <div className="text-muted small">
            Manage school profiles, user credentials, reset passwords, and bulk-import schools via CSV
          </div>
        </div>

        <div className="d-flex gap-2 mt-2 mt-md-0">
          <button
            className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
            onClick={() => setShowCsvModal(true)}
          >
            <i className="bi bi-file-earmark-arrow-up"></i> Batch Import CSV
          </button>
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
            onClick={() => {
              setEditingSchool(null);
              setSchoolIdInput('');
              setSchoolNameInput('');
              setDistrictInput('');
              setClassificationInput('Elementary');
              setSchoolHeadInput('');
              setInitialPasswordInput('');
              setShowSchoolModal(true);
            }}
          >
            <i className="bi bi-plus-lg"></i> Add New School
          </button>
        </div>
      </div>

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

      {/* Filter Row */}
      <div className="card border-0 shadow-sm rounded-3 mb-4">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            {user?.role === 'regional' && (
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label small fw-semibold text-secondary">Division</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedDivisionId}
                  onChange={(e) => setSelectedDivisionId(e.target.value)}
                >
                  <option value="">All Divisions</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.divisionName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label small fw-semibold text-secondary">District</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Filter by district..."
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              />
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label small fw-semibold text-secondary">Classification</label>
              <select
                className="form-select form-select-sm"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">All Classifications</option>
                {classifications.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <form onSubmit={handleSearch}>
                <label className="form-label small fw-semibold text-secondary">Search ID / Name</label>
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search schools..."
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
        </div>
      </div>

      {/* Schools Table */}
      <div className="card border-0 shadow-sm rounded-3">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
          <h5 className="fw-bold mb-0 text-dark">
            Registered Schools ({schools.length})
          </h5>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light small text-secondary">
              <tr>
                <th>School ID</th>
                <th>School Name</th>
                <th>Division</th>
                <th>District</th>
                <th>Classification</th>
                <th>School Head</th>
                <th>Account Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                  </td>
                </tr>
              ) : schools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-muted">
                    No schools found matching your search.
                  </td>
                </tr>
              ) : (
                schools.map((s) => (
                  <tr key={s.id}>
                    <td className="fw-bold text-primary">{s.schoolId}</td>
                    <td>
                      <div className="fw-semibold text-dark">{s.schoolName}</div>
                      <div className="text-muted small">Login: {s.username || s.schoolId}</div>
                    </td>
                    <td className="small text-secondary">{s.divisionName}</td>
                    <td className="small text-secondary">{s.district}</td>
                    <td>
                      <span className="badge bg-light text-dark border">{s.classification}</span>
                    </td>
                    <td className="small text-dark fw-semibold">{s.schoolHead}</td>
                    <td>
                      <span className="badge bg-success-subtle text-success border">
                        <i className="bi bi-check-circle me-1"></i> Active
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => {
                            setEditingSchool(s);
                            setSchoolIdInput(s.schoolId);
                            setSchoolNameInput(s.schoolName);
                            setDivisionIdInput(s.divisionId);
                            setDistrictInput(s.district);
                            setClassificationInput(s.classification);
                            setSchoolHeadInput(s.schoolHead);
                            setShowSchoolModal(true);
                          }}
                          title="Edit School Details"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-outline-warning text-dark"
                          onClick={() => {
                            setResetTargetSchool(s);
                            setNewResetPassword('');
                            setShowResetModal(true);
                          }}
                          title="Reset Portal Password"
                        >
                          <i className="bi bi-key"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit School Modal */}
      {showSchoolModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-building me-2"></i>
                  {editingSchool ? 'Edit School Information' : 'Add New DepEd School'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowSchoolModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSchoolSubmit}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold">
                        6-Digit DepEd School ID
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 303480"
                        value={schoolIdInput}
                        onChange={(e) => setSchoolIdInput(e.target.value)}
                        disabled={!!editingSchool}
                        required
                        pattern="\d{6}"
                        title="Exactly 6 digits"
                      />
                    </div>

                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold">School Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Palo National High School"
                        value={schoolNameInput}
                        onChange={(e) => setSchoolNameInput(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold">Schools Division</label>
                      <select
                        className="form-select"
                        value={divisionIdInput}
                        onChange={(e) => setDivisionIdInput(e.target.value)}
                        disabled={user?.role === 'division'}
                        required
                      >
                        {divisions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.divisionName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold">School District</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Palo I District"
                        value={districtInput}
                        onChange={(e) => setDistrictInput(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold">Classification</label>
                      <select
                        className="form-select"
                        value={classificationInput}
                        onChange={(e) => setClassificationInput(e.target.value)}
                        required
                      >
                        {classifications.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold">
                        School Head / Principal Name
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Maria Santos, Ed.D."
                        value={schoolHeadInput}
                        onChange={(e) => setSchoolHeadInput(e.target.value)}
                        required
                      />
                    </div>

                    {!editingSchool && (
                      <div className="col-12 border-top pt-3">
                        <label className="form-label small fw-semibold">
                          Custom Initial Password (Optional)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Leave blank to auto-generate (School@<SchoolID>)"
                          value={initialPasswordInput}
                          onChange={(e) => setInitialPasswordInput(e.target.value)}
                        />
                        <div className="form-text small">
                          If left blank, default password will be <code>School@&lt;SchoolID&gt;</code>.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowSchoolModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingSchool ? 'Update School' : 'Create School & Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetModal && resetTargetSchool && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title">
                  <i className="bi bi-key-fill me-2"></i> Reset School Account Password
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowResetModal(false)}
                ></button>
              </div>
              <form onSubmit={handleResetSubmit}>
                <div className="modal-body p-4">
                  <p className="small text-muted mb-3">
                    Resetting password for <strong>{resetTargetSchool.schoolName}</strong> (ID:{' '}
                    <code>{resetTargetSchool.schoolId}</code>).
                  </p>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">New Password (Optional):</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={`Leave blank to default to School@${resetTargetSchool.schoolId}`}
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                    />
                    <div className="form-text small">
                      Default: <code>School@{resetTargetSchool.schoolId}</code>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowResetModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-warning text-dark fw-bold">
                    Reset Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CSV Batch Import Modal */}
      {showCsvModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-file-earmark-spreadsheet me-2"></i> Batch Import Schools from CSV
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowCsvModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Target Division</label>
                  <select
                    className="form-select form-select-sm"
                    value={csvDivisionId}
                    onChange={(e) => setCsvDivisionId(e.target.value)}
                    disabled={user?.role === 'division'}
                  >
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.divisionName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Upload CSV File</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileUpload}
                  />
                  <div className="form-text small mt-1">
                    CSV format must have headers: <code>schoolId, schoolName, district, classification, schoolHead</code>
                  </div>
                </div>

                {csvParsed.length > 0 && (
                  <div className="border rounded p-3 bg-light">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-bold small text-dark">
                        Preview Parsed Schools ({csvParsed.length})
                      </span>
                      <span className="badge bg-success">{csvParsed.length} Ready</span>
                    </div>
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <table className="table table-sm table-bordered bg-white small mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>School ID</th>
                            <th>School Name</th>
                            <th>District</th>
                            <th>Class</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvParsed.slice(0, 10).map((row, rIdx) => (
                            <tr key={rIdx}>
                              <td>{row.schoolId}</td>
                              <td>{row.schoolName}</td>
                              <td>{row.district}</td>
                              <td>{row.classification}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvParsed.length > 10 && (
                        <div className="text-center text-muted small mt-1">
                          ...and {csvParsed.length - 10} more rows
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCsvModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleImportSubmit}
                  disabled={csvParsed.length === 0 || importing}
                >
                  {importing ? 'Importing Schools...' : `Confirm Import (${csvParsed.length} Schools)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
