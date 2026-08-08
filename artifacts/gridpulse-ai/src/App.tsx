import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BatteryCharging, Bot, BrainCircuit,
  ChevronDown, ChevronRight, CircleHelp, Cpu, Gauge, Grid2X2, Leaf, Menu, Network,
  PanelLeftClose, PanelLeftOpen, Play, Radio, RefreshCw, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Sun, TrendingUp, TriangleAlert, Wind, X, Zap
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  getGetAgentDecisionsQueryKey, getGetGridHistoryQueryKey, getGetGridStateQueryKey,
  useGetAgentDecisions, useGetGridHistory, useGetGridState, useInjectDisruption,
  useUpdateSimulatorParams
} from '@workspace/api-client-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as UiToaster } from '@/components/ui/toaster';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const fmt = (n: number, digits = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
const money = (n: number) => `$${fmt(n, 0)}`;
const pct = (n: number) => `${n.toFixed(1)}%`;
const time = (stamp?: string) => stamp ? new Date(stamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

const nav = [
  { href: '/', label: 'Control room', icon: Gauge },
  { href: '/digital-twin', label: 'Digital twin', icon: Network },
  { href: '/agents', label: 'Agent console', icon: BrainCircuit },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/simulator', label: 'Scenario lab', icon: SlidersHorizontal },
];

function StatusDot({ color = 'mint' }: { color?: 'mint' | 'amber' | 'red' | 'blue' }) {
  return <span className={`status-dot status-${color}`} aria-hidden="true" />;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [location] = useLocation();
  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobile ? 'sidebar-mobile' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Zap size={18} strokeWidth={2.5} /></div>
          {!collapsed && <div><div className="brand-name">GRIDPULSE</div><div className="brand-sub">AI OPERATIONS</div></div>}
          {mobile && <button className="icon-button mobile-close" data-testid="button-close-menu" onClick={() => setMobile(false)}><X size={18} /></button>}
        </div>
        <div className="sidebar-label">Workspace</div>
        <nav className="side-nav">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobile(false)} className={`nav-item ${location === href ? 'nav-active' : ''}`} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <Icon size={18} /><span>{!collapsed && label}</span>{!collapsed && location === href && <span className="nav-pip" />}
            </Link>
          ))}
        </nav>
        {!collapsed && <div className="sidebar-bottom">
          <div className="system-card"><div className="eyebrow">Network mode</div><div className="mode-line"><StatusDot /> <strong>Autonomous</strong><span className="live-label">LIVE</span></div><div className="system-meta">5 agents active · 18 nodes synced</div></div>
          <div className="operator"><div className="avatar">KA</div><div><strong>Kira Adebayo</strong><span>Grid operator · West</span></div><button className="icon-button" data-testid="button-operator-settings"><Settings2 size={16} /></button></div>
        </div>}
        <button className="collapse-button" data-testid="button-toggle-sidebar" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />} {!collapsed && 'Collapse rail'}</button>
      </aside>
      <main className="main-canvas">
        <header className="topbar">
          <button className="mobile-menu icon-button" data-testid="button-open-menu" onClick={() => setMobile(true)}><Menu size={19} /></button>
          <div className="crumb"><span className="crumb-muted">GRID /</span> {nav.find((n) => n.href === location)?.label || 'Control room'}</div>
          <div className="topbar-actions"><div className="sync-state"><StatusDot /><span>Syncing live</span><span className="mono">08:42:16</span></div><button className="icon-button" data-testid="button-help"><CircleHelp size={18} /></button><button className="operator-mini" data-testid="button-profile">KA</button></div>
        </header>
        <div className="page-wrap">{children}</div>
      </main>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function LoadingState({ label = 'Connecting to grid telemetry' }: { label?: string }) {
  return <div className="loading-state"><div className="skeleton-line wide" /><div className="skeleton-grid">{[1, 2, 3].map((i) => <div className="skeleton-card" key={i} />)}</div><div className="loading-copy"><RefreshCw size={16} className="spin" /> {label}</div></div>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="empty-state"><TriangleAlert size={26} /><h3>Telemetry is unavailable</h3><p>The control room could not reach the simulation service. Try reconnecting.</p><button className="button button-primary" onClick={onRetry} data-testid="button-retry"><RefreshCw size={15} /> Reconnect</button></div>;
}

function KpiCard({ label, value, unit, detail, tone = 'mint', icon: Icon, trend }: { label: string; value: string; unit?: string; detail: string; tone?: string; icon: React.ElementType; trend?: 'up' | 'down' }) {
  return <div className={`kpi-card kpi-${tone}`} data-testid={`card-kpi-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="kpi-head"><span>{label}</span><span className="kpi-icon"><Icon size={16} /></span></div><div className="kpi-value">{value}<small>{unit}</small>{trend && <span className={`trend trend-${trend}`}>{trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}</span>}</div><div className="kpi-detail">{detail}</div></div>;
}

function StatusPill({ status }: { status: string }) {
  const c = status === 'stable' || status === 'info' ? 'mint' : status === 'warning' ? 'amber' : 'red';
  return <span className={`status-pill pill-${c}`}><StatusDot color={c} />{status}</span>;
}

function Dashboard() {
  const grid = useGetGridState({ query: { queryKey: getGetGridStateQueryKey(), refetchInterval: 8000 } });
  const decisions = useGetAgentDecisions({ limit: 5 }, { query: { queryKey: getGetAgentDecisionsQueryKey({ limit: 5 }), refetchInterval: 9000 } });
  const history = useGetGridHistory({ range: 'hour' }, { query: { queryKey: getGetGridHistoryQueryKey({ range: 'hour' }), refetchInterval: 20000 } });
  const qc = useQueryClient();
  const inject = useInjectDisruption();
  const [showAction, setShowAction] = useState(false);
  const [kind, setKind] = useState<'outage' | 'demand-spike' | 'renewable-drop'>('outage');
  const [severity, setSeverity] = useState(0.55);
  if (grid.isLoading) return <LoadingState />;
  if (grid.isError || !grid.data) return <ErrorState onRetry={() => grid.refetch()} />;
  const g = grid.data;
  const k = g.kpis;
  const chart = history.data || [];
  const runDisruption = () => inject.mutate({ data: { type: kind, severity } }, { onSuccess: (result) => { toast.success('Disruption injected', { description: result.message }); setShowAction(false); qc.invalidateQueries({ queryKey: getGetGridStateQueryKey() }); qc.invalidateQueries({ queryKey: getGetAgentDecisionsQueryKey({ limit: 5 }) }); }, onError: () => toast.error('Disruption rejected') });
  return <div className="dashboard">
    <PageIntro eyebrow="West interconnect · Tuesday 14 May 2024" title="Control room" description="A live read on the network’s balance, resilience, and autonomous response." action={<div className="header-actions"><div className="clock-block"><span>Last snapshot</span><strong>{time(g.timestamp)}</strong></div><button className="button button-danger" onClick={() => setShowAction(!showAction)} data-testid="button-inject-disruption"><AlertTriangle size={15} /> Inject disruption</button></div>} />
    <AnimatePresence>{showAction && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="disruption-panel"><div><div className="eyebrow">Simulation control</div><strong>Introduce a controlled stress event</strong><p>Agents will receive the event and rebalance the network.</p></div><select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} data-testid="select-disruption-type"><option value="outage">Node outage</option><option value="demand-spike">Demand spike</option><option value="renewable-drop">Renewable drop</option></select><label className="range-label">Severity <strong>{Math.round(severity * 100)}%</strong><input type="range" min="0.1" max="1" step="0.05" value={severity} onChange={(e) => setSeverity(Number(e.target.value))} data-testid="input-disruption-severity" /></label><button className="button button-primary" onClick={runDisruption} disabled={inject.isPending} data-testid="button-confirm-disruption">{inject.isPending ? 'Injecting…' : 'Run event'}</button></motion.div>}</AnimatePresence>
    {g.activeDisruption && <div className="alert-banner"><div className="alert-symbol"><AlertTriangle size={17} /></div><div><strong>Active disruption · {g.activeDisruption}</strong><span>Autonomous response protocol engaged. Network remains within operating limits.</span></div><StatusPill status="warning" /></div>}
    <div className="kpi-grid"><KpiCard label="Grid stability" value={pct(k.gridStability)} detail="Target band 98.0–100%" icon={ShieldCheck} tone="mint" trend="up" /><KpiCard label="Renewable mix" value={pct(k.renewableUtilization)} detail={`${fmt(k.totalGeneration)} kW generated now`} icon={Leaf} tone="blue" trend="up" /><KpiCard label="Cost avoided" value={money(k.costSaved)} detail="vs. baseline dispatch" icon={TrendingUp} tone="amber" /><KpiCard label="CO₂ reduced" value={`${fmt(k.co2Reduced)} kg`} detail="This operating window" icon={Wind} tone="purple" /></div>
    <div className="dashboard-grid">
      <section className="panel flow-panel"><div className="panel-head"><div><div className="eyebrow">Live balance</div><h2>Generation vs demand</h2></div><span className="live-badge"><StatusDot /> Live</span></div><div className="balance-readout"><div><span className="readout-label">Generation</span><strong>{fmt(k.totalGeneration)} <small>kW</small></strong></div><div className="balance-divider"><span>+</span></div><div><span className="readout-label">Demand</span><strong>{fmt(k.totalDemand)} <small>kW</small></strong></div><div className="balance-net"><span>Net reserve</span><strong>{fmt(k.totalGeneration - k.totalDemand)} kW</strong></div></div><MiniChart data={chart} /><div className="legend-row"><span><i className="legend-mint" /> Generation</span><span><i className="legend-amber" /> Demand</span><span className="legend-note">Past 60 minutes</span></div></section>
      <section className="panel frequency-panel"><div className="panel-head"><div><div className="eyebrow">Power quality</div><h2>Operating envelope</h2></div><Activity size={18} className="muted-icon" /></div><div className="gauge-wrap"><div className="gauge"><div className="gauge-inner"><strong>{k.frequency.toFixed(2)}</strong><span>Hz</span></div></div><div className="gauge-caption"><StatusDot /><strong>Nominal</strong><span>50 Hz target</span></div></div><div className="quality-stats"><div><span>Voltage</span><strong>{k.voltage.toFixed(1)} <small>kV</small></strong><em>+0.2%</em></div><div><span>Transfer price</span><strong>${g.tradingPrice.toFixed(2)} <small>/kWh</small></strong><em className="positive">−8.4%</em></div></div></section>
    </div>
    <div className="dashboard-grid lower-grid">
      <section className="panel nodes-panel"><div className="panel-head"><div><div className="eyebrow">Asset telemetry</div><h2>Network nodes</h2></div><Link href="/digital-twin" className="text-link">Open topology <ChevronRight size={14} /></Link></div><div className="node-list">{g.nodes.slice(0, 6).map((n) => <div className="node-row" key={n.id} data-testid={`row-node-${n.id}`}><div className={`node-icon node-${n.type}`}>{n.type === 'solar' ? <Sun size={16} /> : n.type === 'wind' ? <Wind size={16} /> : n.type === 'battery' ? <BatteryCharging size={16} /> : n.type === 'ev' ? <Zap size={16} /> : <Cpu size={16} />}</div><div className="node-name"><strong>{n.name}</strong><span>{n.type} · {n.id}</span></div><div className="node-output"><strong>{fmt(n.currentOutputKW)} <small>kW</small></strong><div className="capacity-track"><i style={{ width: `${Math.min(100, (n.currentOutputKW / n.capacityKW) * 100)}%` }} /></div></div><StatusPill status={n.status} /></div>)}</div></section>
      <section className="panel agent-panel"><div className="panel-head"><div><div className="eyebrow">Autonomous layer</div><h2>Recent decisions</h2></div><Link href="/agents" className="text-link">View console <ChevronRight size={14} /></Link></div>{decisions.isLoading ? <div className="mini-loading"><RefreshCw size={15} className="spin" /> Listening for agent activity</div> : decisions.data?.items?.slice(0, 4).map((d) => <div className="decision-item" key={d.id}><div className="decision-agent"><div className="agent-avatar"><Bot size={15} /></div><div><strong>{d.agentName}</strong><span>{time(d.timestamp)}</span></div><StatusPill status={d.severity} /></div><p>{d.action}</p><div className="decision-foot"><span><Sparkles size={12} /> {Math.round(d.confidenceScore * 100)}% confidence</span><span className="decision-impact">{d.predictedImpact}</span></div></div>)}</section>
    </div>
  </div>;
}

function MiniChart({ data }: { data: { generation: number; demand: number }[] }) {
  const points = data.length ? data : Array.from({ length: 16 }, (_, i) => ({ generation: 730 + i * 3, demand: 670 + i * 2 }));
  const max = Math.max(...points.map((p) => Math.max(p.generation, p.demand))) * 1.04; const min = Math.min(...points.map((p) => Math.min(p.generation, p.demand))) * .96; const path = (key: 'generation' | 'demand') => points.map((p, i) => `${i ? 'L' : 'M'} ${i / (points.length - 1) * 100} ${100 - ((p[key] - min) / (max - min)) * 100}`).join(' ');
  return <div className="mini-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={path('generation')} className="chart-line chart-generation" /><path d={path('demand')} className="chart-line chart-demand" /></svg></div>;
}

function DigitalTwin() {
  const grid = useGetGridState({ query: { queryKey: getGetGridStateQueryKey(), refetchInterval: 8000 } });
  const [selected, setSelected] = useState<string | null>(null);
  if (grid.isLoading) return <LoadingState label="Building topology from node telemetry" />;
  if (grid.isError || !grid.data) return <ErrorState onRetry={() => grid.refetch()} />;
  const nodes = grid.data.nodes; const active = nodes.find((n) => n.id === selected) || nodes[0];
  return <div className="twin-page"><PageIntro eyebrow="Topology / West interconnect" title="Digital twin" description="Select an asset to inspect its live operating envelope." action={<div className="topology-status"><StatusDot /> All links nominal</div>} /><div className="twin-layout"><section className="topology-panel"><div className="topology-toolbar"><span className="eyebrow">Schematic view</span><div><span className="toolbar-key"><i className="line-key" /> Power flow</span><span className="toolbar-key"><i className="node-key" /> Asset</span></div></div><div className="topology-canvas"><div className="topology-grid" /> <div className="substation"><div className="substation-mark"><Grid2X2 size={24} /></div><strong>WEST HUB</strong><span>132 kV · stable</span></div>{nodes.map((n, i) => { const coords = [[14,20],[35,12],[57,19],[78,13],[24,66],[48,77],[72,63],[88,76]][i % 8]; return <div key={n.id} className={`topo-node ${selected === n.id ? 'topo-selected' : ''}`} style={{ left: `${coords[0]}%`, top: `${coords[1]}%` }} onClick={() => setSelected(n.id)} data-testid={`button-topology-node-${n.id}`}><div className={`topo-circle node-${n.type}`}><span>{n.type === 'solar' ? <Sun size={18} /> : n.type === 'wind' ? <Wind size={18} /> : n.type === 'battery' ? <BatteryCharging size={18} /> : n.type === 'ev' ? <Zap size={18} /> : <Cpu size={18} />}</span></div><strong>{n.name}</strong><small>{fmt(n.currentOutputKW)} kW</small></div>})}<svg className="topology-lines" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 50 L14 20 M50 50 L35 12 M50 50 L57 19 M50 50 L78 13 M50 50 L24 66 M50 50 L48 77 M50 50 L72 63 M50 50 L88 76" /></svg></div></section><aside className="node-detail panel"><div className="eyebrow">Selected asset</div><div className="detail-title"><div className={`detail-icon node-${active.type}`}>{active.type === 'solar' ? <Sun /> : active.type === 'wind' ? <Wind /> : active.type === 'battery' ? <BatteryCharging /> : active.type === 'ev' ? <Zap /> : <Cpu />}</div><div><h2>{active.name}</h2><span>{active.type} · {active.id}</span></div></div><StatusPill status={active.status} /><div className="detail-metric"><span>Current output</span><strong>{fmt(active.currentOutputKW)} <small>kW</small></strong><div className="detail-progress"><i style={{ width: `${Math.min(100, active.currentOutputKW / active.capacityKW * 100)}%` }} /></div><small>Capacity {fmt(active.capacityKW)} kW</small></div>{active.batterySoC !== null && <div className="detail-metric"><span>State of charge</span><strong>{pct(active.batterySoC)}</strong><div className="soc-bar"><i style={{ width: `${active.batterySoC}%` }} /></div></div>}<div className="detail-meta"><div><span>Last heartbeat</span><strong>12 sec ago</strong></div><div><span>Control mode</span><strong>Autonomous</strong></div><div><span>Dispatch priority</span><strong>Balanced</strong></div></div><button className="button button-quiet detail-button" data-testid="button-inspect-node"><Radio size={15} /> Open telemetry stream</button></aside></div></div>;
}

function Agents() {
  const q = useGetAgentDecisions({ limit: 20 }, { query: { queryKey: getGetAgentDecisionsQueryKey({ limit: 20 }), refetchInterval: 9000 } });
  const [open, setOpen] = useState<string | null>(null);
  if (q.isLoading) return <LoadingState label="Loading decision ledger" />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  return <div><PageIntro eyebrow="Autonomous layer / Explainability" title="Agent console" description="Every decision is logged with its reasoning, confidence, and projected system impact." action={<div className="agent-health"><StatusDot /><strong>5 / 5 agents healthy</strong><span>Decision latency 184 ms</span></div>} /><div className="agent-summary"><div><span>Decisions today</span><strong>{q.data.total || q.data.items.length}</strong><small>+18% vs yesterday</small></div><div><span>Average confidence</span><strong>94.6%</strong><small>Across last 20 decisions</small></div><div><span>Human overrides</span><strong>02</strong><small>Both resolved safely</small></div><div className="summary-callout"><BrainCircuit size={20} /><div><strong>Why this matters</strong><span>Agents show their work before they act.</span></div></div></div><section className="decision-ledger panel"><div className="ledger-head"><span>Decision ledger</span><span>Newest first · auto-refreshing</span></div>{q.data.items.map((d) => <div className={`ledger-row ${open === d.id ? 'ledger-open' : ''}`} key={d.id} data-testid={`row-decision-${d.id}`}><button className="ledger-trigger" onClick={() => setOpen(open === d.id ? null : d.id)} data-testid={`button-expand-decision-${d.id}`}><span className="expand-icon">{open === d.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span><div className="agent-avatar"><Bot size={15} /></div><div className="ledger-main"><strong>{d.action}</strong><span>{d.agentName} · {time(d.timestamp)}</span></div><span className="confidence">{Math.round(d.confidenceScore * 100)}%</span><StatusPill status={d.severity} /></button><AnimatePresence>{open === d.id && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="decision-expanded"><div><span className="eyebrow">Rationale</span><p>{d.rationale}</p></div><div className="expanded-grid"><div><span>Predicted impact</span><strong>{d.predictedImpact}</strong></div><div><span>Cost impact</span><strong className={d.costImpact <= 0 ? 'positive' : 'negative'}>{d.costImpact <= 0 ? '−' : '+'}${Math.abs(d.costImpact).toFixed(2)}</strong></div><div><span>Carbon impact</span><strong>{d.carbonImpact > 0 ? '−' : '+'}{Math.abs(d.carbonImpact).toFixed(1)} kg</strong></div></div><div className="alternatives"><span className="eyebrow">Alternatives considered</span>{d.alternativesConsidered.map((a) => <span key={a}><span className="alternative-check">✓</span>{a}</span>)}</div></motion.div>}</AnimatePresence></div>)}</section></div>;
}

function Analytics() {
  const [range, setRange] = useState<'hour' | 'day'>('day');
  const q = useGetGridHistory({ range }, { query: { queryKey: getGetGridHistoryQueryKey({ range }) } });
  if (q.isLoading) return <LoadingState label="Aggregating operating history" />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const d = q.data; const max = Math.max(...d.map((p) => Math.max(p.generation, p.demand)), 1); const makePath = (key: 'generation' | 'demand') => d.map((p, i) => `${i ? 'L' : 'M'} ${i / Math.max(1, d.length - 1) * 100} ${94 - p[key] / max * 80}`).join(' ');
  return <div><PageIntro eyebrow="Performance / Historical view" title="Grid analytics" description="Read the patterns behind today’s operating decisions." action={<div className="segmented"><button className={range === 'hour' ? 'selected' : ''} onClick={() => setRange('hour')} data-testid="button-range-hour">Last hour</button><button className={range === 'day' ? 'selected' : ''} onClick={() => setRange('day')} data-testid="button-range-day">24 hours</button></div>} /><div className="analytics-grid"><section className="panel wide-chart"><div className="panel-head"><div><div className="eyebrow">Power balance</div><h2>Generation and demand</h2></div><div className="legend-row compact"><span><i className="legend-mint" /> Generation</span><span><i className="legend-amber" /> Demand</span></div></div><div className="large-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={makePath('generation')} className="chart-line chart-generation" /><path d={makePath('demand')} className="chart-line chart-demand" /></svg><div className="chart-y"><span>{fmt(max)} kW</span><span>{fmt(max * .5)} kW</span><span>0 kW</span></div></div><div className="chart-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span></div></section><section className="panel metric-stack"><div className="panel-head"><div><div className="eyebrow">Network health</div><h2>Stability index</h2></div><ShieldCheck size={18} className="mint-icon" /></div><div className="stability-value">98.7<span>%</span></div><div className="stability-track"><i style={{ width: '98.7%' }} /></div><p className="muted-copy">Within target envelope for 21h 48m</p><div className="metric-divider" /><div className="small-metric"><span>Avg. frequency</span><strong>50.01 Hz</strong></div><div className="small-metric"><span>Voltage variance</span><strong>0.18%</strong></div></section><section className="panel analytic-cards"><div className="panel-head"><div><div className="eyebrow">Impact ledger</div><h2>What the network saved</h2></div></div><div className="impact-row"><div className="impact-icon amber"><TrendingUp size={16} /></div><div><span>Dispatch cost avoided</span><strong>$4,286.70</strong></div><em>+12.4%</em></div><div className="impact-row"><div className="impact-icon purple"><Leaf size={16} /></div><div><span>Carbon displaced</span><strong>1,284 kg</strong></div><em>+8.9%</em></div><div className="impact-row"><div className="impact-icon blue"><BatteryCharging size={16} /></div><div><span>Battery cycles optimized</span><strong>38.4 cycles</strong></div><em>−4.2%</em></div></section></div></div>;
}

function Simulator() {
  const grid = useGetGridState({ query: { queryKey: getGetGridStateQueryKey(), refetchInterval: 8000 } });
  const update = useUpdateSimulatorParams();
  const qc = useQueryClient();
  const [ev, setEv] = useState(1); const [solar, setSolar] = useState(1); const [trading, setTrading] = useState(true);
  const submit = () => update.mutate({ data: { evDemandMultiplier: ev, solarOutputMultiplier: solar, tradingEnabled: trading } }, { onSuccess: () => { toast.success('Scenario applied', { description: 'Live grid parameters have been updated.' }); qc.invalidateQueries({ queryKey: getGetGridStateQueryKey() }); }, onError: () => toast.error('Could not apply scenario') });
  if (grid.isLoading) return <LoadingState label="Loading scenario baseline" />;
  if (grid.isError || !grid.data) return <ErrorState onRetry={() => grid.refetch()} />;
  return <div><PageIntro eyebrow="Simulation / Controlled inputs" title="Scenario lab" description="Explore how the network responds before committing an operating posture." action={<button className="button button-primary" onClick={submit} disabled={update.isPending} data-testid="button-apply-scenario"><Play size={15} /> {update.isPending ? 'Applying…' : 'Apply scenario'}</button>} /><div className="simulator-grid"><section className="panel scenario-controls"><div className="panel-head"><div><div className="eyebrow">Scenario controls</div><h2>Shape the next hour</h2></div><SlidersHorizontal size={18} className="muted-icon" /></div><div className="control-group"><div className="control-head"><div><strong>EV charging demand</strong><span>Residential and fleet charging load</span></div><strong className="control-value">{ev.toFixed(2)}×</strong></div><input type="range" min=".5" max="2" step=".05" value={ev} onChange={(e) => setEv(Number(e.target.value))} data-testid="input-ev-demand" /><div className="range-minmax"><span>0.5× quiet</span><span>2× surge</span></div></div><div className="control-group"><div className="control-head"><div><strong>Solar output</strong><span>Weather-adjusted generation profile</span></div><strong className="control-value">{solar.toFixed(2)}×</strong></div><input type="range" min=".2" max="1.4" step=".05" value={solar} onChange={(e) => setSolar(Number(e.target.value))} data-testid="input-solar-output" /><div className="range-minmax"><span>0.2× overcast</span><span>1.4× clear sky</span></div></div><div className="toggle-row"><div><strong>Zone-to-zone trading</strong><span>Allow agents to trade reserve across zones</span></div><button className={`toggle ${trading ? 'toggle-on' : ''}`} onClick={() => setTrading(!trading)} aria-pressed={trading} data-testid="button-toggle-trading"><span /></button></div></section><section className="panel preview-panel"><div className="panel-head"><div><div className="eyebrow">Projected posture</div><h2>Agent forecast</h2></div><StatusPill status="info" /></div><div className="forecast-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Zap size={24} /><strong>{trading ? 'BALANCED' : 'ISLANDED'}</strong><span>Projected state</span></div></div><div className="forecast-stats"><div><span>Reserve margin</span><strong>{(12.4 + (solar - 1) * 8 - (ev - 1) * 5).toFixed(1)}%</strong></div><div><span>Trading flow</span><strong>{trading ? `${fmt(grid.data.tradingTransferKW)} kW` : 'Paused'}</strong></div><div><span>Expected stability</span><strong>98.4%</strong></div></div></section><section className="panel disruption-library"><div className="panel-head"><div><div className="eyebrow">Stress testing</div><h2>Event library</h2></div><AlertTriangle size={18} className="muted-icon" /></div><p className="muted-copy">Inject a bounded event into the live simulation to observe autonomous recovery.</p><div className="event-cards">{[['outage','Node outage','Test a sudden asset loss'],['demand-spike','Demand spike','Test a rapid load increase'],['renewable-drop','Renewable drop','Test intermittent generation']].map(([type, label, copy]) => <button key={type} className="event-card" onClick={() => toast.info('Event ready', { description: `${label} selected. Use Inject disruption from Control room to run it.` })} data-testid={`button-event-${type}`}><div className="event-card-icon"><AlertTriangle size={15} /></div><div><strong>{label}</strong><span>{copy}</span></div><ChevronRight size={15} /></button>)}</div></section></div></div>;
}

function Router() {
  return <WouterRouter base={import.meta.env.BASE_URL}><Shell><Switch><Route path="/" component={Dashboard} /><Route path="/digital-twin" component={DigitalTwin} /><Route path="/agents" component={Agents} /><Route path="/analytics" component={Analytics} /><Route path="/simulator" component={Simulator} /><Route component={NotFound} /></Switch></Shell></WouterRouter>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><UiToaster /><Toaster position="bottom-right" theme="light" /></TooltipProvider></QueryClientProvider>;
}

export default App;