import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import BottomDrawer, { DrawerSpinner, cancelBtnStyle, primaryBtnStyle } from './ui/BottomDrawer';
import { useUploadStudents } from '../hooks/useStudents';
import { useToast } from './ui/Toast';
import { Checkbox } from '@mantine/core';
import api from '../utils/api';

const REQUIRED_COLUMNS = [
  { name: 'Registration Number', note: 'unique student ID' },
  { name: 'Student Name',        note: null },
  { name: 'Course',              note: 'b_pharm / pharm_d / m_pharm' },
  { name: 'Year',                note: '1–6' },
  { name: 'Semester',            note: '1–12' },
  { name: 'Batch Year',          note: 'e.g. 2023' },
  { name: 'Academic Year',       note: 'e.g. 2025-26' },
];

const OPTIONAL_COLUMNS = [
  { name: 'Gender',  note: 'male / female / other' },
  { name: 'Phone',   note: 'for notifications' },
];

export default function UploadStudentsDrawer({ open, onClose }) {
  const toast = useToast();
  const upload = useUploadStudents();
  const [file, setFile]           = useState(null);
  const [result, setResult]       = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [showErrors, setShowErrors]   = useState(false);
  const [dryRun, setDryRun]           = useState(false);
  const [deactivateMissing, setDeactivateMissing] = useState(false);

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const res = await api.get('/students/upload-template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'students-upload-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ message: 'Could not download template.', type: 'error' });
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    try {
      const res = await upload.mutateAsync({ file, dryRun, deactivateMissing });
      setResult(res.data);
      if (res.data.dry_run) {
        toast({ message: `Preview: ${res.data.would_add} to add, ${res.data.would_update} to update, ${res.data.would_deactivate} to deactivate.` });
      } else {
        toast({ message: `Upload complete: ${res.data.added_count} added, ${res.data.updated_count} updated${deactivateMissing ? `, ${res.data.deactivated_count} deactivated` : ''}.` });
      }
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Upload failed.', type: 'error' });
    }
  }

  function handleClose() {
    setFile(null);
    setResult(null);
    setShowErrors(false);
    setDryRun(false);
    setDeactivateMissing(false);
    onClose();
  }

  return (
    <BottomDrawer
      open={open}
      onClose={handleClose}
      title="Upload students"
      subtitle="Excel .xlsx — upserts matching registration numbers, optionally deactivates missing students"
      footer={
        <>
          <button type="button" onClick={handleClose} style={cancelBtnStyle}>Close</button>
          <button
            disabled={upload.isPending || !file}
            onClick={handleUpload}
            data-primary=""
            style={primaryBtnStyle(upload.isPending || !file)}
          >
            {upload.isPending && <DrawerSpinner />}
            {upload.isPending ? (dryRun ? 'Previewing…' : 'Uploading…') : (dryRun ? 'Preview' : 'Upload')}
          </button>
        </>
      }
    >
      <div style={{ padding: '16px 20px 8px' }}>

        {/* Required columns */}
        <p style={{
          fontSize: 'var(--text-micro)', fontWeight: 800, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
        }}>Required columns</p>
        <div style={{
          backgroundColor: 'var(--color-blue-50)', border: '1px solid var(--color-blue-200)',
          borderRadius: 'var(--radius-lg)', padding: '12px 14px', marginBottom: 10,
        }}>
          {REQUIRED_COLUMNS.map((col, i) => (
            <div key={col.name} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: i > 0 ? 6 : 0 }}>
              <div style={{ width: 4, height: 4, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-cyan-solid)', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-card)', color: 'var(--color-cyan-text)', fontWeight: 600 }}>{col.name}</span>
              {col.note && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>— {col.note}</span>}
            </div>
          ))}
        </div>

        {/* Optional columns */}
        <p style={{
          fontSize: 'var(--text-micro)', fontWeight: 800, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
        }}>Optional columns</p>
        <div style={{
          backgroundColor: 'var(--surface-page)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '12px 14px', marginBottom: 16,
        }}>
          {OPTIONAL_COLUMNS.map((col, i) => (
            <div key={col.name} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: i > 0 ? 6 : 0 }}>
              <div style={{ width: 4, height: 4, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-card)', color: 'var(--text-secondary)', fontWeight: 500 }}>{col.name}</span>
              {col.note && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>— {col.note}</span>}
            </div>
          ))}
        </div>

        {/* Download template */}
        <button
          onClick={handleDownloadTemplate}
          disabled={downloading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, padding: '10px 16px', marginBottom: 16,
            border: '1.5px dashed var(--color-blue-200)', borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-blue-50)', cursor: downloading ? 'not-allowed' : 'pointer',
            fontSize: 'var(--text-card)', fontWeight: 700,
            color: downloading ? 'var(--color-blue-300)' : 'var(--brand)',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
        >
          <Download size={15} strokeWidth={2} />
          {downloading ? 'Downloading…' : 'Download sample template (.xlsx)'}
        </button>

        {/* File picker */}
        <p style={{
          fontSize: 'var(--text-micro)', fontWeight: 800, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
        }}>File</p>
        <label style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 8,
          width: '100%', minHeight: 100,
          border: `2px dashed ${file ? 'var(--brand)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-xl)',
          backgroundColor: file ? 'var(--color-blue-50)' : 'var(--surface-page)',
          cursor: 'pointer',
          padding: '16px 20px',
          boxSizing: 'border-box',
          transition: 'all 0.15s',
          marginBottom: 16,
        }}>
          <FileText size={22} strokeWidth={1.5} color={file ? 'var(--brand)' : 'var(--text-muted)'} />
          <span style={{
            fontSize: 'var(--text-card)', fontWeight: 600, textAlign: 'center',
            color: file ? 'var(--brand)' : 'var(--text-secondary)',
          }}>
            {file ? file.name : 'Tap to choose file'}
          </span>
          {!file && (
            <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>Excel workbook (.xlsx or .xls)</span>
          )}
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files[0] || null)}
            style={{ display: 'none' }}
          />
        </label>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <Checkbox
            label="Dry run — preview changes without saving"
            checked={dryRun}
            onChange={(e) => setDryRun(e.currentTarget.checked)}
            styles={{ label: { fontSize: 'var(--text-small)', color: 'var(--text-secondary)' } }}
          />
          <Checkbox
            label="Deactivate students in the same course/year not in this file"
            checked={deactivateMissing}
            onChange={(e) => setDeactivateMissing(e.currentTarget.checked)}
            styles={{ label: { fontSize: 'var(--text-small)', color: 'var(--text-secondary)' } }}
          />
        </div>

        {/* Result */}
        {result && (
          <div style={{
            backgroundColor: result.dry_run ? 'var(--color-blue-50)' : 'var(--color-emerald-bg)',
            border: `1px solid ${result.dry_run ? 'var(--color-blue-200)' : 'var(--color-emerald-border)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '12px 14px',
            marginBottom: 20,
          }}>
            <p style={{
              fontSize: 'var(--text-card)',
              color: result.dry_run ? 'var(--brand)' : 'var(--color-emerald-text)',
              fontWeight: 600, marginBottom: 4,
            }}>
              {result.dry_run ? 'Dry run preview' : 'Upload complete'}
            </p>
            {result.dry_run ? (
              <>
                <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>
                  Would add: {result.would_add} · Would update: {result.would_update} · Would deactivate: {result.would_deactivate}
                </p>
                <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {result.valid_rows} valid row{result.valid_rows !== 1 ? 's' : ''}
                  {result.invalid_rows > 0 && ` · ${result.invalid_rows} row${result.invalid_rows !== 1 ? 's' : ''} with errors`}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-emerald-text)' }}>
                Added: {result.added_count} · Updated: {result.updated_count}{deactivateMissing ? ` · Deactivated: ${result.deactivated_count}` : ''}
              </p>
            )}
            {result.error_count > 0 && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowErrors(s => !s)}
                  style={{
                    fontSize: 'var(--text-small)', color: 'var(--color-red-solid)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  {showErrors ? '▲' : '▼'} {showErrors ? 'Hide' : 'Show'} {result.error_count} error{result.error_count > 1 ? 's' : ''}
                </button>
                {showErrors && Array.isArray(result.errors) && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--color-red-border)', paddingTop: 8 }}>
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {result.errors.map((err, i) => (
                        <div key={i} style={{
                          display: 'flex', flexDirection: 'column', gap: 2,
                          padding: '6px 0', borderBottom: '1px solid var(--divider)',
                          fontSize: 'var(--text-small)',
                        }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Row {err.row}{err.registration_number ? ` · ${err.registration_number}` : ''}
                          </span>
                          <span style={{ color: 'var(--color-red-solid)' }}>
                            {Array.isArray(err.reasons) ? err.reasons.join('; ') : err.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </BottomDrawer>
  );
}
