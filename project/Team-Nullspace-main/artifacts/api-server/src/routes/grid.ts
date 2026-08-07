import { Router, type IRouter } from "express";
import {
  GetAgentDecisionsQueryParams,
  GetAgentDecisionsResponse,
  GetGridHistoryQueryParams,
  GetGridHistoryResponse,
  GetGridStateResponse,
  InjectDisruptionBody,
  InjectDisruptionResponse,
  UpdateSimulatorParamsBody,
  UpdateSimulatorParamsResponse,
} from "@workspace/api-zod";
import { gridSimulation } from "../lib/grid-simulation";

const router: IRouter = Router();

router.get("/grid/state", (_req, res) => {
  res.json(GetGridStateResponse.parse(gridSimulation.getState()));
});

router.get("/agents/decisions", (req, res) => {
  const params = GetAgentDecisionsQueryParams.parse(req.query as Record<string, unknown>);
  res.json(GetAgentDecisionsResponse.parse(gridSimulation.getDecisions(params.limit)));
});

router.get("/history", (req, res) => {
  const params = GetGridHistoryQueryParams.parse(req.query as Record<string, unknown>);
  res.json(GetGridHistoryResponse.parse(gridSimulation.getHistory(params.range)));
});

router.post("/disruption", (req, res) => {
  const body = InjectDisruptionBody.parse(req.body);
  const state = gridSimulation.injectDisruption(body);
  res.json(
    InjectDisruptionResponse.parse({
      accepted: true,
      message: `Disruption injected: ${body.type}`,
      state,
    }),
  );
});

router.post("/simulator/params", (req, res) => {
  const body = UpdateSimulatorParamsBody.parse(req.body);
  res.json(UpdateSimulatorParamsResponse.parse(gridSimulation.updateParams(body)));
});

export default router;