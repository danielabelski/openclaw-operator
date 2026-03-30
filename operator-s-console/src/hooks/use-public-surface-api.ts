// React Query hooks for orchestrator-owned public surfaces.
// These routes are public, but they are served by the orchestrator itself.
import { useQuery } from "@tanstack/react-query";
import {
  fetchCommandCenterOverview,
  fetchCommandCenterControl,
  fetchCommandCenterDemand,
  fetchCommandCenterDemandLive,
  fetchMilestonesLatest,
  fetchMilestonesDeadLetter,
} from "@/lib/api";
import { jitteredInterval } from "@/lib/polling";

export function useCommandCenterOverview() {
  return useQuery({
    queryKey: ["command-center-overview"],
    queryFn: fetchCommandCenterOverview,
    refetchInterval: () => jitteredInterval(30000),
  });
}

export function useCommandCenterControl() {
  return useQuery({
    queryKey: ["command-center-control"],
    queryFn: fetchCommandCenterControl,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });
}

export function useCommandCenterDemand() {
  return useQuery({
    queryKey: ["command-center-demand"],
    queryFn: fetchCommandCenterDemand,
    refetchInterval: () => jitteredInterval(30000),
  });
}

export function useCommandCenterDemandLive() {
  return useQuery({
    queryKey: ["command-center-demand-live"],
    queryFn: fetchCommandCenterDemandLive,
    refetchInterval: () => jitteredInterval(30000),
  });
}

export function useMilestonesLatest(limit?: number) {
  return useQuery({
    queryKey: ["milestones-latest", limit],
    queryFn: () => fetchMilestonesLatest(limit ? { limit } : undefined),
    refetchInterval: () => jitteredInterval(30000),
  });
}

export function useMilestonesDeadLetter() {
  return useQuery({
    queryKey: ["milestones-dead-letter"],
    queryFn: fetchMilestonesDeadLetter,
    refetchInterval: () => jitteredInterval(30000),
  });
}