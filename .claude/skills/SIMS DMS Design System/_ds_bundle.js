/* @ds-bundle: {"format":3,"namespace":"SIMSDMSDesignSystem_019e12","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/Card.jsx"},{"name":"CardBody","sourcePath":"components/core/Card.jsx"},{"name":"StatCard","sourcePath":"components/core/StatCard.jsx"},{"name":"Table","sourcePath":"components/core/Table.jsx"},{"name":"Th","sourcePath":"components/core/Table.jsx"},{"name":"Td","sourcePath":"components/core/Table.jsx"},{"name":"Tr","sourcePath":"components/core/Table.jsx"},{"name":"EmptyRow","sourcePath":"components/core/Table.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"BrandMark","sourcePath":"components/patterns/BrandMark.jsx"},{"name":"EmptyState","sourcePath":"components/patterns/EmptyState.jsx"},{"name":"MobileCard","sourcePath":"components/patterns/MobileCard.jsx"},{"name":"SectionHeader","sourcePath":"components/patterns/SectionHeader.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"e41d515c5754","components/core/Badge.jsx":"c9154a28dcd6","components/core/Button.jsx":"0cce7cc0263e","components/core/Card.jsx":"8d38e47b26d5","components/core/StatCard.jsx":"1bc99c0c5210","components/core/Table.jsx":"d130b9109e5d","components/feedback/Alert.jsx":"18d3c85f88dd","components/forms/Input.jsx":"ed4acef46fcc","components/forms/Select.jsx":"fb56e184ab85","components/patterns/BrandMark.jsx":"19d01662f2f9","components/patterns/EmptyState.jsx":"768c73ee2755","components/patterns/MobileCard.jsx":"ce39c86c2fbd","components/patterns/SectionHeader.jsx":"964f2395f001","ui_kits/admin-desktop/AdminScreens.jsx":"a03a4c96f7a0","ui_kits/admin-desktop/AdminShell.jsx":"0aceaebc1837","ui_kits/faculty-pwa/screens.jsx":"06556ecdb822","ui_kits/faculty-pwa/shell.jsx":"b35308eb6bc0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SIMSDMSDesignSystem_019e12 = window.SIMSDMSDesignSystem_019e12 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
const SIZES = {
  sm: 30,
  default: 38,
  lg: 48
};

/**
 * Avatar — initials badge. `onDark` uses the sidebar's ringed style;
 * otherwise a blue→indigo gradient fill.
 */
function Avatar({
  name,
  size = 'default',
  onDark = false,
  style = {}
}) {
  const px = SIZES[size] ?? SIZES.default;
  const base = {
    width: px,
    height: px,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    fontSize: Math.round(px * 0.36),
    flexShrink: 0,
    ...style
  };
  const skin = onDark ? {
    background: '#1e3a5f',
    border: '1px solid var(--blue-600)',
    color: 'var(--blue-400)'
  } : {
    background: 'var(--brand-gradient)',
    color: '#fff'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...base,
      ...skin
    }
  }, initials(name));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const STATUS = {
  // ── User account ──
  active: ['#d1fae5', 'var(--emerald-text)', 'Active'],
  inactive: ['var(--slate-100)', 'var(--slate-500)', 'Inactive'],
  pending: ['#fde68a', 'var(--amber-text)', 'Pending'],
  pending_telegram: ['#cffafe', 'var(--cyan-text)', 'Awaiting Telegram'],
  // ── Invite flow (PendingInvite rows — not yet a user) ──
  invited: ['var(--blue-50)', 'var(--blue-700)', 'Invite sent'],
  invite_expired: ['#fecaca', 'var(--red-text)', 'Link expired'],
  // ── Duty slots ──
  open: ['var(--blue-100)', 'var(--blue-700)', 'Open'],
  covered: ['#d1fae5', 'var(--emerald-text)', 'Covered'],
  expired: ['#fecaca', 'var(--red-text)', 'Expired'],
  cancelled: ['var(--slate-100)', 'var(--slate-500)', 'Cancelled'],
  cover_pending: ['#fed7aa', 'var(--orange-text)', 'Cover needed'],
  scheduled: ['var(--blue-100)', 'var(--blue-700)', 'Scheduled'],
  completed: ['#d1fae5', 'var(--emerald-text)', 'Completed'],
  // ── Attendance ──
  absent: ['#fecaca', 'var(--red-text)', 'Absent'],
  normal: ['#d1fae5', 'var(--emerald-text)', 'On time'],
  late: ['#fde68a', 'var(--amber-text)', 'Late'],
  not_checked_in: ['var(--slate-100)', 'var(--slate-500)', 'Not in'],
  checked_in: ['var(--blue-100)', 'var(--blue-700)', 'Checked in'],
  checked_out: ['#d1fae5', 'var(--emerald-text)', 'Checked out'],
  // ── Misc ──
  hidden: ['var(--slate-100)', 'var(--slate-400)', 'Hidden'],
  flagged: ['#fde68a', 'var(--amber-text)', '⚑ Flagged'],
  // ── Roles ──
  super_admin: ['#ede9fe', 'var(--purple-text)', 'Super Admin'],
  admin: ['#fde68a', 'var(--amber-text)', 'Admin'],
  faculty: ['var(--blue-100)', 'var(--blue-700)', 'Faculty']
};

/**
 * Badge — a compact status / role pill. Pass a known `status` to get the
 * product's canonical color + label, or override `label` for custom text.
 */
function Badge({
  status,
  label,
  style = {}
}) {
  const [bg, color, defaultLabel] = STATUS[status] ?? ['var(--slate-100)', 'var(--slate-500)', status];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 'var(--radius-full)',
      padding: '2px 8px',
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em',
      background: bg,
      color,
      ...style
    }
  }, label ?? defaultLabel);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANTS = {
  primary: {
    background: 'var(--blue-600)',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: 'var(--shadow-stat)',
    hoverBg: 'var(--blue-700)',
    activeBg: 'var(--blue-800)'
  },
  secondary: {
    background: '#fff',
    color: 'var(--slate-700)',
    border: '1px solid var(--slate-200)',
    hoverBg: 'var(--slate-50)',
    activeBg: 'var(--slate-100)'
  },
  danger: {
    background: 'var(--red-solid)',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: 'var(--shadow-stat)',
    hoverBg: '#dc2626',
    activeBg: '#b91c1c'
  },
  success: {
    background: 'var(--emerald-solid)',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: 'var(--shadow-stat)',
    hoverBg: '#059669',
    activeBg: '#047857'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--slate-600)',
    border: '1px solid transparent',
    hoverBg: 'var(--slate-100)',
    activeBg: 'var(--slate-200)'
  },
  outline: {
    background: 'var(--blue-50)',
    color: 'var(--blue-700)',
    border: '1px solid var(--blue-200)',
    hoverBg: 'var(--blue-100)',
    activeBg: 'var(--blue-100)'
  }
};
const SIZES = {
  xs: {
    height: 28,
    padding: '0 10px',
    fontSize: 11,
    borderRadius: 'var(--radius-md)'
  },
  sm: {
    height: 32,
    padding: '0 12px',
    fontSize: 12,
    borderRadius: 'var(--radius-lg)'
  },
  default: {
    minHeight: 44,
    padding: '0 16px',
    fontSize: 13,
    borderRadius: 'var(--radius-xl)'
  },
  lg: {
    height: 48,
    padding: '0 24px',
    fontSize: 15,
    borderRadius: 'var(--radius-xl)'
  }
};

/**
 * Button — the product's primary action control.
 * 6 variants × 4 sizes. Default size respects the 44px mobile tap target.
 */
function Button({
  children,
  variant = 'primary',
  size = 'default',
  loading = false,
  icon = null,
  disabled = false,
  style = {},
  ...props
}) {
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  const s = SIZES[size] ?? SIZES.default;
  const isDisabled = disabled || loading;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: isDisabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      lineHeight: 1,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.5 : 1,
      userSelect: 'none',
      transition: 'background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast)',
      background: hover && !isDisabled ? v.hoverBg : v.background,
      color: v.color,
      border: v.border,
      boxShadow: v.boxShadow ?? 'none',
      ...s,
      ...style
    }
  }, props), loading ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      flexShrink: 0,
      border: '2px solid currentColor',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'simsdms-spin 0.6s linear infinite'
    }
  }) : icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      flexShrink: 0
    }
  }, icon) : null, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
/**
 * Card — the standard white surface: 14px radius, hairline border, soft shadow.
 * Mirrors Layout.jsx's Card/CardHeader/CardBody exports.
 * Optional `title` renders a tinted header bar; otherwise children fill the body.
 */
function Card({
  title,
  headerAction,
  children,
  padded = true,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 14,
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, title && /*#__PURE__*/React.createElement(CardHeader, {
    action: headerAction
  }, title), /*#__PURE__*/React.createElement(CardBody, {
    padded: padded
  }, children));
}

/** Tinted header bar — 13px semibold label + optional right-aligned action. */
function CardHeader({
  children,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '12px 16px',
      borderBottom: '1px solid #f1f5f9',
      background: '#fafafa'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 600,
      color: '#334155'
    }
  }, children), action);
}

/** Card body — 16px padding by default. Set `padded={false}` for edge-to-edge lists. */
function CardBody({
  children,
  padded = true
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: padded ? 16 : 0
    }
  }, children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardBody });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/StatCard.jsx
try { (() => {
/* Exact hex values match client/src/components/ui/StatCard.jsx */
const ACCENTS = {
  blue: {
    bar: '#3b82f6',
    bg: '#eff6ff',
    text: '#1e40af',
    border: '#bfdbfe'
  },
  green: {
    bar: '#10b981',
    bg: '#f0fdf4',
    text: '#065f46',
    border: '#d1fae5'
  },
  yellow: {
    bar: '#f59e0b',
    bg: '#fffbeb',
    text: '#92400e',
    border: '#fde68a'
  },
  red: {
    bar: '#ef4444',
    bg: '#fef2f2',
    text: '#991b1b',
    border: '#fecaca'
  },
  purple: {
    bar: '#8b5cf6',
    bg: '#f5f3ff',
    text: '#5b21b6',
    border: '#ddd6fe'
  },
  default: {
    bar: '#94a3b8',
    bg: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0'
  }
};

/**
 * StatCard — a KPI tile with a colored left accent bar (RULE 5).
 * Number is 36px/800. Use in a 2- or 3-col grid.
 */
function StatCard({
  label,
  value,
  sub,
  accent = 'default',
  icon = null,
  style = {}
}) {
  const c = ACCENTS[accent] ?? ACCENTS.default;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      borderRadius: 'var(--radius-xl)',
      border: `1px solid ${c.border}`,
      background: c.bg,
      padding: '14px 16px 14px 20px',
      overflow: 'hidden',
      minHeight: 96,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: 'var(--shadow-stat)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      background: c.bar,
      borderRadius: '14px 0 0 14px'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--slate-400)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      minWidth: 0
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      flexShrink: 0
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, label)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 36,
      fontWeight: 800,
      color: c.text,
      lineHeight: 1,
      letterSpacing: '-0.02em'
    }
  }, value ?? '—'), sub && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      color: c.text,
      opacity: 0.65,
      marginTop: 2
    }
  }, sub));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Table.jsx
try { (() => {
/**
 * Table — the product's data table shell (overflow-x-auto, rounded, shadow).
 * Compose with Th, Td, Tr, EmptyRow.
 * Mirrors client/src/components/ui/Table.jsx exactly.
 */
function Table({
  children,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto',
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
      background: '#fff',
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      minWidth: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-sans)'
    }
  }, children));
}

/** Table header cell — 10px bold uppercase, slate-50 background. */
function Th({
  children,
  style = {},
  hidden
}) {
  if (hidden) return null;
  return /*#__PURE__*/React.createElement("th", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      background: '#f8fafc',
      padding: '10px 16px',
      textAlign: 'left',
      whiteSpace: 'nowrap',
      ...style
    }
  }, children);
}

/** Table data cell — 13px slate-700. */
function Td({
  children,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("td", {
    style: {
      fontSize: 13,
      color: '#334155',
      padding: '10px 16px',
      borderBottom: '1px solid #f1f5f9',
      ...style
    }
  }, children);
}

/** Table row — blue hover when clickable. */
function Tr({
  children,
  onClick,
  style = {}
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("tr", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: hover && onClick ? 'rgba(239,246,255,0.5)' : 'transparent',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background-color 0.1s',
      ...style
    }
  }, children);
}

/** Empty state row — centered 📭 icon + message. */
function EmptyRow({
  cols,
  message = 'No records found.'
}) {
  return /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: cols,
    style: {
      padding: '48px 16px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 32,
      opacity: 0.4
    }
  }, "\uD83D\uDCED"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: '#94a3b8'
    }
  }, message))));
}
Object.assign(__ds_scope, { Table, Th, Td, Tr, EmptyRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
const TONES = {
  info: {
    bg: 'var(--blue-50)',
    border: 'var(--blue-200)',
    accent: 'var(--blue-500)',
    title: 'var(--blue-800)',
    body: 'var(--blue-700)'
  },
  success: {
    bg: 'var(--emerald-bg)',
    border: 'var(--emerald-border)',
    accent: 'var(--emerald-solid)',
    title: 'var(--emerald-text)',
    body: '#047857'
  },
  warning: {
    bg: 'var(--amber-bg)',
    border: 'var(--amber-border)',
    accent: 'var(--amber-solid)',
    title: 'var(--amber-text)',
    body: '#b45309'
  },
  danger: {
    bg: 'var(--red-bg)',
    border: 'var(--red-border)',
    accent: 'var(--red-solid)',
    title: 'var(--red-text)',
    body: '#dc2626'
  },
  telegram: {
    bg: 'var(--cyan-bg)',
    border: 'var(--cyan-border)',
    accent: 'var(--cyan-solid)',
    title: 'var(--cyan-text)',
    body: '#0891b2'
  }
};

/**
 * Alert — the inline banner used across dashboards ("3 accounts awaiting
 * approval"). A tinted card with a 3px left accent, icon, title + body.
 */
function Alert({
  tone = 'info',
  icon,
  title,
  children,
  action,
  onClick,
  style = {}
}) {
  const t = TONES[tone] ?? TONES.info;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderLeft: `3px solid ${t.accent}`,
      borderRadius: 'var(--radius-lg)',
      padding: '12px 14px',
      cursor: onClick ? 'pointer' : 'default',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      flexShrink: 0,
      lineHeight: 1.2
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 700,
      color: t.title,
      marginBottom: children ? 2 : 0
    }
  }, title), children && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      color: t.body,
      lineHeight: 1.5
    }
  }, children)), action && /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0
    }
  }, action));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Input — labelled text field. 44px tall, 14px radius, blue focus ring.
 * Supports an uppercase label, error state, and hint text.
 */
function Input({
  label,
  error,
  hint,
  style = {},
  ...props
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--slate-500)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    onFocus: e => {
      setFocus(true);
      props.onFocus?.(e);
    },
    onBlur: e => {
      setFocus(false);
      props.onBlur?.(e);
    },
    style: {
      height: 44,
      width: '100%',
      borderRadius: 'var(--radius-xl)',
      padding: '0 16px',
      fontSize: 14,
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
      background: error ? '#fef2f7' : '#fff',
      border: `1px solid ${error ? 'var(--red-solid)' : focus ? 'var(--blue-500)' : 'var(--slate-200)'}`,
      boxShadow: focus ? `0 0 0 3px ${error ? 'rgba(239,68,68,0.15)' : 'var(--brand-ring)'}` : 'none',
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      ...style
    }
  }, props)), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--red-solid)',
      fontWeight: 500
    }
  }, error), hint && !error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Select — labelled native dropdown styled to match Input. Pass `options`
 * as [{ value, label }] or plain strings.
 */
function Select({
  label,
  error,
  options = [],
  placeholder,
  style = {},
  ...props
}) {
  const [focus, setFocus] = React.useState(false);
  const norm = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--slate-500)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    onFocus: e => {
      setFocus(true);
      props.onFocus?.(e);
    },
    onBlur: e => {
      setFocus(false);
      props.onBlur?.(e);
    },
    style: {
      height: 44,
      width: '100%',
      borderRadius: 'var(--radius-xl)',
      padding: '0 38px 0 16px',
      fontSize: 14,
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
      background: '#fff',
      border: `1px solid ${error ? 'var(--red-solid)' : focus ? 'var(--blue-500)' : 'var(--slate-200)'}`,
      boxShadow: focus ? `0 0 0 3px var(--brand-ring)` : 'none',
      outline: 'none',
      appearance: 'none',
      cursor: 'pointer',
      boxSizing: 'border-box',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      ...style
    }
  }, props), placeholder && /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder), norm.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 14,
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      color: 'var(--slate-400)',
      fontSize: 12
    }
  }, "\u25BE")), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--red-solid)',
      fontWeight: 500
    }
  }, error));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/patterns/BrandMark.jsx
try { (() => {
const SIZES = {
  sm: 28,
  default: 40,
  lg: 72
};
const RADII = {
  sm: 8,
  default: 12,
  lg: 20
};

/**
 * BrandMark — the SIMS DMS app mark: a graduation cap on the blue→indigo
 * gradient tile, optionally locked up with the "SIMS DMS" wordmark.
 */
function BrandMark({
  size = 'default',
  showWordmark = false,
  glow = false,
  style = {}
}) {
  const px = SIZES[size] ?? SIZES.default;
  const tile = /*#__PURE__*/React.createElement("div", {
    style: {
      width: px,
      height: px,
      borderRadius: RADII[size] ?? 12,
      background: 'var(--brand-gradient)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(px * 0.45),
      flexShrink: 0,
      boxShadow: glow ? 'var(--shadow-brand)' : 'none'
    }
  }, "\uD83C\uDF93");
  if (!showWordmark) return /*#__PURE__*/React.createElement("span", {
    style: style
  }, tile);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, tile, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: px > 40 ? 18 : 14,
      fontWeight: 700,
      color: 'var(--text-primary)',
      letterSpacing: '-0.01em'
    }
  }, "SIMS DMS"));
}
Object.assign(__ds_scope, { BrandMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/BrandMark.jsx", error: String((e && e.message) || e) }); }

// components/patterns/EmptyState.jsx
try { (() => {
/**
 * EmptyState — centered placeholder for empty lists (RULE 7). Big emoji,
 * title, subtitle, optional action.
 */
function EmptyState({
  emoji = '📭',
  title,
  subtitle,
  action,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '48px 24px',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 48,
      marginBottom: 12,
      lineHeight: 1
    }
  }, emoji), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--text-primary)',
      marginBottom: 6
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: 'var(--text-muted)',
      marginBottom: 20
    }
  }, subtitle), action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/patterns/MobileCard.jsx
try { (() => {
/**
 * MobileCard — the canonical list row (RULE 3). Primary line + secondary
 * meta, with badge/action/chevron on the right. Wrap a list of these in a
 * white rounded container; they self-divide with bottom borders.
 */
function MobileCard({
  primary,
  secondary,
  badge,
  action,
  onClick,
  showChevron = true
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '14px 16px',
      background: hover && onClick ? 'var(--slate-50)' : '#fff',
      borderBottom: '1px solid var(--divider)',
      cursor: onClick ? 'pointer' : 'default',
      fontFamily: 'var(--font-sans)',
      transition: 'background-color var(--dur-fast)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--text-primary)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, primary), secondary && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 12,
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, secondary)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0
    }
  }, badge, action, onClick && showChevron && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--slate-300)',
      fontSize: 18
    }
  }, "\u203A")));
}
Object.assign(__ds_scope, { MobileCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/MobileCard.jsx", error: String((e && e.message) || e) }); }

// components/patterns/SectionHeader.jsx
try { (() => {
/**
 * SectionHeader — the uppercase muted label that precedes every list/section
 * (RULE 4). Optional right-aligned action.
 */
function SectionHeader({
  title,
  action,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 4px',
      marginBottom: 8,
      marginTop: 20,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--slate-400)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    }
  }, title), action);
}
Object.assign(__ds_scope, { SectionHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/patterns/SectionHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin-desktop/AdminScreens.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* ──────────────────────────────────────────────────────────────
   Admin Desktop — UsersPage + CreateUserDrawer (invite-only)
   Based on client/src/pages/admin/UsersPage.jsx +
   client/src/components/CreateUserDrawer.jsx (post-redesign)
   ────────────────────────────────────────────────────────────── */
const {
  useState,
  useRef,
  useEffect
} = React;
const DS = window.SIMSDMSDesignSystem_019e12;
const {
  Button,
  Badge,
  StatCard,
  Alert
} = DS;

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_USERS = [{
  id: 1,
  name: 'Joseph K',
  email: 'joseph@sims.edu',
  role: 'super_admin',
  dept: '—',
  telegram_id: '8823041',
  status: 'active'
}, {
  id: 2,
  name: 'Priya Sharma',
  email: 'priya.sharma@sims.edu',
  role: 'faculty',
  dept: 'Pharmaceutics',
  telegram_id: '7712890',
  status: 'active'
}, {
  id: 3,
  name: 'Anil Kumar',
  email: 'anil.kumar@sims.edu',
  role: 'faculty',
  dept: 'Pharmacology',
  telegram_id: '5590312',
  status: 'active'
}, {
  id: 4,
  name: 'Reena Joseph',
  email: 'reena.j@sims.edu',
  role: 'faculty',
  dept: 'Clinical',
  telegram_id: null,
  status: 'pending_telegram'
}, {
  id: 5,
  name: 'Sanjay Nair',
  email: 'sanjay.nair@sims.edu',
  role: 'admin',
  dept: '—',
  telegram_id: '6678023',
  status: 'inactive'
}];
const MOCK_INVITES = [{
  id: 1,
  email: 'dr.fatima@sims.edu',
  role: 'faculty',
  sent: '10 Jun 2026',
  expires: '17 Jun 2026'
}, {
  id: 2,
  email: 'pradeep.r@sims.edu',
  role: 'faculty',
  sent: '09 Jun 2026',
  expires: '16 Jun 2026'
}, {
  id: 3,
  email: 'meera.admin@sims.edu',
  role: 'admin',
  sent: '04 Jun 2026',
  expires: '11 Jun 2026'
}];
const DEPT_OPTIONS = ['Pharmaceutics', 'Pharmacology', 'Clinical Pharmacy', 'Pharmacy Practice', 'Pharmaceutical Chemistry'];

// ── Shared helpers ───────────────────────────────────────────────────────────
const Divider = () => /*#__PURE__*/React.createElement("div", {
  style: {
    borderBottom: '1px solid var(--divider)'
  }
});
function FilterSelect({
  value,
  onChange,
  options,
  placeholder
}) {
  return /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      border: '1px solid var(--slate-200)',
      borderRadius: 8,
      padding: '7px 12px',
      fontSize: 13,
      color: 'var(--slate-700)',
      background: '#fff',
      outline: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label)));
}

// ── Row action menu ──────────────────────────────────────────────────────────
function RowMenu({
  user: u,
  onAction
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  if (u.role === 'super_admin') return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    },
    ref: ref
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(o => !o),
    style: {
      width: 28,
      height: 28,
      borderRadius: 6,
      border: 'none',
      background: 'none',
      color: 'var(--slate-400)',
      cursor: 'pointer',
      fontSize: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, "\xB7\xB7\xB7"), open && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 0,
      top: 32,
      zIndex: 20,
      background: '#fff',
      border: '1px solid var(--slate-200)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-dropdown)',
      minWidth: 150,
      padding: '4px 0'
    }
  }, u.status === 'active' && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setOpen(false);
      onAction('deactivate', u);
    },
    style: {
      width: '100%',
      textAlign: 'left',
      padding: '8px 14px',
      fontSize: 13,
      color: 'var(--red-text)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)'
    }
  }, "Deactivate"), u.status === 'pending_telegram' && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setOpen(false);
      onAction('regen', u);
    },
    style: {
      width: '100%',
      textAlign: 'left',
      padding: '8px 14px',
      fontSize: 13,
      color: 'var(--blue-700)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)'
    }
  }, "Regenerate invite"), u.status === 'inactive' && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setOpen(false);
      onAction('reactivate', u);
    },
    style: {
      width: '100%',
      textAlign: 'left',
      padding: '8px 14px',
      fontSize: 13,
      color: 'var(--emerald-text)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)'
    }
  }, "Reactivate"), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setOpen(false);
      onAction('delete', u);
    },
    style: {
      width: '100%',
      textAlign: 'left',
      padding: '8px 14px',
      fontSize: 13,
      color: 'var(--red-text)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)'
    }
  }, "Delete user")));
}

// ── Pending Invites section ──────────────────────────────────────────────────
function PendingInvitesSection({
  invites,
  onRegenerate,
  onCancel
}) {
  if (!invites.length) return null;
  const expired = inv => inv.id === 3; // mock: last one is "today" = just expired
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--slate-400)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    }
  }, "Pending Invites"), /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--amber-tint)',
      color: 'var(--amber-text)',
      fontSize: 10,
      fontWeight: 700,
      borderRadius: 8,
      padding: '2px 7px'
    }
  }, invites.length)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, "Links expire after 7 days \u2014 regenerate to extend")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--amber-bg)',
      border: '1px solid var(--amber-border)',
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
      gap: 0,
      padding: '8px 16px',
      borderBottom: '1px solid var(--amber-border)'
    }
  }, ['Email', 'Role', 'Sent', 'Expires', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--amber-text)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em'
    }
  }, h))), invites.map((inv, idx) => {
    const isExpired = expired(inv);
    return /*#__PURE__*/React.createElement("div", {
      key: inv.id,
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
        alignItems: 'center',
        gap: 0,
        padding: '10px 16px',
        borderBottom: idx < invites.length - 1 ? '1px solid var(--amber-border)' : 'none',
        background: isExpired ? 'rgba(254,202,202,0.2)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--text-primary)',
        fontWeight: 500
      }
    }, inv.email), /*#__PURE__*/React.createElement(Badge, {
      status: inv.role
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--text-secondary)'
      }
    }, inv.sent), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: isExpired ? 'var(--red-text)' : 'var(--text-secondary)',
        fontWeight: isExpired ? 600 : 400
      }
    }, isExpired ? '⚑ Expired' : inv.expires), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        justifyContent: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => onRegenerate(inv),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        borderRadius: 7,
        border: '1px solid var(--amber-border)',
        background: '#fff',
        color: 'var(--amber-text)',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "refresh",
      size: 11
    }), " Regenerate"), /*#__PURE__*/React.createElement("button", {
      onClick: () => onCancel(inv),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        borderRadius: 7,
        border: '1px solid var(--red-border)',
        background: '#fff',
        color: 'var(--red-text)',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)'
      }
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "x",
      size: 11
    }))));
  })));
}

// ── Create User Drawer — matches client/src/components/CreateUserDrawer.jsx ──
// Title: "Invite user", no telegram_id field, actorRole gates Admin role button,
// invite panel shows @SimsPharmacybot bot name + /start {token} command.
function CreateUserDrawer({
  open,
  onClose,
  actorRole = 'admin'
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'faculty',
    department: '',
    designation: '',
    phone: ''
  });
  const [inviteLink, setInviteLink] = useState(null);
  const [invitedName, setInvitedName] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = k => e => setForm(f => ({
    ...f,
    [k]: e.target.value
  }));
  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const token = 'invite_' + Math.random().toString(36).slice(2, 10);
      setInviteLink('https://t.me/SimsPharmacybot?start=' + token);
      setInvitedName(form.name);
    }, 700);
  }
  function resetAndClose() {
    setForm({
      name: '',
      email: '',
      role: 'faculty',
      department: '',
      designation: '',
      phone: ''
    });
    setInviteLink(null);
    setInvitedName('');
    setCopied(false);
    onClose();
  }
  function extractToken() {
    const m = inviteLink?.match(/[?&]start=([^&]+)/);
    return m ? m[1] : '';
  }
  function copyCommand() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(2px)',
      zIndex: 40
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      background: '#fff',
      borderRadius: '20px 20px 0 0',
      maxHeight: '92vh',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      maxWidth: 520,
      margin: '0 auto',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      background: '#e2e8f0',
      borderRadius: 2,
      margin: '12px auto 0',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px 12px',
      borderBottom: '1px solid #f1f5f9',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      color: '#0f172a'
    }
  }, inviteLink ? '✅ Invite created' : 'Invite user'), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 12,
      color: '#94a3b8'
    }
  }, inviteLink ? 'Share instructions with ' + invitedName : 'An invite link will be sent to their Telegram')), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: 32,
      height: 32,
      borderRadius: 10,
      border: '1px solid #e2e8f0',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: '#64748b',
      fontSize: 16
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, inviteLink ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 700,
      color: '#0f172a',
      marginBottom: 4
    }
  }, "\u2705 Invite created"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      color: '#64748b'
    }
  }, "Share instructions with ", invitedName)), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#f0f9ff',
      border: '1.5px solid #bfdbfe',
      borderRadius: 12,
      padding: 12,
      fontSize: 12,
      color: '#1e40af',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontWeight: 700,
      margin: '0 0 8px'
    }
  }, "\uD83D\uDCCB Instructions:"), /*#__PURE__*/React.createElement("ol", {
    style: {
      margin: 0,
      paddingLeft: 18
    }
  }, /*#__PURE__*/React.createElement("li", null, "Open Telegram and search for ", /*#__PURE__*/React.createElement("strong", null, "@SimsPharmacybot")), /*#__PURE__*/React.createElement("li", null, "Tap \"Start\" when you open the bot"), /*#__PURE__*/React.createElement("li", null, "Copy and send this exact message:"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#f8fafc',
      border: '1.5px solid #cbd5e1',
      borderRadius: 10,
      padding: 10,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: '#64748b',
      margin: '0 0 6px'
    }
  }, "Bot Username"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: '#0f172a',
      fontFamily: 'var(--font-mono)',
      margin: 0
    }
  }, "@SimsPharmacybot")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#f8fafc',
      border: '1.5px solid #e2e8f0',
      borderRadius: 10,
      padding: 12,
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      fontWeight: 600,
      color: '#0f172a',
      wordBreak: 'break-all'
    }
  }, "/start ", extractToken()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: copyCommand,
    style: {
      height: 44,
      borderRadius: 10,
      border: '1.5px solid #3b82f6',
      background: copied ? '#f0fdf4' : '#eff6ff',
      color: copied ? '#065f46' : '#2563eb',
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)'
    }
  }, copied ? '✅ Copied!' : '📋 Copy command'), /*#__PURE__*/React.createElement("a", {
    href: inviteLink,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: 10,
      border: 'none',
      background: '#0088cc',
      color: '#fff',
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
      textDecoration: 'none'
    }
  }, "\uD83D\uDD17 Open Telegram"), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 44,
      borderRadius: 10,
      border: 'none',
      background: '#25d366',
      color: '#fff',
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)'
    }
  }, "\uD83D\uDCAC Share WhatsApp")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: '#94a3b8',
      textAlign: 'center',
      lineHeight: 1.5,
      margin: 0
    }
  }, "Link expires in 7 days.", /*#__PURE__*/React.createElement("br", null), "If issues with deep links, use the command method above.")) : /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    style: {
      padding: '16px 20px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Identity"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(DrawerField, {
    label: "Full name"
  }, /*#__PURE__*/React.createElement(DrawerInput, {
    placeholder: "Dr. Priya Sharma",
    value: form.name,
    onChange: set('name'),
    required: true
  })), /*#__PURE__*/React.createElement(DrawerField, {
    label: "Email"
  }, /*#__PURE__*/React.createElement(DrawerInput, {
    type: "email",
    placeholder: "priya@sims.edu.in",
    value: form.email,
    onChange: set('email'),
    required: true
  }))), /*#__PURE__*/React.createElement(SectionLabel, null, "Role"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(RoleBtn, {
    label: "Faculty",
    subtitle: "Records violations",
    selected: form.role === 'faculty',
    onClick: () => setForm(f => ({
      ...f,
      role: 'faculty'
    }))
  }), actorRole === 'super_admin' && /*#__PURE__*/React.createElement(RoleBtn, {
    label: "Admin",
    subtitle: "Manages system",
    selected: form.role === 'admin',
    onClick: () => setForm(f => ({
      ...f,
      role: 'admin'
    }))
  })), /*#__PURE__*/React.createElement(SectionLabel, null, "Department"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(DrawerField, {
    label: "Department"
  }, /*#__PURE__*/React.createElement(DrawerInput, {
    placeholder: "Pharmacology",
    value: form.department,
    onChange: set('department')
  })), /*#__PURE__*/React.createElement(DrawerField, {
    label: "Designation"
  }, /*#__PURE__*/React.createElement(DrawerInput, {
    placeholder: "Assistant Professor",
    value: form.designation,
    onChange: set('designation')
  }))), /*#__PURE__*/React.createElement(SectionLabel, null, "Contact"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(DrawerField, {
    label: "Phone"
  }, /*#__PURE__*/React.createElement(DrawerInput, {
    type: "tel",
    placeholder: "+91 98765 43210",
    value: form.phone,
    onChange: set('phone')
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 20px',
      borderTop: '1px solid #f1f5f9',
      display: 'flex',
      gap: 10,
      flexShrink: 0,
      background: '#fff',
      justifyContent: inviteLink ? 'center' : 'flex-start',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))'
    }
  }, inviteLink ? /*#__PURE__*/React.createElement("button", {
    onClick: resetAndClose,
    style: {
      flex: 1,
      maxWidth: 200,
      height: 48,
      borderRadius: 14,
      border: 'none',
      background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
      fontSize: 14,
      fontWeight: 700,
      color: '#fff',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)'
    }
  }, "Done") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    style: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      border: '1.5px solid #e2e8f0',
      background: '#f8fafc',
      fontSize: 14,
      fontWeight: 700,
      color: '#475569',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)'
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: handleSubmit,
    disabled: loading || !form.name.trim() || !form.email.trim(),
    style: {
      flex: 2,
      height: 48,
      borderRadius: 14,
      border: 'none',
      background: !form.name.trim() || !form.email.trim() ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #4f46e5)',
      fontSize: 14,
      fontWeight: 700,
      color: '#fff',
      cursor: loading ? 'wait' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontFamily: 'var(--font-sans)'
    }
  }, loading && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      border: '2px solid rgba(255,255,255,.4)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'simsdms-spin .6s linear infinite'
    }
  }), loading ? 'Sending...' : 'Send Invite')))));
}

// Tiny drawer helpers
function SectionLabel({
  children
}) {
  return /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 10px',
      fontSize: 10,
      fontWeight: 800,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.12em'
    }
  }, children);
}
function RoleBtn({
  label,
  subtitle,
  selected,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    style: {
      flex: 1,
      padding: '10px 8px',
      borderRadius: 12,
      border: `1.5px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
      background: selected ? '#eff6ff' : '#f8fafc',
      cursor: 'pointer',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 700,
      color: selected ? '#2563eb' : '#475569',
      marginBottom: 1
    }
  }, label), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: selected ? '#60a5fa' : '#94a3b8'
    }
  }, subtitle));
}
function DrawerField({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--slate-500)',
      letterSpacing: '0.08em',
      marginBottom: 5,
      textTransform: 'uppercase'
    }
  }, label), children);
}
function DrawerInput({
  ...props
}) {
  const [f, setF] = useState(false);
  return /*#__PURE__*/React.createElement("input", _extends({
    onFocus: () => setF(true),
    onBlur: () => setF(false),
    style: {
      width: '100%',
      height: 44,
      padding: '0 14px',
      borderRadius: 12,
      border: `1.5px solid ${f ? 'var(--blue-500)' : 'var(--border)'}`,
      background: f ? '#fff' : 'var(--surface-page)',
      fontSize: 14,
      color: 'var(--text-primary)',
      outline: 'none',
      boxSizing: 'border-box',
      fontFamily: 'var(--font-sans)',
      boxShadow: f ? '0 0 0 3px var(--brand-ring)' : 'none',
      transition: 'all var(--dur-fast)'
    }
  }, props));
}

// ── Users Page ────────────────────────────────────────────────────────────────
function UsersPage() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [invites, setInvites] = useState(MOCK_INVITES);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);
  function showToast(msg, type = 'success') {
    setToast({
      msg,
      type
    });
    setTimeout(() => setToast(null), 3000);
  }
  function handleAction(action, user) {
    if (action === 'deactivate') {
      setUsers(us => us.map(u => u.id === user.id ? {
        ...u,
        status: 'inactive'
      } : u));
      showToast(`${user.name} deactivated.`);
    }
    if (action === 'reactivate') {
      setUsers(us => us.map(u => u.id === user.id ? {
        ...u,
        status: 'active'
      } : u));
      showToast(`${user.name} reactivated.`);
    }
    if (action === 'regen') showToast('Invite link regenerated. Share with user.');
    if (action === 'delete') {
      setUsers(us => us.filter(u => u.id !== user.id));
      showToast(`${user.name} deleted.`, 'error');
    }
  }
  const filtered = users.filter(u => (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search)) && (!roleFilter || u.role === roleFilter) && (!statusFilter || u.status === statusFilter));
  return /*#__PURE__*/React.createElement(React.Fragment, null, toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      top: 20,
      right: 28,
      zIndex: 99,
      background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
      border: `1px solid ${toast.type === 'error' ? 'var(--red-border)' : 'var(--emerald-border)'}`,
      borderRadius: 12,
      padding: '10px 16px',
      fontSize: 13,
      fontWeight: 600,
      color: toast.type === 'error' ? 'var(--red-text)' : 'var(--emerald-text)',
      boxShadow: 'var(--shadow-toast)'
    }
  }, toast.type === 'error' ? '⚑ ' : '✅ ', toast.msg), users.some(u => u.status === 'pending_telegram') && /*#__PURE__*/React.createElement(Alert, {
    tone: "warning",
    icon: "\u23F3",
    title: `${users.filter(u => u.status === 'pending_telegram').length} account awaiting Telegram activation`,
    action: /*#__PURE__*/React.createElement("button", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--amber-text)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap'
      }
    }, "Regenerate invite \u2192"),
    style: {
      marginBottom: 14
    }
  }, "These users need to tap their Telegram invite link before they can sign in."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Total users",
    value: users.length,
    accent: "blue",
    icon: "\uD83D\uDC65"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Active",
    value: users.filter(u => u.status === 'active').length,
    accent: "green",
    icon: "\u2705"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Awaiting",
    value: users.filter(u => u.status === 'pending_telegram').length,
    accent: "yellow",
    icon: "\u23F3"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Pending invites",
    value: invites.length,
    accent: invites.length ? 'yellow' : 'default',
    icon: "\u2709\uFE0F"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginBottom: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 200,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--slate-400)'
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "search",
    size: 13
  })), /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Search by name or email\u2026",
    style: {
      width: '100%',
      paddingLeft: 32,
      paddingRight: 12,
      height: 36,
      borderRadius: 8,
      border: '1px solid var(--slate-200)',
      fontSize: 13,
      color: 'var(--text-primary)',
      outline: 'none',
      boxSizing: 'border-box',
      fontFamily: 'var(--font-sans)'
    }
  })), /*#__PURE__*/React.createElement(FilterSelect, {
    value: roleFilter,
    onChange: setRoleFilter,
    placeholder: "All roles",
    options: [{
      value: 'faculty',
      label: 'Faculty'
    }, {
      value: 'admin',
      label: 'Admin'
    }, {
      value: 'super_admin',
      label: 'Super Admin'
    }]
  }), /*#__PURE__*/React.createElement(FilterSelect, {
    value: statusFilter,
    onChange: setStatusFilter,
    placeholder: "All statuses",
    options: [{
      value: 'active',
      label: 'Active'
    }, {
      value: 'inactive',
      label: 'Inactive'
    }, {
      value: 'pending_telegram',
      label: 'Awaiting Telegram'
    }]
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowCreate(true),
    style: {
      height: 36,
      padding: '0 16px',
      borderRadius: 8,
      border: 'none',
      background: '#2563eb',
      color: '#fff',
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap'
    }
  }, "+ Invite user")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 36px',
      padding: '9px 16px',
      background: 'var(--surface-page)',
      borderBottom: '1px solid var(--border)'
    }
  }, ['Name', 'Role', 'Department', 'Telegram ID', 'Status', ''].map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em'
    }
  }, h))), filtered.map((u, idx) => /*#__PURE__*/React.createElement("div", {
    key: u.id,
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 36px',
      alignItems: 'center',
      padding: '10px 16px',
      borderBottom: idx < filtered.length - 1 ? '1px solid var(--divider)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, u.name), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, u.email)), /*#__PURE__*/React.createElement(Badge, {
    status: u.role,
    label: u.role.replace(/_/g, ' ')
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, u.dept), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: u.telegram_id ? 'var(--slate-600)' : 'var(--slate-300)'
    }
  }, u.telegram_id ?? '—'), /*#__PURE__*/React.createElement(Badge, {
    status: u.status
  }), /*#__PURE__*/React.createElement(RowMenu, {
    user: u,
    onAction: handleAction
  }))), !filtered.length && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '32px 16px',
      textAlign: 'center',
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "No users match this filter.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: '10px 14px',
      background: 'var(--surface-page)',
      borderRadius: 10,
      border: '1px solid var(--border)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, "Total users in system"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--text-primary)'
    }
  }, users.length)), /*#__PURE__*/React.createElement(PendingInvitesSection, {
    invites: invites,
    onRegenerate: inv => {
      showToast(`Invite regenerated for ${inv.email}. Share new link.`);
    },
    onCancel: inv => {
      setInvites(is => is.filter(i => i.id !== inv.id));
      showToast(`Invite for ${inv.email} cancelled.`, 'error');
    }
  }), /*#__PURE__*/React.createElement(CreateUserDrawer, {
    open: showCreate,
    onClose: () => setShowCreate(false),
    actorRole: "super_admin"
  }));
}
Object.assign(window, {
  UsersPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin-desktop/AdminScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin-desktop/AdminShell.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* ──────────────────────────────────────────────────────────────
   Admin Desktop UI kit — shell: sidebar layout + inline SVG icons
   Mirrors the product's Layout.jsx / Sidebar.jsx desktop surface
   ────────────────────────────────────────────────────────────── */

// ── Minimal inline SVG icon set (Lucide stroke style, size=15 default) ──────
function Icon({
  d,
  d2,
  circle,
  size = 15,
  strokeWidth = 2
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0
    }
  }, circle && /*#__PURE__*/React.createElement("circle", {
    cx: circle[0],
    cy: circle[1],
    r: circle[2]
  }), /*#__PURE__*/React.createElement("path", {
    d: d
  }), d2 && /*#__PURE__*/React.createElement("path", {
    d: d2
  }));
}
const ICONS = {
  dashboard: {
    d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    d2: 'M9 22V12h6v10'
  },
  users: {
    d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    circle: [9, 7, 4]
  },
  students: {
    d: 'M22 10v6M2 10l10-5 10 5-10 5z',
    d2: 'M6 12v5c3 3 9 3 12 0v-5'
  },
  calendar: {
    d: 'M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zm0 6h18',
    d2: 'M16 2v4M8 2v4'
  },
  clipboard: {
    d: 'M9 11l3 3 8-8',
    d2: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'
  },
  alert: {
    d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01'
  },
  tag: {
    d: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01'
  },
  swap: {
    d: 'M21 9H3m0 0 4 4m-4-4 4-4M3 15h18m0 0-4 4m4-4-4-4'
  },
  mail: {
    d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6'
  },
  chart: {
    d: 'M18 20V10M12 20V4M6 20v-6'
  },
  logout: {
    d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'
  },
  search: {
    d: 'M21 21l-4.35-4.35',
    circle: [11, 11, 8]
  },
  x: {
    d: 'M18 6 6 18M6 6l12 12'
  },
  copy: {
    d: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2',
    d2: 'M8 2h8v4H8z'
  },
  refresh: {
    d: 'M23 4v6h-6M1 20v-6h6',
    d2: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'
  },
  trash: {
    d: 'M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6',
    d2: 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'
  },
  chevronDown: {
    d: 'M6 9l6 6 6-6'
  },
  check: {
    d: 'M20 6L9 17l-5-5'
  }
};
function Ic({
  name,
  size,
  strokeWidth
}) {
  const ic = ICONS[name] ?? ICONS.x;
  return /*#__PURE__*/React.createElement(Icon, _extends({}, ic, {
    size: size,
    strokeWidth: strokeWidth
  }));
}

// ── Nav ─────────────────────────────────────────────────────────────────────
const NAV = [{
  key: 'dashboard',
  label: 'Dashboard',
  icon: 'dashboard'
}, {
  key: 'users',
  label: 'Users',
  icon: 'users'
}, {
  key: 'students',
  label: 'Students',
  icon: 'students'
}, {
  key: 'duties',
  label: 'Duties',
  icon: 'calendar'
}, {
  key: 'attendance',
  label: 'Attendance',
  icon: 'clipboard'
}, {
  key: 'violations',
  label: 'Violations',
  icon: 'alert'
}, {
  key: 'types',
  label: 'Types',
  icon: 'tag'
}, {
  key: 'cover',
  label: 'Cover Shifts',
  icon: 'swap'
}, {
  key: 'messages',
  label: 'Messages',
  icon: 'mail'
}, {
  key: 'reports',
  label: 'Reports',
  icon: 'chart'
}];
function SidebarItem({
  icon,
  label,
  active,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '7px 10px',
      borderRadius: 8,
      border: 'none',
      background: active ? 'rgba(59,130,246,0.15)' : hover ? 'rgba(255,255,255,0.05)' : 'none',
      color: active ? 'var(--blue-400)' : 'var(--slate-400)',
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left',
      transition: 'all var(--dur-fast)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: icon,
    size: 14
  }), label);
}
function Sidebar({
  active,
  onNav
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220,
      flexShrink: 0,
      background: 'var(--surface-sidebar)',
      borderRight: '1px solid var(--slate-800)',
      display: 'flex',
      flexDirection: 'column',
      padding: '14px 12px',
      height: '100%',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '4px 4px 16px',
      borderBottom: '1px solid var(--slate-800)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 9,
      background: 'var(--brand-gradient)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 16,
      flexShrink: 0
    }
  }, "\uD83C\uDF93"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: '#f1f5f9',
      lineHeight: 1.2
    }
  }, "SIMS DMS"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--slate-500)',
      marginTop: 1
    }
  }, "College of Pharmacy"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flex: 1
    }
  }, NAV.map(n => /*#__PURE__*/React.createElement(SidebarItem, {
    key: n.key,
    icon: n.icon,
    label: n.label,
    active: active === n.key,
    onClick: () => onNav(n.key)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--slate-800)',
      paddingTop: 12,
      marginTop: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: '#1e3a5f',
      border: '1px solid var(--blue-600)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--blue-400)',
      flexShrink: 0
    }
  }, "JK"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--slate-200)',
      lineHeight: 1.2
    }
  }, "Joseph K"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--slate-500)'
    }
  }, "Super Admin"))), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--slate-500)',
      cursor: 'pointer',
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "logout",
    size: 14
  }))));
}

// ── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({
  title,
  subtitle,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 28px 12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface-card)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--text-primary)',
      lineHeight: 1.2
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, subtitle)), action);
}

// ── Desktop frame ────────────────────────────────────────────────────────────
function AdminShell({
  activeNav,
  onNav,
  title,
  subtitle,
  headerAction,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1280,
      height: 720,
      display: 'flex',
      overflow: 'hidden',
      background: 'var(--surface-page)',
      fontFamily: 'var(--font-sans)',
      borderRadius: 12,
      boxShadow: '0 30px 80px -20px rgba(15,23,42,0.5)',
      border: '1px solid var(--slate-800)'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    active: activeNav,
    onNav: onNav
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    title: title,
    subtitle: subtitle,
    action: headerAction
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      background: 'var(--surface-page)',
      padding: '20px 28px'
    }
  }, children)));
}
Object.assign(window, {
  AdminShell,
  Ic,
  ICONS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin-desktop/AdminShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/faculty-pwa/screens.jsx
try { (() => {
/* ───────────────────────────────────────────────────────────────
   Faculty PWA UI kit — screens
   Composes DS components (Button, Badge, StatCard, Alert, …) with
   the phone shell. Recreates: Login (OTP), Dashboard, Slots,
   Attendance check-in/out, Violation recorder, Messages.
   ─────────────────────────────────────────────────────────────── */
const {
  useState
} = React;
const DS = window.SIMSDMSDesignSystem_019e12;
const {
  Button,
  Badge,
  StatCard,
  Alert,
  Input,
  BrandMark,
  MobileCard,
  SectionHeader,
  EmptyState
} = DS;

// ── LOGIN ───────────────────────────────────────────────────────
function LoginScreen({
  onAuth
}) {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('priya.sharma@sims.edu');
  const [otp, setOtp] = useState('');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--slate-900)',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -80,
      right: -80,
      width: 260,
      height: 260,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '0 0 auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '32px 24px 28px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(BrandMark, {
    size: "lg",
    glow: true
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--blue-500)',
      textTransform: 'uppercase',
      letterSpacing: '0.15em',
      marginBottom: 8
    }
  }, "SIMS College of Pharmacy"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 25,
      fontWeight: 800,
      color: '#f8fafc',
      lineHeight: 1.25,
      marginBottom: 12
    }
  }, "Discipline Management System"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: 'var(--slate-500)',
      maxWidth: 260
    }
  }, "Faculty duty scheduling and student violation tracking")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: '#fff',
      borderRadius: '28px 28px 0 0',
      padding: '26px 24px',
      boxShadow: 'var(--shadow-sheet)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 4,
      background: 'var(--slate-200)',
      borderRadius: 2,
      margin: '0 auto 22px'
    }
  }), step === 'request' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 22,
      fontWeight: 800,
      color: 'var(--text-primary)'
    }
  }, "Sign in"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, "Enter your email address to receive your OTP")), /*#__PURE__*/React.createElement(Input, {
    label: "Email Address",
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value)
  }), /*#__PURE__*/React.createElement(Alert, {
    tone: "info",
    icon: "\u2708\uFE0F"
  }, "OTP sent via ", /*#__PURE__*/React.createElement("strong", null, "@SIMSDMSBOT"), " Telegram bot. Make sure you have started the bot."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    style: {
      width: '100%'
    },
    onClick: () => setStep('verify')
  }, "Send OTP \u2192")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 22,
      fontWeight: 800,
      color: 'var(--text-primary)'
    }
  }, "Enter OTP"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, "Check your Telegram for a 6-digit code")), /*#__PURE__*/React.createElement(OtpBoxes, {
    value: otp,
    onChange: setOtp
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "Expires in ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--slate-500)'
    }
  }, "04:52")), /*#__PURE__*/React.createElement("button", {
    style: {
      color: 'var(--brand)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 13
    }
  }, "Resend OTP")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    style: {
      width: '100%'
    },
    disabled: otp.length < 6,
    onClick: onAuth
  }, "Verify & Sign in \u2192"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep('request'),
    style: {
      fontSize: 13,
      color: 'var(--text-muted)',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    }
  }, "\u2190 Use a different email")), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: 'var(--slate-300)',
      marginTop: 26
    }
  }, "SIMS DMS \xB7 Version 1.0")));
}
function OtpBoxes({
  value,
  onChange
}) {
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'center'
    }
  }, digits.map((d, i) => /*#__PURE__*/React.createElement("input", {
    key: i,
    inputMode: "numeric",
    maxLength: 1,
    value: d,
    onChange: e => {
      const c = e.target.value.replace(/\D/g, '').slice(-1);
      const arr = digits.slice();
      arr[i] = c;
      onChange(arr.join('').slice(0, 6));
      if (c && e.target.nextSibling) e.target.nextSibling.focus();
    },
    style: {
      width: 44,
      height: 52,
      textAlign: 'center',
      fontSize: 18,
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      border: '1px solid var(--slate-200)',
      borderRadius: 10,
      outline: 'none',
      color: 'var(--text-primary)'
    }
  })));
}

// ── DASHBOARD ───────────────────────────────────────────────────
function DashboardScreen({
  go
}) {
  const unread = MOCK.messages.filter(m => !m.read).length;
  return /*#__PURE__*/React.createElement(PageBody, {
    header: /*#__PURE__*/React.createElement(MobilePageHeader, {
      title: "Welcome, Priya",
      subtitle: "Thursday, 13 March 2025"
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      borderRadius: 16,
      padding: 16,
      background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
      border: '1px solid var(--blue-200)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--blue-800)'
    }
  }, "You have duty today"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 12,
      color: 'var(--blue-500)',
      textTransform: 'capitalize'
    }
  }, "Morning session")), /*#__PURE__*/React.createElement(Badge, {
    status: "scheduled"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCCB"),
    onClick: () => go('attendance')
  }, "Check In / Out"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement("span", null, "\u26A0\uFE0F"),
    onClick: () => go('violations')
  }, "Record Violation"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Alert, {
    tone: "warning",
    icon: "\uD83D\uDD04",
    title: "1 open cover request \u2014 awaiting a volunteer",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      onClick: () => go('slots')
    }, "View \u2192")
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 12,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Slots",
    value: 4,
    accent: "blue",
    icon: "\uD83D\uDDD3"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Logged",
    value: 7,
    accent: "default",
    icon: "\u26A0\uFE0F"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Unread",
    value: unread,
    accent: unread ? 'yellow' : 'default',
    icon: "\u2709\uFE0F"
  })), /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Upcoming duties"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }
  }, MOCK.upcoming.map(s => /*#__PURE__*/React.createElement(MobileCard, {
    key: s.id,
    primary: `${s.date} · ${s.session}`,
    badge: /*#__PURE__*/React.createElement(Badge, {
      status: s.status
    }),
    showChevron: false
  }))), /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Recent messages",
    action: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        background: 'var(--blue-100)',
        color: 'var(--blue-600)',
        borderRadius: 8,
        padding: '2px 6px',
        fontWeight: 700
      }
    }, unread, " unread")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }
  }, MOCK.messages.map(m => /*#__PURE__*/React.createElement(MobileCard, {
    key: m.id,
    primary: m.subject,
    secondary: m.read ? 'Read' : 'New',
    onClick: () => go('messages'),
    badge: !m.read ? /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--blue-500)'
      }
    }) : null,
    showChevron: false
  }))));
}

// ── SLOTS ───────────────────────────────────────────────────────
function SlotsScreen() {
  return /*#__PURE__*/React.createElement(PageBody, {
    header: /*#__PURE__*/React.createElement(MobilePageHeader, {
      title: "My Slots",
      subtitle: "March 2025 \xB7 4 of 4 picked"
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Picked",
    value: 4,
    accent: "blue"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Required",
    value: 4,
    accent: "green",
    sub: "Complete"
  })), /*#__PURE__*/React.createElement(SectionHeader, {
    title: "This month"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(MobileCard, {
    primary: "13 Mar \xB7 Morning",
    secondary: "Today",
    badge: /*#__PURE__*/React.createElement(Badge, {
      status: "scheduled"
    }),
    showChevron: false
  }), MOCK.upcoming.map(s => /*#__PURE__*/React.createElement(MobileCard, {
    key: s.id,
    primary: `${s.date} · ${s.session}`,
    badge: /*#__PURE__*/React.createElement(Badge, {
      status: s.status
    }),
    action: s.status === 'cover_pending' ? /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "xs"
    }, "Cover") : null,
    showChevron: false
  }))), /*#__PURE__*/React.createElement(SectionHeader, {
    title: "Need a swap?"
  }), /*#__PURE__*/React.createElement(Alert, {
    tone: "info",
    icon: "\uD83D\uDD04",
    title: "Request cover for a slot"
  }, "Broadcast to all faculty \u2014 a volunteer picks it up, an admin confirms."));
}

// ── ATTENDANCE ──────────────────────────────────────────────────
function AttendanceScreen() {
  const [state, setState] = useState('out'); // out → in → done
  return /*#__PURE__*/React.createElement(PageBody, {
    header: /*#__PURE__*/React.createElement(MobilePageHeader, {
      title: "Attendance",
      subtitle: "Morning session \xB7 13 March"
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--border)',
      padding: 20,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 44,
      marginBottom: 8
    }
  }, state === 'done' ? '✅' : '🕘'), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--text-primary)'
    }
  }, state === 'out' ? 'Not checked in' : state === 'in' ? 'Checked in' : 'Duty complete'), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 16px',
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, state === 'out' ? 'Window: 9:00 – 9:15 AM' : state === 'in' ? 'In at 9:08 AM · On time' : 'In 9:08 · Out 1:02 PM'), state === 'out' && /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    style: {
      width: '100%'
    },
    onClick: () => setState('in')
  }, "Check In"), state === 'in' && /*#__PURE__*/React.createElement(Button, {
    variant: "success",
    size: "lg",
    style: {
      width: '100%'
    },
    onClick: () => setState('done')
  }, "Check Out"), state === 'done' && /*#__PURE__*/React.createElement(Badge, {
    status: "completed"
  })), state === 'in' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Alert, {
    tone: "success",
    icon: "\u2705",
    title: "Checked in on time"
  }, "Auto check-out runs at 4:30 PM if you forget.")), /*#__PURE__*/React.createElement(SectionHeader, {
    title: "This week"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(MobileCard, {
    primary: "11 Mar \xB7 Morning",
    secondary: "In 9:05 \xB7 Out 1:00",
    badge: /*#__PURE__*/React.createElement(Badge, {
      status: "completed"
    }),
    showChevron: false
  }), /*#__PURE__*/React.createElement(MobileCard, {
    primary: "07 Mar \xB7 Afternoon",
    secondary: "In 1:22 \xB7 Late",
    badge: /*#__PURE__*/React.createElement(Badge, {
      status: "late"
    }),
    showChevron: false
  })));
}

// ── VIOLATIONS (recorder) ───────────────────────────────────────
function ViolationsScreen() {
  const [student, setStudent] = useState(null);
  const [type, setType] = useState(null);
  const [done, setDone] = useState(false);
  if (done) {
    return /*#__PURE__*/React.createElement(PageBody, {
      header: /*#__PURE__*/React.createElement(MobilePageHeader, {
        title: "Record Violation"
      })
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 20
      }
    }, /*#__PURE__*/React.createElement(EmptyState, {
      emoji: "\u2705",
      title: "Violation recorded",
      subtitle: `${student.name} · ${type.name}${type.fine ? ` · ₹${type.fine} fine` : ''}`,
      action: /*#__PURE__*/React.createElement(Button, {
        variant: "secondary",
        onClick: () => {
          setDone(false);
          setStudent(null);
          setType(null);
        }
      }, "Record another")
    })));
  }
  return /*#__PURE__*/React.createElement(PageBody, {
    header: /*#__PURE__*/React.createElement(MobilePageHeader, {
      title: "Record Violation",
      subtitle: "Morning session \xB7 13 March"
    })
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "1 \xB7 Select student"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }
  }, MOCK.students.map(s => /*#__PURE__*/React.createElement(MobileCard, {
    key: s.id,
    primary: s.name,
    secondary: `${s.reg} · ${s.course}`,
    onClick: () => setStudent(s),
    badge: student?.id === s.id ? /*#__PURE__*/React.createElement(Badge, {
      status: "checked_in",
      label: "Selected"
    }) : null,
    showChevron: student?.id !== s.id
  }))), student && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHeader, {
    title: "2 \xB7 Violation type"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8
    }
  }, MOCK.violationTypes.map(v => {
    const on = type?.id === v.id;
    return /*#__PURE__*/React.createElement("button", {
      key: v.id,
      onClick: () => setType(v),
      style: {
        border: `1px solid ${on ? 'var(--blue-500)' : 'var(--slate-200)'}`,
        background: on ? 'var(--blue-50)' : '#fff',
        color: on ? 'var(--blue-700)' : 'var(--slate-700)',
        borderRadius: 9999,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)'
      }
    }, v.name, v.fine ? ` · ₹${v.fine}` : '');
  }))), student && type && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    style: {
      width: '100%'
    },
    onClick: () => setDone(true)
  }, "Log violation", type.fine ? ` · ₹${type.fine} fine` : ' · warning')));
}

// ── MESSAGES ────────────────────────────────────────────────────
function MessagesScreen() {
  return /*#__PURE__*/React.createElement(PageBody, {
    header: /*#__PURE__*/React.createElement(MobilePageHeader, {
      title: "Messages",
      subtitle: "2 unread"
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }
  }, MOCK.messages.map(m => /*#__PURE__*/React.createElement(MobileCard, {
    key: m.id,
    primary: m.subject,
    secondary: m.read ? 'Admin · Read' : 'Admin · New',
    onClick: () => {},
    badge: !m.read ? /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--blue-500)'
      }
    }) : null
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement("span", null, "\u270F\uFE0F"),
    style: {
      width: '100%'
    }
  }, "Compose message")));
}
Object.assign(window, {
  LoginScreen,
  DashboardScreen,
  SlotsScreen,
  AttendanceScreen,
  ViolationsScreen,
  MessagesScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/faculty-pwa/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/faculty-pwa/shell.jsx
try { (() => {
/* ───────────────────────────────────────────────────────────────
   Faculty PWA UI kit — phone shell, bottom tab bar, mock data
   ─────────────────────────────────────────────────────────────── */

// ── Mock data ───────────────────────────────────────────────────
const MOCK = {
  user: {
    name: 'Priya Sharma',
    role: 'faculty',
    dept: 'Pharmaceutics'
  },
  todaySlot: {
    session_type: 'morning',
    status: 'scheduled'
  },
  upcoming: [{
    id: 1,
    date: '14 Mar',
    session: 'afternoon',
    status: 'scheduled'
  }, {
    id: 2,
    date: '19 Mar',
    session: 'morning',
    status: 'scheduled'
  }, {
    id: 3,
    date: '26 Mar',
    session: 'morning',
    status: 'cover_pending'
  }],
  messages: [{
    id: 1,
    subject: 'Scheduling window opens tomorrow',
    read: false
  }, {
    id: 2,
    subject: 'Reminder: check-in by 9:15 AM',
    read: false
  }, {
    id: 3,
    subject: 'March duty roster published',
    read: true
  }],
  students: [{
    id: 1,
    reg: 'SIMS-2024-018',
    name: 'Rahul Menon',
    course: 'B.Pharm · 2nd yr'
  }, {
    id: 2,
    reg: 'SIMS-2024-042',
    name: 'Sneha Pillai',
    course: 'B.Pharm · 1st yr'
  }, {
    id: 3,
    reg: 'SIMS-2023-007',
    name: 'Arjun Das',
    course: 'D.Pharm · 2nd yr'
  }, {
    id: 4,
    reg: 'SIMS-2024-090',
    name: 'Fatima Noor',
    course: 'B.Pharm · 3rd yr'
  }],
  violationTypes: [{
    id: 1,
    name: 'Late to class',
    fine: 50
  }, {
    id: 2,
    name: 'Improper uniform',
    fine: 100
  }, {
    id: 3,
    name: 'Mobile phone use',
    fine: 200
  }, {
    id: 4,
    name: 'Missing ID card',
    fine: 50
  }, {
    id: 5,
    name: 'Misconduct',
    fine: 0
  }]
};

// ── Status bar (iOS-style) ──────────────────────────────────────
function StatusBar({
  dark
}) {
  const color = dark ? '#f8fafc' : '#0f172a';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 22px 0 26px',
      flexShrink: 0,
      color,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: '0.02em'
    }
  }, "9:41"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12
    }
  }, "\u25CF\u25CF\u25CF"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, "\uD83D\uDCF6"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, "\uD83D\uDD0B")));
}

// ── Phone frame ─────────────────────────────────────────────────
function PhoneFrame({
  children,
  statusDark
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 390,
      height: 760,
      background: '#fff',
      borderRadius: 44,
      border: '11px solid #0b1120',
      boxShadow: '0 30px 80px -20px rgba(15,23,42,0.5)',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(StatusBar, {
    dark: statusDark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }
  }, children));
}

// ── Bottom tab bar (matches Sidebar.jsx mobile nav) ─────────────
const TABS = [{
  key: 'dashboard',
  label: 'Dashboard',
  emoji: '📊'
}, {
  key: 'slots',
  label: 'My Slots',
  emoji: '📆'
}, {
  key: 'attendance',
  label: 'Attendance',
  emoji: '✅'
}, {
  key: 'violations',
  label: 'Violations',
  emoji: '⚠️'
}, {
  key: 'messages',
  label: 'Messages',
  emoji: '✉️'
}];
function BottomTabBar({
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      height: 60,
      background: 'var(--slate-900)',
      borderTop: '1px solid var(--slate-800)',
      flexShrink: 0
    }
  }, TABS.map(t => {
    const on = active === t.key;
    return /*#__PURE__*/React.createElement("button", {
      key: t.key,
      onClick: () => onChange(t.key),
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        background: 'none',
        border: 'none',
        borderTop: on ? '2px solid var(--blue-500)' : '2px solid transparent',
        color: on ? 'var(--blue-400)' : 'var(--slate-500)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 8,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        transition: 'color 0.15s'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18
      }
    }, t.emoji), /*#__PURE__*/React.createElement("span", null, t.label.split(' ')[0]));
  }));
}

// ── Scrollable page body with the product's mobile padding ──────
function PageBody({
  children,
  header
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      background: 'var(--surface-page)'
    }
  }, header, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 24px'
    }
  }, children));
}
function MobilePageHeader({
  title,
  subtitle
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px 12px',
      background: 'var(--surface-page)',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--text-primary)',
      lineHeight: 1.2
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, subtitle));
}
Object.assign(window, {
  MOCK,
  PhoneFrame,
  BottomTabBar,
  PageBody,
  MobilePageHeader,
  StatusBar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/faculty-pwa/shell.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardBody = __ds_scope.CardBody;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Th = __ds_scope.Th;

__ds_ns.Td = __ds_scope.Td;

__ds_ns.Tr = __ds_scope.Tr;

__ds_ns.EmptyRow = __ds_scope.EmptyRow;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.BrandMark = __ds_scope.BrandMark;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.MobileCard = __ds_scope.MobileCard;

__ds_ns.SectionHeader = __ds_scope.SectionHeader;

})();
