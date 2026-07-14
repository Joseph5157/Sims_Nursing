⚠️  ARCHIVED — SUPERSEDED BY MANTINE MIGRATION (June 2026)
════════════════════════════════════════════════════════════
This document described the pre-Mantine Tailwind-only UI system.
ALL patterns below are obsolete:
  - MobileCard with inline styles → use Mantine's Card or the established
    md:hidden card-list / md:block table split (already in every page)
  - Bottom tab bar (pb-20, 60px) → removed; Mantine AppShell sidebar handles nav
  - Hardcoded colors (#2563eb, #0f172a, etc.) → use CSS variables (var(--text-primary) etc.)
    or Mantine's theme tokens
  - Custom Button/Input/Table/Modal components → replaced by @mantine/core equivalents
  - window.confirm / window.prompt → replaced by ConfirmDialog / FormModal from ui/
  - SectionHeader / EmptyState function components → use Mantine Text + EmptyState from ui/

Current patterns live in:
  - client/src/components/ui/   (FormModal, ConfirmDialog, Table, Badge, etc.)
  - client/src/components/Layout.jsx  (AppShell, PageHeader, Card, CardBody)
  - Phase 2–3d migration history in git log on branch mantine-migration
════════════════════════════════════════════════════════════

Before making any frontend changes, read and follow these rules:

RULE 1 — MOBILE LAYOUT PRIORITY
This is a PWA used primarily on mobile phones (390px width).
Every layout decision must work perfectly at 390px first.
Desktop is secondary.

RULE 2 — NO TABLES ON MOBILE
Never render HTML tables on screens smaller than md (768px).
On mobile, replace every table with a card list.
Each row becomes a card with:
  - Primary info (name, title) large and bold at top
  - Secondary info (status, role, date) as small badges below
  - Action button on the right or a chevron >
  - Full width, edge to edge, py-4 px-4 per card
  - Divider line between cards (border-b border-slate-100)

RULE 3 — CARD LIST PATTERN (use this for every data list on mobile)

function MobileCard({ primary, secondary, meta, badge, action, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', backgroundColor: '#fff',
      borderBottom: '1px solid #f1f5f9', cursor: onClick ? 'pointer' : 'default',
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a',
          marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis' }}>
          {primary}
        </p>
        {secondary && (
          <p style={{ fontSize: 12, color: '#94a3b8' }}>{secondary}</p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, shrink: 0 }}>
        {badge}
        {action}
        {onClick && <span style={{ color: '#cbd5e1', fontSize: 18 }}>›</span>}
      </div>
    </div>
  );
}

Wrap a list of these in:
  <div style={{ backgroundColor: '#fff', borderRadius: 16,
    border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 16 }}>
    {items.map(...)}
  </div>

RULE 4 — SECTION HEADERS
Every section needs a label above it:

function SectionHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', padding: '0 4px', marginBottom: 8, marginTop: 20 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </p>
      {action}
    </div>
  );
}

RULE 5 — STAT CARDS
Always 2-column grid. Never 1 column, never 3 columns on mobile.
Minimum height 100px. Number font size minimum 36px, weight 800.
Always have a colored left border (4px wide) matching the accent color.

RULE 6 — PAGE STRUCTURE
Every page must follow this structure:

  <Layout>
    {/* 1. Page header — title + primary action button */}
    <PageHeader title="..." action={<Button>...</Button>} />
    
    {/* 2. Filter/search bar if needed — full width */}
    
    {/* 3. Stats summary if relevant — 2-col grid */}
    
    {/* 4. Main content — card list (not table) on mobile */}
    <div className="md:hidden">  {/* Mobile: card list */}
      {items.map(item => <MobileCard ... />)}
    </div>
    <div className="hidden md:block">  {/* Desktop: table */}
      <Table>...</Table>
    </div>
    
    {/* 5. Footer summary — total count, last updated, etc. */}
  </Layout>

RULE 7 — EMPTY STATES
Never show a blank screen. Every empty state needs:

function EmptyState({ emoji, title, subtitle, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <p style={{ fontSize: 48, marginBottom: 12 }}>{emoji}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a',
        marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>{subtitle}</p>
      {action}
    </div>
  );
}

RULE 8 — TYPOGRAPHY SCALE (use only these sizes)
  Page title:      18px bold      (PageHeader)
  Section label:   11px semibold uppercase tracking-widest muted
  Card primary:    15px semibold
  Card secondary:  12px regular muted
  Stat number:     40px extrabold
  Stat label:      11px semibold uppercase muted
  Badge:           11px medium
  Button:          13px semibold
  Table header:    11px semibold uppercase muted
  Table cell:      13px regular

RULE 9 — SPACING SYSTEM
  Page padding:       px-4 (16px sides)
  Card padding:       py-3.5 px-4 (14px top/bottom, 16px sides)
  Section gap:        mt-5 (20px between sections)
  Card gap:           0 (dividers only, no gap between cards)
  Grid gap:           gap-3 (12px)
  Bottom tab height:  60px (pb-20 on content to clear it)

RULE 10 — COLORS (use only these)
  Page background:   #f8fafc
  Card background:   #ffffff
  Border:            #e2e8f0
  Divider:           #f1f5f9
  Text primary:      #0f172a
  Text secondary:    #64748b
  Text muted:        #94a3b8
  Brand blue:        #2563eb
  Success green:     #10b981
  Warning amber:     #f59e0b
  Danger red:        #ef4444