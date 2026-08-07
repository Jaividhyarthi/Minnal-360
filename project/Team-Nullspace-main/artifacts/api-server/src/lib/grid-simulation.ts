import {
  type AgentDecision,
  type DisruptionInput,
  type GridState,
  type HistoryPoint,
  type SimulatorParams,
} from "@workspace/api-zod";
import { logger } from "./logger";

type Disruption = {
  type: DisruptionInput["type"];
  severity: number;
  ticksRemaining: number;
};

const AGENTS = [
  "Grid Coordinator",
  "Renewable Forecasting",
  "Demand Forecasting",
  "Battery Management",
  "Fault Detection",
];

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clockLabel = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

class GridSimulation {
  private state: GridState;
  private readonly decisions: AgentDecision[] = [];
  private readonly history: HistoryPoint[] = [];
  private params: SimulatorParams = {
    evDemandMultiplier: 1,
    solarOutputMultiplier: 1,
    tradingEnabled: true,
  };
  private disruption: Disruption | null = null;
  private batterySoC = 72;
  private costSaved = 12480;
  private co2Reduced = 8420;
  private tickCount = 0;

  constructor() {
    this.state = this.buildState(new Date());
    this.seedHistory();
    for (let index = 0; index < 10; index += 1) {
      this.decisions.push(this.createDecision(AGENTS[index % AGENTS.length], index));
    }
    setInterval(() => this.tick(), 2000);
  }

  getState() {
    return this.state;
  }

  getDecisions(limit: number) {
    return {
      items: this.decisions.slice(0, limit),
      total: this.decisions.length,
    };
  }

  getHistory(range: "hour" | "day") {
    return range === "hour" ? this.history.slice(-13) : [...this.history];
  }

  getParams() {
    return this.params;
  }

  injectDisruption(input: DisruptionInput) {
    this.disruption = {
      type: input.type,
      severity: input.severity ?? 0.75,
      ticksRemaining: 6,
    };

    const label =
      input.type === "demand-spike"
        ? "Demand spike"
        : input.type === "renewable-drop"
          ? "Renewable drop"
          : "Feeder outage";
    this.addDecision(
      "Fault Detection",
      `Anomaly detected: ${label} at ${Math.round((input.severity ?? 0.75) * 100)}% severity`,
      `Detected a deviation beyond the adaptive threshold. Emergency response protocol is active.`,
      "critical",
      0.97,
      "Isolate affected feeder and preserve frequency within ±0.05 Hz",
      -18,
      34,
    );
    this.addDecision(
      "Battery Management",
      "Dispatching reserve battery capacity",
      "Battery reserve is the lowest-cost stabilizer while the coordinator recalculates the dispatch plan.",
      "warning",
      0.94,
      "Restore 112 kW of balancing capacity in the next cycle",
      26,
      48,
    );
    this.addDecision(
      "Grid Coordinator",
      "Executing self-healing dispatch",
      "Coordinating storage, flexible EV demand, and zone transfer to contain the disruption without a full blackout.",
      "critical",
      0.91,
      "Recover stability above 96% within 12 seconds",
      -42,
      76,
    );
    this.state = this.buildState(new Date());
    return this.state;
  }

  updateParams(next: SimulatorParams) {
    this.params = next;
    this.addDecision(
      "Grid Coordinator",
      "Scenario parameters updated",
      `Rebalancing the model with EV demand at ${Math.round(next.evDemandMultiplier * 100)}% and solar output at ${Math.round(next.solarOutputMultiplier * 100)}%.`,
      "info",
      0.99,
      "Maintain stability while the scenario evolves",
      0,
      0,
    );
    this.state = this.buildState(new Date());
    return this.params;
  }

  private tick() {
    this.tickCount += 1;
    if (this.disruption) {
      this.disruption.ticksRemaining -= 1;
      if (this.disruption.ticksRemaining <= 0) {
        this.addDecision(
          "Grid Coordinator",
          "Disruption resolved autonomously",
          "Stability, voltage, and renewable utilization have returned to the safe operating envelope.",
          "info",
          0.98,
          "Return to normal operating reserve",
          31,
          19,
        );
        this.disruption = null;
      }
    }
    this.state = this.buildState(new Date());
    const point = this.historyPoint(this.state);
    this.history.push(point);
    if (this.history.length > 72) this.history.shift();

    const agent = AGENTS[this.tickCount % AGENTS.length];
    if (this.tickCount % 2 === 0) {
      this.addDecision(
        agent,
        this.routineAction(agent),
        this.routineRationale(agent),
        "info",
        0.86 + ((this.tickCount % 11) / 100),
        "Keep the network inside the target operating envelope",
        8 + (this.tickCount % 5),
        4 + (this.tickCount % 4),
      );
    }
  }

  private buildState(date: Date): GridState {
    const hour = date.getHours() + date.getMinutes() / 60;
    const solarCurve = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const solarDisruption =
      this.disruption?.type === "renewable-drop" ? 1 - this.disruption.severity : 1;
    const outageFactor = this.disruption?.type === "outage" ? 1 - this.disruption.severity : 1;
    const solar = Math.max(
      0,
      500 * solarCurve * this.params.solarOutputMultiplier * solarDisruption * outageFactor,
    );
    const wind = Math.max(
      0,
      (170 + Math.sin(this.tickCount / 4) * 34 + Math.cos(this.tickCount / 9) * 22) * outageFactor,
    );
    const industrialLoad = 390 + Math.sin((hour / 24) * Math.PI * 2 - 1.2) * 64;
    const evLoad =
      (92 + Math.sin(this.tickCount / 3) * 11) *
      this.params.evDemandMultiplier *
      (this.disruption?.type === "demand-spike" ? 1 + this.disruption.severity : 1);
    const demand = Math.max(260, industrialLoad + evLoad);
    const renewable = solar + wind;
    const imbalance = renewable - demand;
    const batteryDispatch = imbalance < 0 ? Math.min(155, -imbalance + 28) : -Math.min(80, imbalance * 0.25);
    this.batterySoC = Math.min(99, Math.max(18, this.batterySoC - batteryDispatch / 180));
    const batteryOutput = batteryDispatch > 0 ? batteryDispatch : 0;
    const generation = renewable + batteryOutput;
    const disruptionPenalty = this.disruption ? this.disruption.severity * 7 : 0;
    const stability = Math.max(
      86,
      Math.min(99.9, 98.7 - Math.abs(generation - demand) / 180 - disruptionPenalty),
    );
    this.costSaved += Math.max(1, generation > demand ? 8 : 11);
    this.co2Reduced += Math.max(1, renewable / 50);

    return {
      timestamp: date.toISOString(),
      nodes: [
        {
          id: "solar-a",
          type: "solar",
          name: "Solar Farm A",
          currentOutputKW: round(solar),
          capacityKW: 500,
          status: solar < 100 ? "warning" : "stable",
          batterySoC: null,
        },
        {
          id: "wind-b",
          type: "wind",
          name: "Wind Farm B",
          currentOutputKW: round(wind),
          capacityKW: 300,
          status: "stable",
          batterySoC: null,
        },
        {
          id: "battery",
          type: "battery",
          name: "Battery Bank",
          currentOutputKW: round(batteryDispatch),
          capacityKW: 200,
          status: this.batterySoC < 25 ? "warning" : "stable",
          batterySoC: round(this.batterySoC),
        },
        {
          id: "ev-station",
          type: "ev",
          name: "EV Station",
          currentOutputKW: round(evLoad),
          capacityKW: 150,
          status: evLoad > 130 ? "warning" : "stable",
          batterySoC: null,
        },
        {
          id: "industrial-load",
          type: "load",
          name: "Industrial Load",
          currentOutputKW: round(industrialLoad),
          capacityKW: 560,
          status: demand > 560 ? "warning" : "stable",
          batterySoC: null,
        },
      ],
      kpis: {
        gridStability: round(stability, 1),
        renewableUtilization: round(Math.min(99.9, (renewable / Math.max(1, demand)) * 100), 1),
        costSaved: round(this.costSaved, 0),
        co2Reduced: round(this.co2Reduced, 0),
        frequency: round(60 + (stability - 98) / 25, 3),
        voltage: round(1 + (stability - 98) / 180, 3),
        totalGeneration: round(generation),
        totalDemand: round(demand),
      },
      activeDisruption: this.disruption?.type ?? null,
      tradingEnabled: this.params.tradingEnabled,
      tradingPrice: round(42 + (demand - renewable) / 30, 2),
      tradingTransferKW: this.params.tradingEnabled ? round(Math.max(0, demand - renewable) * 0.22) : 0,
    };
  }

  private seedHistory() {
    const now = Date.now();
    for (let index = 47; index >= 0; index -= 1) {
      const pointDate = new Date(now - index * 30 * 60 * 1000);
      const hour = pointDate.getHours() + pointDate.getMinutes() / 60;
      const solar = Math.max(0, 500 * Math.sin(((hour - 6) / 12) * Math.PI));
      const demand = 450 + Math.sin((hour / 24) * Math.PI * 2) * 90;
      this.history.push({
        timestamp: pointDate.toISOString(),
        generation: round(solar + 160 + Math.sin(index) * 20),
        demand: round(demand),
        batterySoC: round(54 + Math.sin(index / 5) * 22),
        stability: round(96.5 + Math.sin(index / 7) * 2.2, 1),
        costSaved: round(9000 + (47 - index) * 70, 0),
        co2Reduced: round(6100 + (47 - index) * 48, 0),
      });
    }
  }

  private historyPoint(state: GridState): HistoryPoint {
    return {
      timestamp: state.timestamp,
      generation: state.kpis.totalGeneration,
      demand: state.kpis.totalDemand,
      batterySoC: state.nodes.find((node) => node.id === "battery")?.batterySoC ?? this.batterySoC,
      stability: state.kpis.gridStability,
      costSaved: state.kpis.costSaved,
      co2Reduced: state.kpis.co2Reduced,
    };
  }

  private addDecision(
    agentName: string,
    action: string,
    rationale: string,
    severity: AgentDecision["severity"],
    confidenceScore: number,
    predictedImpact: string,
    costImpact: number,
    carbonImpact: number,
  ) {
    this.decisions.unshift(
      this.createDecision(agentName, this.tickCount, {
        action,
        rationale,
        severity,
        confidenceScore,
        predictedImpact,
        costImpact,
        carbonImpact,
      }),
    );
    if (this.decisions.length > 100) this.decisions.pop();
  }

  private createDecision(
    agentName: string,
    index: number,
    overrides?: Partial<AgentDecision>,
  ): AgentDecision {
    const timestamp = new Date(Date.now() - index * 42_000).toISOString();
    return {
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp,
      agentName,
      action: "Optimizing distributed dispatch",
      rationale: "Comparing forecasts, reserves, and flexible load against the live network state.",
      confidenceScore: 0.9,
      predictedImpact: "Preserve grid stability and renewable utilization",
      costImpact: 12,
      carbonImpact: 7,
      alternativesConsidered: ["Hold current dispatch", "Curtail renewable output", "Shed flexible load"],
      severity: "info",
      ...overrides,
    };
  }

  private routineAction(agent: string) {
    const actions: Record<string, string> = {
      "Grid Coordinator": "Balancing micro-grid zones",
      "Renewable Forecasting": "Refreshing 15-minute renewable forecast",
      "Demand Forecasting": "Updating load prediction window",
      "Battery Management": "Optimizing battery reserve",
      "Fault Detection": "Scanning telemetry for anomalies",
    };
    return actions[agent] ?? "Optimizing distributed dispatch";
  }

  private routineRationale(agent: string) {
    const rationales: Record<string, string> = {
      "Grid Coordinator": "Zone A surplus is available for transfer while maintaining the reserve margin.",
      "Renewable Forecasting": "Recent irradiance and wind trend keeps the forecast inside the expected confidence band.",
      "Demand Forecasting": "Time-of-day demand curve and EV arrivals suggest a manageable evening ramp.",
      "Battery Management": "Charging below the dynamic price threshold and reserving capacity for forecast variance.",
      "Fault Detection": "Voltage, frequency, and feeder telemetry are within the adaptive operating envelope.",
    };
    return rationales[agent] ?? "Telemetry is within the adaptive operating envelope.";
  }
}

export const gridSimulation = new GridSimulation();
logger.info("Grid simulation initialized with seeded history");